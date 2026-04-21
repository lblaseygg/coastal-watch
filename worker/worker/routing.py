from __future__ import annotations

from datetime import UTC, datetime
import re

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from worker.core.config import settings
from worker.bootstrap import BACKEND_ROOT  # noqa: F401
from worker.logging_utils import get_logger, log_event
from worker.utils import make_id, normalize_text, slugify, utcnow

from app.models import Article, ArticleExtraction, Case, Municipality, ReviewQueueItem, case_article_links


logger = get_logger("worker.routing")

TITLE_LINK_STOPWORDS = {
    "ante",
    "bajo",
    "costa",
    "costera",
    "contra",
    "desde",
    "donde",
    "entre",
    "hacia",
    "para",
    "playa",
    "playas",
    "proyecto",
    "sobre",
    "zona",
}


def unique_case_slug(session: Session, base_slug: str) -> str:
    slug = base_slug
    index = 2
    while session.scalar(select(Case).where(Case.slug == slug)) is not None:
        slug = f"{base_slug}-{index}"
        index += 1
    return slug


def normalize_title_tokens(value: str) -> set[str]:
    normalized = normalize_text(value)
    tokens = re.split(r"[^a-z0-9]+", normalized)
    return {
        token
        for token in tokens
        if len(token) > 3 and token not in TITLE_LINK_STOPWORDS
    }


def title_similarity(left: str, right: str) -> float:
    normalized_left = normalize_text(left)
    normalized_right = normalize_text(right)
    if normalized_left and normalized_right:
        if normalized_left in normalized_right or normalized_right in normalized_left:
            return 0.9

    left_tokens = normalize_title_tokens(left)
    right_tokens = normalize_title_tokens(right)
    if not left_tokens or not right_tokens:
        return 0.0

    intersection = len(left_tokens & right_tokens)
    union = len(left_tokens | right_tokens)
    return intersection / union if union else 0.0


def coerce_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def attach_article_to_case(linked_case: Case, article: Article, extraction: ArticleExtraction) -> None:
    if article.id not in linked_case.source_article_ids:
        linked_case.source_article_ids = [*linked_case.source_article_ids, article.id]
    if linked_case.id not in article.linked_case_ids:
        article.linked_case_ids = [*article.linked_case_ids, linked_case.id]
    if article not in linked_case.articles:
        linked_case.articles.append(article)
    linked_case.last_updated_at = max(
        coerce_utc(linked_case.last_updated_at),
        coerce_utc(article.published_at),
    )
    linked_case.confidence_score = max(linked_case.confidence_score, extraction.confidence_score)
    if linked_case.review_state == "pending_review":
        linked_case.internal_summary = extraction.extracted_summary


def find_duplicate_content_case(session: Session, article: Article) -> Case | None:
    if not article.content_hash:
        return None

    duplicate_articles = session.scalars(
        select(Article)
        .where(Article.content_hash == article.content_hash, Article.id != article.id)
        .order_by(Article.created_at.desc())
        .limit(5)
    ).all()

    for duplicate in duplicate_articles:
        for case_id in duplicate.linked_case_ids:
            linked = session.get(Case, case_id)
            if linked is not None:
                return linked

    return None


def best_candidate_case(
    session: Session,
    extraction: ArticleExtraction,
    article: Article,
) -> Case | None:
    if not extraction.municipality_ids:
        return None

    candidates = session.scalars(
        select(Case)
        .where(
            Case.municipality_id.in_(extraction.municipality_ids),
            Case.category == extraction.category,
        )
        .order_by(Case.last_updated_at.desc())
        .limit(settings.case_link_candidate_limit)
    ).all()

    best_case: Case | None = None
    best_score = 0.0
    for candidate in candidates:
        score = title_similarity(candidate.title, extraction.extracted_case_title)
        score = max(score, title_similarity(candidate.title, article.title))
        if article.id in candidate.source_article_ids:
            score = max(score, 1.0)
        if score > best_score:
            best_case = candidate
            best_score = score

    if best_score >= settings.case_link_min_similarity:
        return best_case

    return None


