from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
import json
import logging
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from worker.bootstrap import BACKEND_ROOT  # noqa: F401
from worker.core.config import settings
from worker.logging_utils import get_logger, log_event
from worker.openai_utils import get_openai_client, parse_json_output
from worker.utils import make_id, normalize_text, split_sentences, utcnow

from app.models import Article, ArticleExtraction, Municipality


logger = get_logger("worker.extraction")


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
        "expansion",
        "expansión",
        "paseo",
        "ciclovia",
        "ciclovía",
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

ACCESS_SCOPE_KEYWORDS = [
    "acceso",
    "acceso publico",
    "acceso público",
    "entrada",
    "cobro",
    "cobran",
    "tarifa",
    "peaje",
    "parking",
    "estacionamiento",
    "porton",
    "portón",
    "verja",
    "bloqueo",
    "cierre",
    "barrera",
    "privatizacion",
    "privatización",
]

ACCESS_RESTRICTION_ACTION_KEYWORDS = [
    "bloqueo",
    "bloqueado",
    "bloqueada",
    "bloquean",
    "obstruccion",
    "obstrucción",
    "cierre",
    "cerrado",
    "cerrada",
    "cerraron",
    "porton",
    "portón",
    "verja",
    "barrera",
    "privatizacion",
    "privatización",
    "limitar el acceso",
    "limitar acceso",
    "limita acceso",
    "limita el acceso",
    "restringe acceso",
    "restringir acceso",
    "impide acceso",
    "impiden acceso",
    "cobro",
    "cobran",
    "cobrando",
    "tarifa",
    "peaje",
    "ticket",
    "boleto",
]

DEVELOPMENT_SCOPE_KEYWORDS = [
    "construccion",
    "construcción",
    "construyen",
    "construira",
    "construirá",
    "proyecto",
    "obra",
    "obras",
    "edificacion",
    "edificación",
    "expansion",
    "expansión",
    "urbanizacion",
    "urbanización",
    "hotel",
    "resort",
    "condominio",
    "complejo",
    "villas",
    "marina",
    "muelle",
    "paseo",
    "ciclovia",
    "ciclovía",
]

DESTRUCTION_SCOPE_KEYWORDS = [
    "destruccion",
    "destrucción",
    "tala",
    "relleno",
    "excavacion",
    "excavación",
    "remocion",
    "remoción",
    "dragado",
    "demolicion",
    "demolición",
    "impacto ambiental",
    "afecta",
    "afecta",
    "afectado",
    "afectada",
]

PERMIT_SCOPE_KEYWORDS = [
    "permiso",
    "permisos",
    "ogpe",
    "drna",
    "consulta de ubicacion",
    "consulta de ubicación",
    "declaracion de impacto ambiental",
    "declaración de impacto ambiental",
    "uso de terreno",
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
    "esencia": "cabo-rojo",
    "sol y playa": "rincon",
    "la parguera": "lajas",
    "buye": "cabo-rojo",
    "combate": "cabo-rojo",
    "boqueron": "cabo-rojo",
    "boquerón": "cabo-rojo",
    "playa sucia": "cabo-rojo",
    "la playuela": "cabo-rojo",
    "joyuda": "cabo-rojo",
    "bahia salinas": "cabo-rojo",
    "bahía salinas": "cabo-rojo",
    "punta melones": "cabo-rojo",
    "refugio de vida silvestre cabo rojo": "cabo-rojo",
    "domes": "rincon",
    "sandy beach": "rincon",
    "tres palmas": "rincon",
    "punta higuero": "rincon",
    "corcega": "rincon",
    "córcega": "rincon",
    "marias": "rincon",
    "marías": "rincon",
    "jobos": "isabela",
    "shacks": "isabela",
    "guajataca": "quebradillas",
    "crash boat": "aguadilla",
    "survival beach": "aguadilla",
    "peña blanca": "aguadilla",
    "la monserrate": "luquillo",
    "balneario la monserrate": "luquillo",
    "la pared": "luquillo",
    "seven seas": "fajardo",
    "las cabezas de san juan": "fajardo",
    "cabezas de san juan": "fajardo",
    "medio mundo y dagao": "ceiba",
    "bahia de jobos": "salinas",
    "bahía de jobos": "salinas",
    "mar negro": "salinas",
    "mata la gata": "lajas",
    "cayo caracoles": "lajas",
    "la jungla": "loiza",
    "vacia talega": "loiza",
    "vacía talega": "loiza",
    "aviones": "loiza",
    "isla verde": "carolina",
    "piñones": "loiza",
    "ocean park": "san-juan",
    "escambron": "san-juan",
    "escambrón": "san-juan",
    "condado": "san-juan",
    "punta las marias": "san-juan",
    "punta las marías": "san-juan",
    "tortuguero": "vega-baja",
    "cerro gordo": "vega-alta",
    "balneario de dorado": "dorado",
    "palmas del mar": "humacao",
    "bosque seco de guanica": "guanica",
    "bosque seco de guánica": "guanica",
    "gilligans": "guanica",
    "gilligan": "guanica",
    "cana gorda": "guanica",
    "caña gorda": "guanica",
    "ballena": "guanica",
    "playa santa": "guanica",
    "sun bay": "vieques",
    "mosquito pier": "vieques",
    "media luna": "vieques",
    "navio": "vieques",
    "navío": "vieques",
    "flamenco": "culebra",
    "playa flamenco": "culebra",
    "zoni": "culebra",
    "tamarindo": "culebra",
    "tortuga beach": "culebra",
}

