from __future__ import annotations

from dataclasses import dataclass
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from worker.bootstrap import BACKEND_ROOT  # noqa: F401
from worker.core.config import settings
from worker.logging_utils import get_logger, log_event
from worker.utils import infer_publisher_from_url, sha256_text, utcnow

from app.models import Article
from tavily import TavilyClient


logger = get_logger("worker.fetching")


@dataclass
class ExtractResult:
    url: str
    raw_content: str
    title: str | None = None


def read_value(item: object, key: str) -> str | None:
    if isinstance(item, dict):
        value = item.get(key)
    else:
        value = getattr(item, key, None)
    return str(value) if value is not None else None


class TavilyExtractClient:
    def __init__(self) -> None:
        if not settings.tavily_api_key:
            raise ValueError("TAVILY_API_KEY is not configured")

        self._client = TavilyClient(api_key=settings.tavily_api_key)

    def extract(self, urls: list[str]) -> tuple[list[ExtractResult], set[str]]:
        payload = self._client.extract(
            urls=urls,
            extract_depth=settings.tavily_extract_depth,
            format=settings.tavily_extract_format,
            timeout=settings.tavily_extract_timeout,
            include_images=False,
            include_favicon=False,
        )

        results: list[ExtractResult] = []
        for item in payload.get("results", []):
            url = read_value(item, "url")
            raw_content = read_value(item, "raw_content") or read_value(item, "content")
            if not url or not raw_content:
                continue
            results.append(
                ExtractResult(
                    url=url,
                    raw_content=raw_content,
                    title=read_value(item, "title"),
                )
            )

        failed_urls: set[str] = set()
        for item in payload.get("failed_results", []):
            url = read_value(item, "url")
            if url:
                failed_urls.add(url)

        return results, failed_urls


def extract_with_retry(client: TavilyExtractClient, urls: list[str]) -> tuple[list[ExtractResult], set[str]]:
    last_error: Exception | None = None
    attempts = max(1, settings.tavily_extract_retry_attempts)

    for attempt in range(1, attempts + 1):
        try:
            return client.extract(urls)
        except Exception as exc:
            last_error = exc
            log_event(
                logger,
                "fetch.batch_retry",
                level=logging.WARNING if attempt < attempts else logging.ERROR,
                urls=urls,
                attempt=attempt,
                retry_attempts=attempts,
                error=str(exc),
            )

    if last_error is not None:
        raise last_error

    return [], set()


def clean_extracted_content(content: str) -> str:
    cleaned_text = content.strip()
    return cleaned_text[:20000]


def chunked_urls(urls: list[str], size: int = 20) -> list[list[str]]:
    return [urls[index : index + size] for index in range(0, len(urls), size)]


def fetch_queued_articles(session: Session, limit: int = 10) -> dict[str, int]:
    articles = session.scalars(
        select(Article)
        .where(Article.fetch_status.in_(["queued", "failed"]))
        .order_by(Article.created_at.asc())
        .limit(limit)
    ).all()

    if not articles:
        return {"cleaned": 0, "failed": 0}

    client = TavilyExtractClient()
    article_by_url = {article.url: article for article in articles}
    cleaned = 0
    failed = 0

    for url_batch in chunked_urls(list(article_by_url), size=20):
        batch_articles = {url: article_by_url[url] for url in url_batch}
        try:
            results, failed_urls = extract_with_retry(client, url_batch)
        except Exception as exc:
            for article in batch_articles.values():
                article.accessed_at = utcnow()
                article.fetch_status = "failed"
                log_event(
                    logger,
                    "fetch.article_failed",
                    level=40,
                    article_id=article.id,
                    url=article.url,
                    reason="extract_exception",
                    error=str(exc),
                )
                failed += 1
            continue

        extracted_urls: set[str] = set()
        for result in results:
            article = batch_articles.get(result.url)
            if article is None:
                continue

            extracted_urls.add(result.url)
            cleaned_text = clean_extracted_content(result.raw_content)
            if not cleaned_text:
                article.accessed_at = utcnow()
                article.fetch_status = "failed"
                log_event(
                    logger,
                    "fetch.article_failed",
                    article_id=article.id,
                    url=article.url,
                    reason="empty_content",
                )
                failed += 1
                continue

            article.url = result.url
            article.publisher = infer_publisher_from_url(result.url)[:255]
            article.title = (result.title or article.title)[:500]
            article.language = (article.language if article.language and article.language != "und" else "es")[:16]
            article.cleaned_text = cleaned_text
            article.content_hash = sha256_text(cleaned_text)
            article.accessed_at = utcnow()
            article.fetch_status = "cleaned"
            log_event(
                logger,
                "fetch.article_cleaned",
                article_id=article.id,
                url=article.url,
                publisher=article.publisher,
                title=article.title,
                content_length=len(cleaned_text),
            )
            cleaned += 1

        unresolved_urls = set(batch_articles) - extracted_urls
        failed_urls.update(unresolved_urls)
        for failed_url in failed_urls:
            article = batch_articles.get(failed_url)
            if article is None or article.fetch_status == "cleaned":
                continue
            article.accessed_at = utcnow()
            article.fetch_status = "failed"
            log_event(
                logger,
                "fetch.article_failed",
                article_id=article.id,
                url=article.url,
                reason="extract_failed",
            )
            failed += 1

    session.commit()
    return {"cleaned": cleaned, "failed": failed}
