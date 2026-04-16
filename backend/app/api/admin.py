from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.public import serialize_case
from app.core.config import settings
from app.db.session import get_db
from app.models import Article, ArticleExtraction, Case, ReviewQueueItem
from app.schemas import (
    AdminArticleDetail,
    AdminArticleExtractionClaim,
    AdminArticleExtractionDetail,
    AdminReviewQueueItemDetail,
    AuditEvent,
    ReviewDecisionInput,
    ReviewQueueItemSummary,
    success_payload,
)


router = APIRouter(prefix="/admin", tags=["admin"])
bearer_scheme = HTTPBearer(auto_error=False)
DECISION_STATUS_MAP = {"approve": "approved", "reject": "rejected", "needs_edit": "needs_edit"}


@dataclass
class AdminIdentity:
    actor_id: str


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    x_admin_actor: str | None = Header(default=None),
) -> AdminIdentity:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing admin token")

    if credentials.credentials != settings.admin_api_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin token")

    actor_id = (x_admin_actor or "").strip() or "admin"
    return AdminIdentity(actor_id=actor_id[:100])


def serialize_review_summary(item: ReviewQueueItem) -> dict[str, Any]:
    return ReviewQueueItemSummary(
        id=item.id,
        entity_type=item.entity_type,
        entity_id=item.entity_id,
        status=item.status,
        reason_codes=item.reason_codes,
        editable_fields=item.editable_fields,
        assigned_to=item.assigned_to,
        decision_notes=item.decision_notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    ).model_dump(mode="json")


def resolve_case_for_extraction(db: Session, extraction: ArticleExtraction) -> Case | None:
    article = db.get(Article, extraction.article_id)
    if article is not None and article.linked_case_ids:
        linked_case = db.get(Case, article.linked_case_ids[0])
        if linked_case is not None:
            return linked_case

    return db.scalar(select(Case).where(Case.title == extraction.extracted_case_title))


def serialize_review_detail(db: Session, item: ReviewQueueItem) -> dict[str, Any]:
    extraction: ArticleExtraction | None = None
    article: Article | None = None
    linked_case: Case | None = None

    if item.entity_type == "article_extraction":
        extraction = db.get(ArticleExtraction, item.entity_id)
        if extraction is not None:
            article = db.get(Article, extraction.article_id)
            linked_case = resolve_case_for_extraction(db, extraction)

    audit_events = [AuditEvent.model_validate(event).model_dump(mode="json") for event in item.audit_events]

    return AdminReviewQueueItemDetail(
        **serialize_review_summary(item),
        audit_events=audit_events,
        extraction=(
            AdminArticleExtractionDetail(
                id=extraction.id,
                article_id=extraction.article_id,
                schema_version=extraction.schema_version,
                relevance=extraction.relevance,
                confidence_score=extraction.confidence_score,
                extracted_case_title=extraction.extracted_case_title,
                extracted_summary=extraction.extracted_summary,
                category=extraction.category,
                municipality_ids=extraction.municipality_ids,
                claims=[
                    AdminArticleExtractionClaim.model_validate(claim).model_dump(mode="json")
                    for claim in extraction.claims
                ],
                sensitive_flags=extraction.sensitive_flags,
                needs_review=extraction.needs_review,
                model_name=extraction.model_name,
                created_at=extraction.created_at,
            ).model_dump(mode="json")
            if extraction is not None
            else None
        ),
        article=(
            AdminArticleDetail(
                id=article.id,
                url=article.url,
                publisher=article.publisher,
                title=article.title,
                published_at=article.published_at,
                accessed_at=article.accessed_at,
                language=article.language,
                fetch_status=article.fetch_status,
                linked_case_ids=article.linked_case_ids,
                cleaned_text=article.cleaned_text,
            ).model_dump(mode="json")
            if article is not None
            else None
        ),
        linked_case=serialize_case(linked_case) if linked_case is not None else None,
    ).model_dump(mode="json")


