from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
import re

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
        "acceso publico",
        "gate",
        "barrier",
        "blocked",
        "public access",
        "beach access",
        "entrance",
        "path",
        "camino",
        "cobro",
        "cobran",
        "cobrando",
        "cobraban",
        "cargo",
        "tarifa",
        "peaje",
        "boleto",
        "ticket",
        "entrada",
        "parking",
        "estacionamiento",
        "pagar",
        "privatizar",
        "privatizacion",
    ],
    "development": [
        "development",
        "project",
        "construction",
        "construccion",
        "construyen",
        "construira",
        "edificacion",
        "obra",
        "obras",
        "proposal",
        "hotel",
        "condo",
        "shoreline project",
        "resort",
        "complejo",
        "villas",
        "airbnb",
        "muelle",
        "marina",
        "urbanizacion",
        "urbanización",
        "reserva natural",
        "area protegida",
        "areas protegidas",
        "bosque",
        "corredor ecologico",
        "corredor ecológico",
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
        "humedal",
        "humedales",
        "bosque protegido",
        "reserva natural",
        "area protegida",
        "areas protegidas",
        "corredor ecologico",
        "corredor ecológico",
        "estuario",
        "estuarios",
        "karso",
        "carso",
        "cueva",
        "cuevas",
        "tala",
        "relleno",
        "excavacion",
        "excavación",
        "destruccion",
        "destrucción",
        "impacto ambiental",
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
        "declaracion de impacto ambiental",
        "declaración de impacto ambiental",
        "consulta de ubicacion",
        "consulta de ubicación",
        "uso de terreno",
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

SUMMARY_NOISE_KEYWORDS = [
    "publicidad",
    "suscribete",
    "suscríbete",
    "newsletter",
    "guardar",
    "ver mas",
    "ver más",
    "buscar",
    "copyright",
]

SUMMARY_PRIORITY_KEYWORDS = sorted(
    {
        keyword
        for keywords in CATEGORY_KEYWORDS.values()
        for keyword in keywords
    }
    | {
        "drna",
        "ogpe",
        "playa",
        "playas",
        "costa",
        "reserva natural",
        "area protegida",
        "área protegida",
        "humedal",
        "manglar",
        "corredor ecologico",
        "corredor ecológico",
        "bosque protegido",
    }
)

LOCATION_ALIASES = {
    "caja de muertos": "ponce",
    "islote caja de muertos": "ponce",
    "isla caja de muertos": "ponce",
}

SITE_SIGNAL_KEYWORDS = sorted(
    set(settings.discovery_coastal_keywords)
    | set(LOCATION_ALIASES.keys())
    | {"islote", "isla", "cayo", "cayos", "reserva", "bosque", "humedal", "manglar"}
)


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
    municipality_name_map = {
        municipality.id: normalize_text(municipality.name)
        for municipality in municipalities
    }

    for alias, municipality_id in LOCATION_ALIASES.items():
        if municipality_id not in municipality_name_map:
            continue
        if re.search(rf"(?<![a-z0-9]){re.escape(normalize_text(alias))}(?![a-z0-9])", normalized):
            matches.append(municipality_id)

    for municipality in municipalities:
        municipality_name = municipality_name_map[municipality.id]
        if municipality_name and re.search(
            rf"(?<![a-z0-9]){re.escape(municipality_name)}(?![a-z0-9])",
            normalized,
        ):
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


def has_keyword_signal(text: str, keywords: list[str]) -> bool:
    normalized = normalize_text(text)
    return any(normalize_text(keyword) in normalized for keyword in keywords)


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


def score_summary_sentence(
    sentence: str,
    title: str,
    municipality_names: list[str],
    category_keywords: list[str],
) -> tuple[int, int]:
    normalized_sentence = normalize_text(sentence)
    normalized_title = normalize_text(title)
    score = 0

    if len(sentence) < 45:
        score -= 3
    elif len(sentence) > 320:
        score -= 1

    if any(noise in normalized_sentence for noise in SUMMARY_NOISE_KEYWORDS):
        score -= 5

    if any(normalize_text(name) in normalized_sentence for name in municipality_names):
        score += 4

    if any(normalize_text(keyword) in normalized_sentence for keyword in category_keywords):
        score += 4

    if any(normalize_text(keyword) in normalized_sentence for keyword in SUMMARY_PRIORITY_KEYWORDS):
        score += 2

    if normalized_title and any(token in normalized_sentence for token in normalized_title.split()[:6]):
        score += 1

    if any(flag in normalized_sentence for flag in LEGAL_CLAIM_KEYWORDS):
        score -= 1

    return score, -len(sentence)


def build_summary(
    text: str,
    title: str,
    municipality_names: list[str],
    category_keywords: list[str],
) -> str:
    sentences = split_sentences(text)
    if not sentences:
        fallback = title.strip() or text.strip()
        return fallback[:480] or "Article under review."

    ranked_sentences = sorted(
        sentences,
        key=lambda sentence: score_summary_sentence(
            sentence,
            title=title,
            municipality_names=municipality_names,
            category_keywords=category_keywords,
        ),
        reverse=True,
    )

    chosen: list[str] = []
    seen_normalized: set[str] = set()
    for sentence in ranked_sentences:
        normalized_sentence = normalize_text(sentence)
        if normalized_sentence in seen_normalized:
            continue
        if score_summary_sentence(
            sentence,
            title=title,
            municipality_names=municipality_names,
            category_keywords=category_keywords,
        )[0] < 0 and chosen:
            continue

        chosen.append(sentence)
        seen_normalized.add(normalized_sentence)
        if len(chosen) == 2:
            break

    if not chosen:
        chosen = sentences[:1]

    summary = " ".join(chosen).strip()
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
    site_signal = has_keyword_signal(combined_text, SITE_SIGNAL_KEYWORDS)

    sensitivity_flags: list[str] = []
    normalized_text = normalize_text(combined_text)
    if not municipality_ids:
        sensitivity_flags.append("unclear_location")
    if any(keyword in normalized_text for keyword in LEGAL_CLAIM_KEYWORDS):
        sensitivity_flags.append("legal_claim")
    if not site_signal:
        sensitivity_flags.append("broad_policy_context")

    if scores and municipality_ids and site_signal:
        relevance = "relevant"
    elif scores and site_signal:
        relevance = "unclear"
    else:
        relevance = "irrelevant"

    confidence = 0.38
    if municipality_ids:
        confidence += 0.24
    if scores:
        confidence += min(0.18, 0.06 * max(scores.values()))
    if site_signal:
        confidence += 0.08
    if article.publisher.endswith(".gov") or ".gov" in article.publisher:
        confidence += 0.08
    if sensitivity_flags:
        confidence -= 0.12

    confidence = max(0.08, min(0.97, round(confidence, 2)))
    municipality_names = [municipality.name for municipality in municipalities if municipality.id in municipality_ids]
    category_keywords = CATEGORY_KEYWORDS.get(category, [])
    claims = select_claims(article.cleaned_text, category_keywords, municipality_names)

    return ExtractionDraft(
        relevance=relevance,
        confidence_score=confidence,
        extracted_case_title=build_case_title(article, municipality_ids, category),
        extracted_summary=build_summary(
            article.cleaned_text,
            title=article.title,
            municipality_names=municipality_names,
            category_keywords=category_keywords,
        ),
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
