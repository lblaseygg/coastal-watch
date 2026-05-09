from __future__ import annotations

from dataclasses import dataclass
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from worker.bootstrap import BACKEND_ROOT  # noqa: F401
from worker.core.config import settings
from worker.logging_utils import get_logger, log_event
from worker.utils import infer_publisher_from_url, make_id, normalize_text, parse_optional_datetime, utcnow

from app.models import Article
from tavily import TavilyClient


logger = get_logger("worker.discovery")


@dataclass
class SearchResult:
    url: str
    title: str
    snippet: str
    publisher: str
    published_at: str | None = None


@dataclass
class RelevanceMatch:
    coastal_terms: set[str]
    access_terms: set[str]
    blocking_terms: set[str]
    development_terms: set[str]
    protected_terms: set[str]
    conflict_terms: set[str]
    excluded_terms: set[str]

    @property
    def is_relevant(self) -> bool:
        access_match = bool(self.coastal_terms) and bool(self.access_terms) and bool(self.blocking_terms)
        development_match = bool(self.protected_terms) and bool(self.development_terms) and bool(self.conflict_terms)
        return (access_match or development_match) and not bool(self.excluded_terms)


class TavilySearchClient:
    def __init__(self) -> None:
        if not settings.tavily_api_key:
            raise ValueError("TAVILY_API_KEY is not configured")

        self._client = TavilyClient(api_key=settings.tavily_api_key)

    def search(self, query: str, max_results: int = 5) -> list[SearchResult]:
        payload = self._client.search(
            query=query,
            search_depth=settings.search_depth,
            topic=settings.search_topic,
            time_range=settings.search_time_range,
            max_results=max_results,
            include_domains=settings.discovery_domains or None,
            exclude_domains=settings.discovery_exclude_domains or None,
            include_raw_content=settings.discovery_include_raw_content,
        )

        results: list[SearchResult] = []
        for item in payload.get("results", []):
            url = read_value(item, "url")
            title = read_value(item, "title")
            if not url or not title:
                continue

            snippet = read_value(item, "raw_content") if settings.discovery_include_raw_content else None
            if not snippet:
                snippet = read_value(item, "content") or ""

            results.append(
                SearchResult(
                    url=url,
                    title=title,
                    snippet=snippet,
                    publisher=infer_publisher_from_url(url),
                    published_at=read_value(item, "published_date") or read_value(item, "date"),
                )
            )

        return results


def search_with_retry(client: TavilySearchClient, query: str, max_results: int) -> list[SearchResult]:
    last_error: Exception | None = None
    attempts = max(1, settings.tavily_search_retry_attempts)

    for attempt in range(1, attempts + 1):
        try:
            return client.search(query=query, max_results=max_results)
        except Exception as exc:
            last_error = exc
            log_event(
                logger,
                "discovery.query_retry",
                level=logging.WARNING if attempt < attempts else logging.ERROR,
                query=query,
                max_results=max_results,
                attempt=attempt,
                retry_attempts=attempts,
                error=str(exc),
            )

    if last_error is not None:
        raise last_error

    return []


def build_discovery_queries() -> list[str]:
    queries = list(settings.discovery_queries)
    municipalities = settings.discovery_priority_municipalities
    batch_size = max(0, settings.discovery_priority_batch_size)
    if batch_size > 0 and municipalities:
        offset = settings.discovery_priority_batch_offset % len(municipalities)
        batched = municipalities[offset : offset + batch_size]
        if len(batched) < batch_size:
            batched.extend(municipalities[: batch_size - len(batched)])
    else:
        batched = municipalities

    for municipality in batched:
        for template in settings.discovery_access_query_templates:
            queries.append(template.format(municipality=municipality))
        for template in settings.discovery_development_query_templates:
            queries.append(template.format(municipality=municipality))

    deduped: list[str] = []
    seen: set[str] = set()
    for query in queries:
        normalized = normalize_text(query)
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(query)

    return deduped


def read_value(item: object, key: str) -> str | None:
    if isinstance(item, dict):
        value = item.get(key)
    else:
        value = getattr(item, key, None)
    return str(value) if value is not None else None


def match_keywords(text: str, keywords: list[str]) -> set[str]:
    normalized = normalize_text(text)
    return {keyword for keyword in keywords if normalize_text(keyword) in normalized}


DISCOVERY_ACCESS_KEYWORDS = [
    "acceso",
    "acceso publico",
    "acceso público",
    "entrada",
    "playa",
    "playas",
    "servidumbre",
    "camino",
]

DISCOVERY_BLOCKING_KEYWORDS = [
    "bloqueo",
    "bloqueado",
    "bloquean",
    "obstruccion",
    "obstrucción",
    "cierre",
    "cerrado",
    "cerraron",
    "porton",
    "portón",
    "verja",
    "barrera",
    "cobro",
    "cobran",
    "tarifa",
    "peaje",
    "estacionamiento",
    "parking",
]

