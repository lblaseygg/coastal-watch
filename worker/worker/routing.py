from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from worker.bootstrap import BACKEND_ROOT  # noqa: F401
from worker.utils import make_id, slugify, utcnow

from app.models import Article, ArticleExtraction, Case, Municipality, ReviewQueueItem


def unique_case_slug(session: Session, base_slug: str) -> str:
    slug = base_slug
    index = 2
    while session.scalar(select(Case).where(Case.slug == slug)) is not None:
        slug = f"{base_slug}-{index}"
        index += 1
    return slug


def find_linked_case(session: Session, article: Article, extraction: ArticleExtraction) -> Case | None:
    for case_id in article.linked_case_ids:
        linked = session.get(Case, case_id)
        if linked is not None:
            return linked

    exact = session.scalar(select(Case).where(Case.title == extraction.extracted_case_title))
    if exact is not None:
        return exact

    if extraction.municipality_ids:
        return session.scalar(
            select(Case)
            .where(
                Case.municipality_id == extraction.municipality_ids[0],
                Case.category == extraction.category,
            )
            .order_by(Case.last_updated_at.desc())
        )

    return None


def ensure_case_candidate(
    session: Session,
    article: Article,
    extraction: ArticleExtraction,
    linked_case: Case | None,
) -> Case | None:
    if linked_case is not None:
        article.linked_case_ids = [linked_case.id]
        return linked_case

    if not extraction.municipality_ids:
        article.linked_case_ids = []
        return None

    municipality = session.get(Municipality, extraction.municipality_ids[0])
    if municipality is None:
        return None

    now = utcnow()
    slug = unique_case_slug(session, slugify(extraction.extracted_case_title))
    candidate = Case(
        id=make_id("case"),
        slug=slug,
        title=extraction.extracted_case_title[:255],
        municipality_id=municipality.id,
        status="reported",
        publication_status="pending_review",
        review_state="pending_review",
        category=extraction.category,
        tags=[slugify(extraction.category.replace("_", " ")) or extraction.category],
        public_summary="A newly discovered article is under review and is not yet eligible for publication.",
        internal_summary=extraction.extracted_summary,
        location_lat=municipality.centroid_lat,
        location_lng=municipality.centroid_lng,
        location_precision="municipality",
        first_reported_at=article.published_at,
        last_updated_at=now,
        source_article_ids=[article.id],
        review_reason_codes=extraction.sensitive_flags,
        confidence_score=extraction.confidence_score,
    )
    candidate.articles.append(article)
    article.linked_case_ids = [candidate.id]
    session.add(candidate)
    return candidate


def build_reason_codes(extraction: ArticleExtraction, linked_case: Case | None) -> list[str]:
    codes = list(extraction.sensitive_flags)
    codes.append("case_update_candidate" if linked_case is not None else "new_case_candidate")
    if extraction.relevance != "relevant":
        codes.append("low_confidence_relevance")
    if extraction.confidence_score < 0.78:
        codes.append("low_confidence_extraction")
    return sorted(set(codes))


def route_extractions(session: Session, limit: int = 20) -> dict[str, int]:
    queued_extractions = session.scalars(
        select(ArticleExtraction)
        .order_by(ArticleExtraction.created_at.asc())
        .limit(limit)
    ).all()

    existing_queue_entity_ids = set(session.scalars(select(ReviewQueueItem.entity_id)).all())
    created_review_items = 0
    created_cases = 0

    for extraction in queued_extractions:
        if extraction.id in existing_queue_entity_ids or extraction.relevance == "irrelevant":
            continue

        article = session.get(Article, extraction.article_id)
        if article is None:
            continue

        linked_case = find_linked_case(session, article, extraction)
        prior_case_id = linked_case.id if linked_case is not None else None
        linked_case = ensure_case_candidate(session, article, extraction, linked_case)
        if linked_case is not None and linked_case.id != prior_case_id and linked_case.publication_status == "pending_review":
            created_cases += 1

        now = utcnow()
        review_item = ReviewQueueItem(
            id=make_id("rev"),
            entity_type="article_extraction",
            entity_id=extraction.id,
            status="pending_review",
            reason_codes=build_reason_codes(extraction, linked_case),
            editable_fields=["extracted_case_title", "extracted_summary", "category", "municipality_ids", "claims"],
            assigned_to=None,
            decision_notes=None,
            audit_events=[
                {
                    "action": "created",
                    "actor_id": "worker",
                    "at": now.isoformat().replace("+00:00", "Z"),
                    "note": "Queued by the ingestion worker pending editorial review.",
                }
            ],
            created_at=now,
            updated_at=now,
        )
        session.add(review_item)
        created_review_items += 1

    session.commit()
    return {"review_items": created_review_items, "case_candidates": created_cases}