def apply_extraction_edits(
    extraction: ArticleExtraction,
    queue_item: ReviewQueueItem,
    edits: dict[str, Any],
) -> list[str]:
    if not edits:
        return []

    allowed_fields = set(queue_item.editable_fields)
    invalid_fields = sorted(set(edits) - allowed_fields)
    if invalid_fields:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported edit fields: {', '.join(invalid_fields)}",
        )

    applied_fields: list[str] = []
    for field_name, value in edits.items():
        if not hasattr(extraction, field_name):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Extraction field cannot be edited: {field_name}",
            )

        setattr(extraction, field_name, value)
        applied_fields.append(field_name)

    return applied_fields


def update_linked_case(
    current_case: Case | None,
    extraction: ArticleExtraction,
    queue_item: ReviewQueueItem,
    payload: ReviewDecisionInput,
    decision_status: str,
    now: datetime,
) -> None:
    if current_case is None:
        return

    if decision_status == "approved":
        current_case.publication_status = "approved"
        current_case.review_state = "approved"
        current_case.public_summary = extraction.extracted_summary
        current_case.review_reason_codes = queue_item.reason_codes
        current_case.confidence_score = extraction.confidence_score
    elif decision_status == "rejected":
        current_case.publication_status = "rejected"
        current_case.review_state = "rejected"
    else:
        current_case.publication_status = "pending_review"
        current_case.review_state = "needs_edit"

    if payload.note:
        current_case.internal_summary = payload.note

    current_case.last_updated_at = now


@router.get("/review-items")
def list_review_items(
    review_status: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    _: AdminIdentity = Depends(require_admin),
) -> dict[str, Any]:
    query = select(ReviewQueueItem).order_by(ReviewQueueItem.updated_at.desc(), ReviewQueueItem.created_at.desc())

    if review_status and review_status != "all":
        query = query.where(ReviewQueueItem.status == review_status)

    items = [serialize_review_summary(item) for item in db.scalars(query).all()]
    return success_payload({"items": items})


@router.get("/review-items/{item_id}")
def get_review_item(
    item_id: str,
    db: Session = Depends(get_db),
    _: AdminIdentity = Depends(require_admin),
) -> dict[str, Any]:
    item = db.scalar(select(ReviewQueueItem).where(ReviewQueueItem.id == item_id))
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review item not found")

    return success_payload({"item": serialize_review_detail(db, item)})


@router.post("/review-items/{item_id}/decision")
def submit_review_decision(
    item_id: str,
    payload: ReviewDecisionInput,
    db: Session = Depends(get_db),
    admin: AdminIdentity = Depends(require_admin),
) -> dict[str, Any]:
    decision_status = DECISION_STATUS_MAP.get(payload.action)
    if decision_status is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported review action")

    item = db.get(ReviewQueueItem, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review item not found")

    now = utcnow()
    applied_fields: list[str] = []

    if payload.assigned_to is not None:
        item.assigned_to = payload.assigned_to.strip() or None

    extraction: ArticleExtraction | None = None
    linked_case: Case | None = None
    if item.entity_type == "article_extraction":
        extraction = db.get(ArticleExtraction, item.entity_id)
        if extraction is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Linked extraction not found")

        applied_fields = apply_extraction_edits(extraction, item, payload.edits)
        extraction.needs_review = decision_status != "approved"
        linked_case = resolve_case_for_extraction(db, extraction)
        update_linked_case(linked_case, extraction, item, payload, decision_status, now)

    item.status = decision_status
    item.decision_notes = payload.note.strip() if payload.note else None
    item.updated_at = now
    item.audit_events = [
        *item.audit_events,
        AuditEvent(
            action=decision_status,
            actor_id=admin.actor_id,
            at=now,
            note=item.decision_notes,
            metadata={"edited_fields": applied_fields} if applied_fields else None,
        ).model_dump(mode="json"),
    ]

    db.add(item)
    if extraction is not None:
        db.add(extraction)
    if linked_case is not None:
        db.add(linked_case)

    db.commit()
    db.refresh(item)

    return success_payload({"item": serialize_review_detail(db, item)})