SITE_SIGNAL_KEYWORDS = sorted(
    set(settings.discovery_coastal_keywords)
    | set(LOCATION_ALIASES.keys())
    | {"islote", "isla", "cayo", "cayos", "reserva", "bosque", "humedal", "manglar"}
)

PROTECTED_PLACE_KEYWORDS = [
    "playa",
    "playas",
    "costa",
    "costero",
    "costera",
    "litoral",
    "zona maritimo terrestre",
    "zona marítimo terrestre",
    "zmt",
    "reserva natural",
    "area protegida",
    "área protegida",
    "bosque protegido",
    "corredor ecologico",
    "corredor ecológico",
    "humedal",
    "humedales",
    "manglar",
    "manglares",
    "duna",
    "dunas",
    "arrecife",
    "arrecifes",
    "estuario",
    "estuarios",
    "dominio publico",
    "dominio público",
]

CONFLICT_SCOPE_KEYWORDS = [
    "ilegal",
    "ilegales",
    "denuncia",
    "denuncian",
    "denuncias",
    "querella",
    "demanda",
    "controversia",
    "controversial",
    "oposicion",
    "oposición",
    "opositores",
    "rechazo",
    "amenaza",
    "amenazas",
    "afecta",
    "afecta el acceso",
    "afectado",
    "afectada",
    "bloqueo",
    "cierre",
    "obstruccion",
    "obstrucción",
    "privatizacion",
    "privatización",
    "destruccion",
    "destrucción",
    "relleno",
    "tala",
    "excavacion",
    "excavación",
    "impacto ambiental",
    "violacion ambiental",
    "violación ambiental",
    "no estan legales",
    "no están legales",
    "limitar acceso",
]


@dataclass
class ExtractionDraft:
    model_name: str
    relevance: str
    confidence_score: float
    extracted_case_title: str
    extracted_summary: str
    category: str
    municipality_ids: list[str]
    claims: list[dict[str, object]]
    sensitive_flags: list[str]
    needs_review: bool


def unique_preserving_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        ordered.append(value)
    return ordered


def detect_location_aliases(text: str, municipalities: list[Municipality]) -> list[str]:
    normalized = normalize_text(text)
    municipality_name_map = {
        municipality.id: normalize_text(municipality.name)
        for municipality in municipalities
    }
    matches: list[str] = []

    for alias, municipality_id in LOCATION_ALIASES.items():
        if municipality_id not in municipality_name_map:
            continue
        if re.search(rf"(?<![a-z0-9]){re.escape(normalize_text(alias))}(?![a-z0-9])", normalized):
            matches.append(municipality_id)

    return unique_preserving_order(matches)


def detect_named_municipalities(text: str, municipalities: list[Municipality]) -> list[str]:
    normalized = normalize_text(text)
    matches: list[str] = []
    municipality_name_map = {
        municipality.id: normalize_text(municipality.name)
        for municipality in municipalities
    }

    for municipality in municipalities:
        municipality_name = municipality_name_map[municipality.id]
        if municipality_name and re.search(
            rf"(?<![a-z0-9]){re.escape(municipality_name)}(?![a-z0-9])",
            normalized,
        ):
            matches.append(municipality.id)

    return unique_preserving_order(matches)


def detect_primary_municipalities(article: Article, municipalities: list[Municipality]) -> list[str]:
    title_text = article.title or ""
    lead_sentences = split_sentences(article.cleaned_text)[:4]
    lead_text = " ".join(lead_sentences)
    title_and_lead = f"{title_text}. {lead_text}".strip()
    full_text = f"{title_text}. {article.cleaned_text}".strip()

    alias_matches = detect_location_aliases(title_and_lead, municipalities)
    if alias_matches:
        return alias_matches[:2]

    title_matches = detect_named_municipalities(title_text, municipalities)
    if 0 < len(title_matches) <= 2:
        return title_matches

    lead_matches = detect_named_municipalities(title_and_lead, municipalities)
    if 0 < len(lead_matches) <= 2:
        return lead_matches[:2]

    alias_matches = detect_location_aliases(full_text, municipalities)
    if alias_matches:
        return alias_matches[:2]

    full_matches = detect_named_municipalities(full_text, municipalities)
    if 0 < len(full_matches) <= 2:
        return full_matches[:2]

    return []


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