def find_linked_case(session: Session, article: Article, extraction: ArticleExtraction) -> Case | None:
    for case_id in article.linked_case_ids:
        linked = session.get(Case, case_id)
        if linked is not None:
            return linked

    duplicate_case = find_duplicate_content_case(session, article)
    if duplicate_case is not None:
        return duplicate_case

    exact = session.scalar(select(Case).where(Case.title == extraction.extracted_case_title))
    if exact is not None:
        return exact

    return best_candidate_case(session, extraction, article)


def ensure_case_candidate(
    session: Session,
    article: Article,
    extraction: ArticleExtraction,
    linked_case: Case | None,
) -> Case | None:
    if linked_case is not None:
        attach_article_to_case(linked_case, article, extraction)
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
    attach_article_to_case(candidate, article, extraction)
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


def publisher_is_trusted(article: Article) -> bool:
    publisher = normalize_text(article.publisher)
    return any(
        publisher.endswith(normalize_text(trusted_publisher))
        for trusted_publisher in settings.auto_publish_trusted_publishers
    )


def title_is_excluded(article: Article) -> bool:
    normalized_title = normalize_text(article.title)
    return any(
        normalize_text(keyword) in normalized_title
        for keyword in settings.auto_publish_excluded_title_keywords
    )


def can_auto_publish(article: Article, extraction: ArticleExtraction, linked_case: Case | None) -> bool:
    if linked_case is None:
        return False

    if extraction.relevance != "relevant":
        return False

    if not extraction.municipality_ids:
        return False

    if extraction.category not in settings.auto_publish_allowed_categories:
        return False

    if extraction.confidence_score < settings.auto_publish_min_confidence:
        return False

    if extraction.sensitive_flags:
        return False

    if not publisher_is_trusted(article):
        return False

    if title_is_excluded(article):
        return False

    return True


def auto_publish_blockers(
    article: Article,
    extraction: ArticleExtraction,
    linked_case: Case | None,
) -> list[str]:
    blockers: list[str] = []

    if linked_case is None:
        blockers.append("missing_case_link")
    if extraction.relevance != "relevant":
        blockers.append("relevance_not_relevant")
    if not extraction.municipality_ids:
        blockers.append("missing_municipality")
    if extraction.category not in settings.auto_publish_allowed_categories:
        blockers.append("category_not_allowed")
    if extraction.confidence_score < settings.auto_publish_min_confidence:
        blockers.append("below_confidence_threshold")
    if extraction.sensitive_flags:
        blockers.append("has_sensitive_flags")
    if not publisher_is_trusted(article):
        blockers.append("untrusted_publisher")
    if title_is_excluded(article):
        blockers.append("excluded_title")

    return blockers


def apply_auto_publish(current_case: Case, article: Article, extraction: ArticleExtraction) -> None:
    now = utcnow()
    current_case.publication_status = "approved"
    current_case.review_state = "approved"
    current_case.public_summary = extraction.extracted_summary
    current_case.internal_summary = extraction.extracted_summary
    current_case.review_reason_codes = ["auto_published", "trusted_source"]
    current_case.confidence_score = extraction.confidence_score
    current_case.last_updated_at = now

    if article.id not in current_case.source_article_ids:
        current_case.source_article_ids = [*current_case.source_article_ids, article.id]
    if current_case.id not in article.linked_case_ids:
        article.linked_case_ids = [*article.linked_case_ids, current_case.id]
    if article not in current_case.articles:
        current_case.articles.append(article)


