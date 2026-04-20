from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from worker.bootstrap import BACKEND_ROOT  # noqa: F401
from worker.core.config import settings
from worker.utils import make_id, normalize_text, split_sentences, utcnow

from app.models import Article, ArticleExtraction, Municipality


CATEGORY_KEYWORDS = {
    "access_restriction": [
        "access",
        "acceso",
        "gate",
        "barrier",
        "blocked",
        "public access",
        "beach access",
        "entrance",
        "path",
        "camino",
    ],
    "development": [
        "development",
        "project",
        "construction",
        "proposal",
        "hotel",
        "condo",
        "shoreline project",
        "resort",
        "obra",
    ],
    "environmental_concern": [
        "erosion",
        "erosion",
        "erosion",
        "mangrove",
        "manglar",
        "reef",
        "arrecife",
        "dune",
        "duna",
        "habitat",
        "coral",
        "shoreline erosion",
    ],
    "policy_or_permitting": [
        "permit",
        "permitting",
        "permiso",
        "agency",
        "filing",
        "consulta",
        "approval",
        "review",
        "regulation",
        "regulatory",
    ],
}

LEGAL_CLAIM_KEYWORDS = [
    "illegal",
    "illegally",
    "lawsuit",
    "sued",
    "corruption",
    "fraud",
    "criminal",
    "querella",
    "demanda",
    "ilegal",
]


@dataclass
class ExtractionDraft:
    relevance: str
    confidence_score: float
    extracted_case_title: str
    extracted_summary: str
    category: str
    municipality_ids: list[str]
    claims: list[dict[str, object]]
    sensitive_flags: list[str]
    needs_review: bool


def detect_municipalities(text: str, municipalities: list[Municipality]) -> list[str]:
    normalized = normalize_text(text)
    matches: list[str] = []

    for municipality in municipalities:
        municipality_name = normalize_text(municipality.name)
        if municipality_name and municipality_name in normalized:
            matches.append(municipality.id)

    return sorted(set(matches))


def score_categories(text: str) -> Counter[str]:
    normalized = normalize_text(text)
    scores: Counter[str] = Counter()

    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if normalize_text(keyword) in normalized:
                scores[category] += 1

    return scores


def select_claims(text: str, keywords: list[str], municipality_names: list[str]) -> list[dict[str, object]]:
    claims: list[dict[str, object]] = []
    keyword_pool = [normalize_text(keyword) for keyword in [*keywords, *municipality_names]]

    for sentence in split_sentences(text):
        normalized_sentence = normalize_text(sentence)
        if any(keyword in normalized_sentence for keyword in keyword_pool):
            claims.append(
                {
                    "text": sentence[:280],
                    "evidence_snippet": sentence[:280],
                    "sensitive": any(flag in normalized_sentence for flag in LEGAL_CLAIM_KEYWORDS),
                }
            )

        if len(claims) == 3:
            break

    return claims or [
        {
            "text": split_sentences(text)[0][:280] if split_sentences(text) else text[:280],
            "evidence_snippet": split_sentences(text)[0][:280] if split_sentences(text) else text[:280],
            "sensitive": False,
        }
    ]


def build_summary(text: str) -> str:
    sentences = split_sentences(text)
    summary = " ".join(sentences[:2]).strip() if sentences else text.strip()
    return summary[:480] or "Article under review."


def build_case_title(article: Article, municipality_ids: list[str], category: str) -> str:
    if article.title:
        return article.title[:255]

    label = category.replace("_", " ")
    if municipality_ids:
        return f"{municipality_ids[0].replace('-', ' ').title()} {label.title()}"

    return f"Potential {label.title()} case"


def classify_article(article: Article, municipalities: list[Municipality]) -> ExtractionDraft:
    combined_text = f"{article.title}. {article.cleaned_text}".strip()
    municipality_ids = detect_municipalities(combined_text, municipalities)
    scores = score_categories(combined_text)
    category = scores.most_common(1)[0][0] if scores else "policy_or_permitting"

    sensitivity_flags: list[str] = []
    normalized_text = normalize_text(combined_text)
    if not municipality_ids:
        sensitivity_flags.append("unclear_location")
    if any(keyword in normalized_text for keyword in LEGAL_CLAIM_KEYWORDS):
        sensitivity_flags.append("legal_claim")
    if category == "policy_or_permitting":
        sensitivity_flags.append("policy_or_permitting")

    relevance = "relevant" if municipality_ids or scores else "irrelevant"
    if relevance == "relevant" and "unclear_location" in sensitivity_flags:
        relevance = "unclear"

    confidence = 0.38
    if municipality_ids:
        confidence += 0.24
    if scores:
        confidence += min(0.18, 0.06 * max(scores.values()))
    if article.publisher.endswith(".gov") or ".gov" in article.publisher:
        confidence += 0.08
    if sensitivity_flags:
        confidence -= 0.12

    confidence = max(0.08, min(0.97, round(confidence, 2)))
    municipality_names = [municipality.name for municipality in municipalities if municipality.id in municipality_ids]
    claims = select_claims(article.cleaned_text, CATEGORY_KEYWORDS.get(category, []), municipality_names)

    return ExtractionDraft(
        relevance=relevance,
        confidence_score=confidence,
        extracted_case_title=build_case_title(article, municipality_ids, category),
        extracted_summary=build_summary(article.cleaned_text),
        category=category,
        municipality_ids=municipality_ids,
        claims=claims,
        sensitive_flags=sorted(set(sensitivity_flags)),
        needs_review=relevance != "relevant" or confidence < 0.78 or bool(sensitivity_flags),
    )


def extract_articles(session: Session, limit: int = 10) -> dict[str, int]:
    municipalities = session.scalars(select(Municipality).order_by(Municipality.name.asc())).all()
    articles = session.scalars(
        select(Article)
        .where(Article.fetch_status == "cleaned")
        .order_by(Article.created_at.asc())
        .limit(limit)
    ).all()

    existing_article_ids = set(session.scalars(select(ArticleExtraction.article_id)).all())
    created = 0

    for article in articles:
        if article.id in existing_article_ids:
            continue

        draft = classify_article(article, municipalities)
        extraction = ArticleExtraction(
            id=make_id("ext"),
            article_id=article.id,
            schema_version="phase0-v1",
            relevance=draft.relevance,
            confidence_score=draft.confidence_score,
            extracted_case_title=draft.extracted_case_title,
            extracted_summary=draft.extracted_summary,
            category=draft.category,
            municipality_ids=draft.municipality_ids,
            claims=draft.claims,
            sensitive_flags=draft.sensitive_flags,
            needs_review=draft.needs_review,
            model_name=settings.extraction_model_name,
            created_at=utcnow(),
        )
        session.add(extraction)
        created += 1

    session.commit()
    return {"extractions": created}