DISCOVERY_DEVELOPMENT_KEYWORDS = [
    "construccion",
    "construcción",
    "proyecto",
    "obra",
    "obras",
    "relleno",
    "tala",
    "excavacion",
    "excavación",
    "condominio",
    "hotel",
    "resort",
    "villas",
    "marina",
    "muelle",
    "desarrollo turistico",
    "desarrollo turístico",
]

DISCOVERY_PROTECTED_PLACE_KEYWORDS = [
    "playa",
    "playas",
    "costa",
    "litoral",
    "zona maritimo terrestre",
    "zona marítimo terrestre",
    "zmt",
    "area protegida",
    "área protegida",
    "reserva natural",
    "manglar",
    "manglares",
    "humedal",
    "humedales",
    "duna",
    "dunas",
    "bosque protegido",
    "corredor ecologico",
    "corredor ecológico",
    "playa virgen",
]

DISCOVERY_CONFLICT_KEYWORDS = [
    "ilegal",
    "ilegales",
    "denuncia",
    "denuncian",
    "querella",
    "demanda",
    "controversia",
    "controversial",
    "oposicion",
    "oposición",
    "opositores",
    "rechazo",
    "amenaza",
    "afecta",
    "afecta",
    "impacto ambiental",
    "viola",
    "violacion",
    "violación",
]


def score_search_result(result: SearchResult) -> RelevanceMatch:
    haystack = " ".join(
        part for part in [result.title, result.snippet, result.publisher, result.url] if part
    )
    return RelevanceMatch(
        coastal_terms=match_keywords(haystack, settings.discovery_coastal_keywords),
        access_terms=match_keywords(haystack, DISCOVERY_ACCESS_KEYWORDS),
        blocking_terms=match_keywords(haystack, DISCOVERY_BLOCKING_KEYWORDS),
        development_terms=match_keywords(haystack, DISCOVERY_DEVELOPMENT_KEYWORDS),
        protected_terms=match_keywords(haystack, DISCOVERY_PROTECTED_PLACE_KEYWORDS),
        conflict_terms=match_keywords(haystack, DISCOVERY_CONFLICT_KEYWORDS),
        excluded_terms=match_keywords(haystack, settings.discovery_excluded_keywords),
    )


def upsert_discovered_article(session: Session, result: SearchResult) -> bool:
    existing = session.scalar(select(Article).where(Article.url == result.url))
    if existing is not None:
        if not existing.title and result.title:
            existing.title = result.title[:500]
        if not existing.publisher and result.publisher:
            existing.publisher = result.publisher[:255]
        if result.published_at and existing.published_at is None:
            parsed_date = parse_optional_datetime(result.published_at)
            if parsed_date is not None:
                existing.published_at = parsed_date
        log_event(
            logger,
            "discovery.article_duplicate",
            article_id=existing.id,
            url=result.url,
            publisher=result.publisher,
            title=result.title,
        )
        return False

    now = utcnow()
    article = Article(
        id=make_id("art"),
        url=result.url,
        publisher=result.publisher[:255],
        title=result.title[:500],
        published_at=parse_optional_datetime(result.published_at) or now,
        accessed_at=now,
        language="und",
        fetch_status="queued",
        content_hash="",
        cleaned_text=result.snippet,
        linked_case_ids=[],
        created_at=now,
    )
    session.add(article)
    log_event(
        logger,
        "discovery.article_queued",
        article_id=article.id,
        url=result.url,
        publisher=result.publisher,
        title=result.title,
    )
    return True


def discover_articles(session: Session, max_results: int = 5) -> dict[str, int]:
    client = TavilySearchClient()
    discovered = 0
    filtered_out = 0
    seen_urls: set[str] = set()
    for query in build_discovery_queries():
        query_discovered = 0
        query_filtered = 0
        for result in search_with_retry(client, query=query, max_results=max_results):
            if result.url in seen_urls:
                continue
            seen_urls.add(result.url)
            match = score_search_result(result)
            if not match.is_relevant:
                filtered_out += 1
                query_filtered += 1
                log_event(
                    logger,
                    "discovery.article_filtered",
                    query=query,
                    url=result.url,
                    publisher=result.publisher,
                    title=result.title,
                    coastal_terms=sorted(match.coastal_terms),
                    access_terms=sorted(match.access_terms),
                    blocking_terms=sorted(match.blocking_terms),
                    development_terms=sorted(match.development_terms),
                    protected_terms=sorted(match.protected_terms),
                    conflict_terms=sorted(match.conflict_terms),
                    excluded_terms=sorted(match.excluded_terms),
                )
                continue
            created = int(upsert_discovered_article(session, result))
            discovered += created
            query_discovered += created

        log_event(
            logger,
            "discovery.query_complete",
            query=query,
            max_results=max_results,
            discovered=query_discovered,
            filtered_out=query_filtered,
        )

    session.commit()
    return {"discovered": discovered, "filtered_out": filtered_out}