def route_extractions(session: Session, limit: int = 20) -> dict[str, int]:
    queued_extractions = session.scalars(
        select(ArticleExtraction)
        .order_by(ArticleExtraction.created_at.asc())
        .limit(limit)
    ).all()

    existing_queue_entity_ids = set(session.scalars(select(ReviewQueueItem.entity_id)).all())
    created_review_items = 0
    created_cases = 0
    auto_published = 0

    for extraction in queued_extractions:
        if extraction.id in existing_queue_entity_ids:
            log_event(
                logger,
                "routing.article_skipped",
                extraction_id=extraction.id,
                article_id=extraction.article_id,
                reason="already_queued",
            )
            continue

        if extraction.relevance == "irrelevant":
            log_event(
                logger,
                "routing.article_rejected",
                extraction_id=extraction.id,
                article_id=extraction.article_id,
                relevance=extraction.relevance,
                category=extraction.category,
                municipality_ids=extraction.municipality_ids,
                confidence_score=extraction.confidence_score,
                reason_codes=extraction.sensitive_flags or ["irrelevant"],
            )
            continue

        article = session.get(Article, extraction.article_id)
        if article is None:
            continue

        linked_case = find_linked_case(session, article, extraction)
        prior_case_id = linked_case.id if linked_case is not None else None
        linked_case = ensure_case_candidate(session, article, extraction, linked_case)
        if linked_case is not None and linked_case.id != prior_case_id and linked_case.publication_status == "pending_review":
            created_cases += 1
            log_event(
                logger,
                "routing.case_candidate_created",
                case_id=linked_case.id,
                article_id=article.id,
                extraction_id=extraction.id,
                municipality_id=linked_case.municipality_id,
                category=linked_case.category,
            )

        if linked_case is not None and can_auto_publish(article, extraction, linked_case):
            apply_auto_publish(linked_case, article, extraction)
            extraction.needs_review = False
            now = utcnow()
            review_item = ReviewQueueItem(
                id=make_id("rev"),
                entity_type="article_extraction",
                entity_id=extraction.id,
                status="approved",
                reason_codes=["auto_published", "trusted_source"],
                editable_fields=[],
                assigned_to="worker",
                decision_notes="Automatically published from a trusted source after passing auto-publish rules.",
                audit_events=[
                    {
                        "action": "auto_approved",
                        "actor_id": "worker",
                        "at": now.isoformat().replace("+00:00", "Z"),
                        "note": "Trusted-source article was published automatically.",
                        "metadata": {
                            "confidence_score": extraction.confidence_score,
                            "publisher": article.publisher,
                        },
                    }
                ],
                created_at=now,
                updated_at=now,
            )
            session.add(review_item)
            log_event(
                logger,
                "routing.article_auto_published",
                article_id=article.id,
                extraction_id=extraction.id,
                case_id=linked_case.id,
                municipality_ids=extraction.municipality_ids,
                category=extraction.category,
                confidence_score=extraction.confidence_score,
                publisher=article.publisher,
                reason_codes=["auto_published", "trusted_source"],
            )
            auto_published += 1
            continue

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
        reason_codes = build_reason_codes(extraction, linked_case)
        log_event(
            logger,
            "routing.article_queued_for_review",
            article_id=article.id,
            extraction_id=extraction.id,
            case_id=linked_case.id if linked_case is not None else None,
            municipality_ids=extraction.municipality_ids,
            category=extraction.category,
            confidence_score=extraction.confidence_score,
            reason_codes=reason_codes,
            auto_publish_blockers=auto_publish_blockers(article, extraction, linked_case),
        )
        created_review_items += 1

    session.commit()
    return {
        "review_items": created_review_items,
        "case_candidates": created_cases,
        "auto_published": auto_published,
    }


def reset_extraction_state(session: Session) -> dict[str, int]:
    article_count = 0
    for article in session.scalars(select(Article)).all():
        article.linked_case_ids = []
        article_count += 1

    review_item_count = session.scalar(select(func.count()).select_from(ReviewQueueItem)) or 0
    extraction_count = session.scalar(select(func.count()).select_from(ArticleExtraction)) or 0
    case_count = session.scalar(select(func.count()).select_from(Case)) or 0

    session.execute(delete(case_article_links))
    session.execute(delete(ReviewQueueItem))
    session.execute(delete(ArticleExtraction))
    session.execute(delete(Case))
    session.commit()

    return {
        "articles_reset": article_count,
        "review_items_cleared": int(review_item_count),
        "extractions_cleared": int(extraction_count),
        "cases_cleared": int(case_count),
    }
