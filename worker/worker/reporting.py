from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Article, ArticleExtraction, Case, ReviewQueueItem


def grouped_counts(session: Session, model: type, field_name: str) -> dict[str, int]:
    field = getattr(model, field_name)
    rows = session.execute(select(field, func.count()).group_by(field).order_by(func.count().desc())).all()
    return {str(key): int(count) for key, count in rows}


def summarize_worker_state(session: Session, recent_limit: int = 10) -> dict[str, object]:
    recent_reviews = session.scalars(
        select(ReviewQueueItem).order_by(ReviewQueueItem.updated_at.desc()).limit(recent_limit)
    ).all()
    recent_cases = session.scalars(
        select(Case).order_by(Case.last_updated_at.desc()).limit(recent_limit)
    ).all()
    recent_articles = session.scalars(
        select(Article).order_by(Article.created_at.desc()).limit(recent_limit)
    ).all()

    return {
        "articles_by_status": grouped_counts(session, Article, "fetch_status"),
        "extractions_by_relevance": grouped_counts(session, ArticleExtraction, "relevance"),
        "review_queue_by_status": grouped_counts(session, ReviewQueueItem, "status"),
        "cases_by_publication_status": grouped_counts(session, Case, "publication_status"),
        "recent_review_items": [
            {
                "id": item.id,
                "entity_id": item.entity_id,
                "status": item.status,
                "reason_codes": item.reason_codes,
                "updated_at": item.updated_at.isoformat(),
            }
            for item in recent_reviews
        ],
        "recent_cases": [
            {
                "id": case.id,
                "slug": case.slug,
                "municipality_id": case.municipality_id,
                "publication_status": case.publication_status,
                "category": case.category,
                "last_updated_at": case.last_updated_at.isoformat(),
            }
            for case in recent_cases
        ],
        "recent_articles": [
            {
                "id": article.id,
                "title": article.title,
                "publisher": article.publisher,
                "fetch_status": article.fetch_status,
                "url": article.url,
            }
            for article in recent_articles
        ],
    }
