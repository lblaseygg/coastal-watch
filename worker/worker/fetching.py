from __future__ import annotations

from dataclasses import dataclass
from html import unescape
import logging
import re

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from worker.bootstrap import BACKEND_ROOT  # noqa: F401
from worker.core.config import settings
from worker.logging_utils import get_logger, log_event
from worker.utils import infer_publisher_from_url, sha256_text, utcnow

from app.models import Article


logger = get_logger("worker.fetching")


@dataclass
class ExtractResult:
    url: str
    raw_content: str
    title: str | None = None


class HttpExtractClient:
    def __init__(self) -> None:
        timeout = settings.fetch_timeout if settings.fetch_timeout is not None else 20.0
        self._client = httpx.Client(
            follow_redirects=True,
            timeout=timeout,
            headers={
                "User-Agent": settings.worker_user_agent,
                "Accept-Language": "es,en;q=0.9",
            },
        )

    def extract(self, urls: list[str]) -> tuple[list[ExtractResult], set[str]]:
        results: list[ExtractResult] = []
        failed_urls: set[str] = set()

        for url in urls:
            try:
                response = self._client.get(url)
                response.raise_for_status()
            except Exception:
                failed_urls.add(url)
                continue

            if is_unsupported_content(response):
                failed_urls.add(url)
                log_event(
                    logger,
                    "fetch.article_skipped",
                    article_url=url,
                    reason="unsupported_content_type",
                    content_type=response.headers.get("content-type", ""),
                )
                continue

            raw_content, title = extract_readable_text(response.text)
            if not raw_content:
                failed_urls.add(url)
                continue

            results.append(
                ExtractResult(
                    url=url,
                    raw_content=raw_content,
                    title=title,
                )
            )

        return results, failed_urls


def extract_with_retry(client: HttpExtractClient, urls: list[str]) -> tuple[list[ExtractResult], set[str]]:
    last_error: Exception | None = None
    attempts = max(1, settings.fetch_retry_attempts)

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
    cleaned_text = content.replace("\x00", "").strip()
    return cleaned_text[:20000]


def is_unsupported_content(response: httpx.Response) -> bool:
    content_type = (response.headers.get("content-type") or "").lower()
    if "application/pdf" in content_type:
        return True
    if "application/octet-stream" in content_type:
        return True
    if response.url.path.lower().endswith(".pdf"):
        return True
    if response.content.startswith(b"%PDF"):
        return True
    return False


def extract_readable_text(html: str) -> tuple[str, str | None]:
    html = html.replace("\x00", "")
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    title = unescape(title_match.group(1)).strip() if title_match else None

    stripped = re.sub(r"(?is)<(script|style|noscript|svg|iframe).*?>.*?</\1>", " ", html)
    stripped = re.sub(r"(?i)<br\s*/?>", "\n", stripped)
    stripped = re.sub(r"(?i)</p>", "\n", stripped)
    stripped = re.sub(r"<[^>]+>", " ", stripped)
    stripped = unescape(stripped)
    stripped = re.sub(r"\s+", " ", stripped).strip()
    return stripped[:40000], title[:500] if title else None


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

    client = HttpExtractClient()
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