def has_non_negated_keyword_signal(text: str, keywords: list[str]) -> bool:
    normalized = normalize_text(text)
    for keyword in keywords:
        normalized_keyword = normalize_text(keyword)
        start = 0
        while True:
            index = normalized.find(normalized_keyword, start)
            if index < 0:
                break
            window = normalized[max(0, index - 40) : index]
            if re.search(r"\b(?:sin|no)\b", window):
                start = index + len(normalized_keyword)
                continue
            return True
        
    return False


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
    municipality_ids = detect_primary_municipalities(article, municipalities)
    scores = score_categories(combined_text)
    category = scores.most_common(1)[0][0] if scores else "policy_or_permitting"
    site_signal = has_keyword_signal(combined_text, SITE_SIGNAL_KEYWORDS)
    protected_place_signal = has_keyword_signal(combined_text, PROTECTED_PLACE_KEYWORDS)
    access_signal = has_keyword_signal(combined_text, ACCESS_SCOPE_KEYWORDS)
    access_restriction_signal = has_non_negated_keyword_signal(combined_text, ACCESS_RESTRICTION_ACTION_KEYWORDS)
    development_signal = has_keyword_signal(combined_text, DEVELOPMENT_SCOPE_KEYWORDS)
    destruction_signal = has_keyword_signal(combined_text, DESTRUCTION_SCOPE_KEYWORDS)
    conflict_signal = has_keyword_signal(combined_text, CONFLICT_SCOPE_KEYWORDS)
    permit_signal = has_keyword_signal(combined_text, PERMIT_SCOPE_KEYWORDS)
    excluded_scope_signal = has_keyword_signal(combined_text, settings.discovery_excluded_keywords)
    permit_project_signal = permit_signal and (development_signal or destruction_signal)
    access_tracker_signal = protected_place_signal and access_signal and access_restriction_signal
    development_tracker_signal = (
        protected_place_signal
        and (development_signal or destruction_signal or permit_project_signal)
        and (conflict_signal or destruction_signal or access_restriction_signal)
    )
    tracker_scope_signal = access_tracker_signal or development_tracker_signal

    if access_tracker_signal:
        category = "access_restriction"
    elif development_tracker_signal and destruction_signal:
        category = "environmental_concern"
    elif development_tracker_signal:
        category = "development"

    sensitivity_flags: list[str] = []
    normalized_text = normalize_text(combined_text)
    if not municipality_ids:
        sensitivity_flags.append("unclear_location")
    if any(keyword in normalized_text for keyword in LEGAL_CLAIM_KEYWORDS):
        sensitivity_flags.append("legal_claim")
    if not site_signal:
        sensitivity_flags.append("broad_policy_context")
    if not municipality_ids or not tracker_scope_signal:
        sensitivity_flags.append("outside_tracker_scope")
    if excluded_scope_signal:
        sensitivity_flags.append("excluded_incident_context")
    if site_signal and not protected_place_signal:
        sensitivity_flags.append("unclear_protected_place")
    if access_signal and not access_restriction_signal:
        sensitivity_flags.append("general_access_context")

    if excluded_scope_signal:
        relevance = "irrelevant"
    elif municipality_ids and scores and site_signal and protected_place_signal and tracker_scope_signal:
        relevance = "relevant"
    elif municipality_ids and site_signal and protected_place_signal and tracker_scope_signal:
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
    if protected_place_signal:
        confidence += 0.08
    if tracker_scope_signal:
        confidence += 0.08
    if access_restriction_signal:
        confidence += 0.04
    if permit_project_signal:
        confidence += 0.04
    if article.publisher.endswith(".gov") or ".gov" in article.publisher:
        confidence += 0.08
    if sensitivity_flags:
        confidence -= 0.12
    if excluded_scope_signal:
        confidence -= 0.2

    confidence = max(0.08, min(0.97, round(confidence, 2)))
    municipality_names = [municipality.name for municipality in municipalities if municipality.id in municipality_ids]
    category_keywords = CATEGORY_KEYWORDS.get(category, [])
    claims = select_claims(article.cleaned_text, category_keywords, municipality_names)

    return ExtractionDraft(
        model_name="heuristic-v1",
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


def classify_article_with_openai(article: Article, municipalities: list[Municipality]) -> ExtractionDraft:
    client = get_openai_client()
    municipality_catalog = [
        {"id": municipality.id, "name": municipality.name}
        for municipality in municipalities
    ]
    allowed_ids = {municipality["id"] for municipality in municipality_catalog}
    prompt = (
        "You are classifying Puerto Rico coastal reporting for a civic monitoring system.\n"
        "Return JSON only with this shape:\n"
        "{"
        '"relevance":"relevant|unclear|irrelevant",'
        '"confidence_score":0.0,'
        '"extracted_case_title":"...",'
        '"extracted_summary":"...",'
        '"category":"access_restriction|development|environmental_concern|policy_or_permitting",'
        '"municipality_ids":["..."],'
        '"claims":[{"text":"...","evidence_snippet":"...","sensitive":true}],'
        '"sensitive_flags":["..."],'
        '"needs_review":true'
        "}\n"
        "Only use municipality IDs from this catalog:\n"
        f"{json.dumps(municipality_catalog, ensure_ascii=False)}\n"
        "If the article does not fit the tracker, mark it irrelevant."
    )
    last_error: Exception | None = None
    attempts = max(1, settings.openai_extraction_retry_attempts)
    response = None
    for attempt in range(1, attempts + 1):
        try:
            response = client.responses.create(
                model=settings.extraction_model_name,
                input=(
                    f"{prompt}\n"
                    f"Publisher: {article.publisher}\n"
                    f"URL: {article.url}\n"
                    f"Title: {article.title}\n"
                    f"Cleaned article text:\n{article.cleaned_text[:12000]}"
                ),
            )
            break
        except Exception as exc:
            last_error = exc
            log_event(
                logger,
                "extraction.openai_retry",
                level=logging.WARNING if attempt < attempts else logging.ERROR,
                article_id=article.id,
                url=article.url,
                attempt=attempt,
                retry_attempts=attempts,
                error=str(exc),
            )

    if response is None:
        raise last_error or ValueError("OpenAI extraction did not return a response")

    payload = parse_json_output(response.output_text)
    municipality_ids = [
        municipality_id
        for municipality_id in payload.get("municipality_ids", [])
        if municipality_id in allowed_ids
    ][:2]
    claims = []
    for claim in payload.get("claims", [])[:3]:
        if not isinstance(claim, dict):
            continue
        claim_text = str(claim.get("text", "")).strip()[:280]
        evidence_snippet = str(claim.get("evidence_snippet", claim_text)).strip()[:280]
        if not claim_text:
            continue
        claims.append(
            {
                "text": claim_text,
                "evidence_snippet": evidence_snippet,
                "sensitive": bool(claim.get("sensitive", False)),
            }
        )

    confidence_score = payload.get("confidence_score", 0.5)
    try:
        confidence_score = float(confidence_score)
    except (TypeError, ValueError):
        confidence_score = 0.5

    category = str(payload.get("category", "policy_or_permitting")).strip() or "policy_or_permitting"
    if category not in {
        "access_restriction",
        "development",
        "environmental_concern",
        "policy_or_permitting",
    }:
        category = "policy_or_permitting"

    relevance = str(payload.get("relevance", "unclear")).strip() or "unclear"
    if relevance not in {"relevant", "unclear", "irrelevant"}:
        relevance = "unclear"

    summary = str(payload.get("extracted_summary", "")).strip()[:480]
    case_title = str(payload.get("extracted_case_title", "")).strip()[:255]
    sensitive_flags = sorted(
        {str(flag).strip() for flag in payload.get("sensitive_flags", []) if str(flag).strip()}
    )
    needs_review = bool(payload.get("needs_review", True))

    if not summary or not case_title:
        raise ValueError("OpenAI extraction response was missing required summary/title fields")

    return ExtractionDraft(
        model_name=settings.extraction_model_name,
        relevance=relevance,
        confidence_score=max(0.0, min(1.0, round(confidence_score, 2))),
        extracted_case_title=case_title,
        extracted_summary=summary,
        category=category,
        municipality_ids=municipality_ids,
        claims=claims
        or [
            {
                "text": summary[:280],
                "evidence_snippet": summary[:280],
                "sensitive": bool(sensitive_flags),
            }
        ],
        sensitive_flags=sensitive_flags,
        needs_review=needs_review,
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

        try:
            draft = classify_article_with_openai(article, municipalities)
        except Exception as exc:
            log_event(
                logger,
                "extraction.openai_fallback",
                level=logging.WARNING,
                article_id=article.id,
                url=article.url,
                error=str(exc),
            )
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
            model_name=draft.model_name,
            created_at=utcnow(),
        )
        session.add(extraction)
        log_event(
            logger,
            "extraction.article_classified",
            article_id=article.id,
            url=article.url,
            publisher=article.publisher,
            title=article.title,
            relevance=draft.relevance,
            category=draft.category,
            municipality_ids=draft.municipality_ids,
            confidence_score=draft.confidence_score,
            sensitive_flags=draft.sensitive_flags,
            needs_review=draft.needs_review,
        )
        created += 1

    session.commit()
    return {"extractions": created}
