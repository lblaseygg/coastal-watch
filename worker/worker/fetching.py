from __future__ import annotations

from dataclasses import dataclass

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.orm import Session

from worker.bootstrap import BACKEND_ROOT  # noqa: F401
from worker.core.config import settings
from worker.utils import sha256_text, utcnow

from app.models import Article


def clean_html_document(html: str) -> tuple[str, str | None, str | None]:
    soup = BeautifulSoup(html, "html.parser")

    for tag in soup(["script", "style", "noscript", "svg", "iframe"]):
        tag.decompose()

    title = soup.title.string.strip() if soup.title and soup.title.string else None
    language = soup.html.get("lang") if soup.html else None

    blocks: list[str] = []
    for node in soup.find_all(["p", "li", "h1", "h2", "h3"]):
        text = " ".join(node.get_text(" ", strip=True).split())
        if len(text) >= 40:
            blocks.append(text)

    if not blocks:
        body_text = " ".join(soup.get_text(" ", strip=True).split())
        blocks = [body_text] if body_text else []

    cleaned_text = "\n\n".join(dict.fromkeys(blocks)).strip()
    return cleaned_text[:20000], title, language


def fetch_queued_articles(session: Session, limit: int = 10) -> dict[str, int]:
    articles = session.scalars(
        select(Article)
        .where(Article.fetch_status.in_(["queued", "failed"]))
        .order_by(Article.created_at.asc())
        .limit(limit)
    ).all()

    if not articles:
        return {"cleaned": 0, "failed": 0}

    cleaned = 0
    failed = 0
    with httpx.Client(
        headers={"User-Agent": settings.worker_user_agent},
        follow_redirects=True,
        timeout=30.0,
    ) as client:
        for article in articles:
            try:
                response = client.get(article.url)
                response.raise_for_status()
                cleaned_text, title, language = clean_html_document(response.text)
                if not cleaned_text:
                    raise ValueError("No readable content found")

                article.url = str(response.url)
                article.title = (title or article.title)[:500]
                article.language = (language or article.language or "und")[:16]
                article.cleaned_text = cleaned_text
                article.content_hash = sha256_text(cleaned_text)
                article.accessed_at = utcnow()
                article.fetch_status = "cleaned"
                cleaned += 1
            except Exception:
                article.accessed_at = utcnow()
                article.fetch_status = "failed"
                failed += 1

    session.commit()
    return {"cleaned": cleaned, "failed": failed}
