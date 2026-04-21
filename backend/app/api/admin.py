from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from secrets import compare_digest
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4

import hashlib
import re

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.public import serialize_case
from app.core.config import settings
from app.core.rate_limit import InMemoryRateLimiter
from app.db.session import get_db
from app.models import Article, ArticleExtraction, Case, Municipality, ReviewQueueItem
from app.schemas import (
    AdminArticleDetail,
    AdminArticleExtractionClaim,
    AdminArticleExtractionDetail,
    AdminReviewQueueItemDetail,
    AuditEvent,
    ManualCaseCreateInput,
    ReviewDecisionInput,
    ReviewQueueItemSummary,
    success_payload,
)


router = APIRouter(prefix="/admin", tags=["admin"])
bearer_scheme = HTTPBearer(auto_error=False)
DECISION_STATUS_MAP = {"approve": "approved", "reject": "rejected", "needs_edit": "needs_edit"}
admin_request_limiter = InMemoryRateLimiter(
    max_requests=settings.admin_rate_limit_max_requests,
    window_seconds=settings.admin_rate_limit_window_seconds,
)
admin_auth_failure_limiter = InMemoryRateLimiter(
    max_requests=settings.admin_auth_rate_limit_max_attempts,
    window_seconds=settings.admin_auth_rate_limit_window_seconds,
)


@dataclass
class AdminIdentity:
    actor_id: str


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def slugify(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return normalized or f"case-{uuid4().hex[:8]}"


def unique_case_slug(db: Session, title: str) -> str:
    base_slug = slugify(title)
    slug = base_slug
    suffix = 2

    while db.scalar(select(Case.id).where(Case.slug == slug)) is not None:
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    return slug


def normalize_publisher(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    return host or "manual-source"


def is_manual_case(current_case: Case) -> bool:
    return "manual_admin_entry" in (current_case.review_reason_codes or []) or "manual-entry" in (
        current_case.tags or []
    )


def get_primary_case_article(current_case: Case) -> Article | None:
    if not current_case.articles:
        return None

    return sorted(current_case.articles, key=lambda article: article.published_at)[0]


def serialize_manual_case(current_case: Case) -> dict[str, Any]:
    source_article = get_primary_case_article(current_case)
    return {
        "case": serialize_case(current_case),
        "municipality_name": current_case.municipality.name if current_case.municipality else current_case.municipality_id,
        "source": serialize_article_detail(source_article) if source_article is not None else None,
    }


def client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        first = forwarded_for.split(",")[0].strip()
        if first:
            return first

    if request.client and request.client.host:
        return request.client.host

    return "unknown"


def require_admin(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    x_admin_actor: str | None = Header(default=None),
) -> AdminIdentity:
    remote_addr = client_ip(request)

    if not admin_request_limiter.allow(remote_addr):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many admin requests. Try again shortly.",
        )

    if not settings.admin_api_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin API is not configured.",
        )

    if credentials is None or credentials.scheme.lower() != "bearer":
        if not admin_auth_failure_limiter.allow(remote_addr):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed admin authentication attempts. Try again later.",
            )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing admin token")

    if not compare_digest(credentials.credentials, settings.admin_api_token):
        if not admin_auth_failure_limiter.allow(remote_addr):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed admin authentication attempts. Try again later.",
            )
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


def serialize_article_detail(article: Article) -> dict[str, Any]:
    return AdminArticleDetail(
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
            serialize_article_detail(article)
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
    article: Article | None,
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
        if article is not None:
            if article.id not in current_case.source_article_ids:
                current_case.source_article_ids = [*current_case.source_article_ids, article.id]
            if current_case.id not in article.linked_case_ids:
                article.linked_case_ids = [*article.linked_case_ids, current_case.id]
            if article not in current_case.articles:
                current_case.articles.append(article)
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
    article: Article | None = None
    linked_case: Case | None = None
    if item.entity_type == "article_extraction":
        extraction = db.get(ArticleExtraction, item.entity_id)
        if extraction is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Linked extraction not found")

        applied_fields = apply_extraction_edits(extraction, item, payload.edits)
        extraction.needs_review = decision_status != "approved"
        article = db.get(Article, extraction.article_id)
        linked_case = resolve_case_for_extraction(db, extraction)
        update_linked_case(linked_case, article, extraction, item, payload, decision_status, now)

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
    if article is not None:
        db.add(article)
    if linked_case is not None:
        db.add(linked_case)

    db.commit()
    db.refresh(item)

    return success_payload({"item": serialize_review_detail(db, item)})


@router.post("/cases/manual")
def create_manual_case(
    payload: ManualCaseCreateInput,
    db: Session = Depends(get_db),
    admin: AdminIdentity = Depends(require_admin),
) -> dict[str, Any]:
    municipality = db.get(Municipality, payload.municipality_id)
    if municipality is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Municipality not found")

    last_reported_at = payload.last_reported_at or payload.first_reported_at

    if last_reported_at < payload.first_reported_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Last reported date must be on or after first reported date",
        )

    now = utcnow()
    article = db.scalar(select(Article).where(Article.url == payload.source_url))
    article_id = article.id if article is not None else f"art_{uuid4().hex[:10]}"
    content_hash = hashlib.sha256(
        f"{payload.title}\n{payload.summary}\n{payload.source_url}".encode("utf-8")
    ).hexdigest()

    if article is None:
        article = Article(
            id=article_id,
            url=payload.source_url,
            publisher=normalize_publisher(payload.source_url),
            title=payload.source_title.strip(),
            published_at=payload.first_reported_at,
            accessed_at=now,
            language="es",
            fetch_status="cleaned",
            content_hash=content_hash,
            cleaned_text=payload.summary.strip(),
            linked_case_ids=[],
        )
    else:
        article.publisher = normalize_publisher(payload.source_url)
        article.title = payload.source_title.strip()
        article.published_at = payload.first_reported_at
        article.accessed_at = now
        article.fetch_status = "cleaned"
        article.content_hash = content_hash
        article.cleaned_text = payload.summary.strip()

    manual_reason_codes = ["manual_admin_entry"]
    case_id = f"case_{uuid4().hex[:10]}"
    current_case = Case(
        id=case_id,
        slug=unique_case_slug(db, payload.title),
        title=payload.title.strip(),
        municipality_id=municipality.id,
        status=payload.status,
        publication_status="approved",
        review_state="approved",
        category=payload.category,
        tags=["manual-entry"],
        public_summary=payload.summary.strip(),
        internal_summary=f"Manual case created by {admin.actor_id}",
        location_lat=municipality.centroid_lat,
        location_lng=municipality.centroid_lng,
        location_precision="municipality",
        first_reported_at=payload.first_reported_at,
        last_updated_at=last_reported_at,
        source_article_ids=[article.id],
        review_reason_codes=manual_reason_codes,
        confidence_score=1.0,
    )

    current_case.articles.append(article)
    if current_case.id not in article.linked_case_ids:
        article.linked_case_ids = [*article.linked_case_ids, current_case.id]

    db.add(article)
    db.add(current_case)
    db.commit()
    db.refresh(current_case)
    db.refresh(article)

    return success_payload(
        {
            "case": serialize_case(current_case),
            "article": serialize_article_detail(article),
        }
    )


@router.get("/cases/manual")
def list_manual_cases(
    db: Session = Depends(get_db),
    _: AdminIdentity = Depends(require_admin),
) -> dict[str, Any]:
    cases = db.scalars(
        select(Case)
        .options(selectinload(Case.articles), selectinload(Case.municipality))
        .order_by(Case.last_updated_at.desc(), Case.first_reported_at.desc())
    ).all()

    items: list[dict[str, Any]] = []
    for current_case in cases:
        if not is_manual_case(current_case):
            continue
        items.append(serialize_manual_case(current_case))

    return success_payload({"items": items})


@router.get("/cases/manual/{case_id}")
def get_manual_case(
    case_id: str,
    db: Session = Depends(get_db),
    _: AdminIdentity = Depends(require_admin),
) -> dict[str, Any]:
    current_case = db.scalar(
        select(Case)
        .options(selectinload(Case.articles), selectinload(Case.municipality))
        .where(Case.id == case_id)
    )
    if current_case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manual case not found")

    if not is_manual_case(current_case):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Case is not a manual admin entry")

    return success_payload({"item": serialize_manual_case(current_case)})


@router.put("/cases/manual/{case_id}")
def update_manual_case(
    case_id: str,
    payload: ManualCaseCreateInput,
    db: Session = Depends(get_db),
    admin: AdminIdentity = Depends(require_admin),
) -> dict[str, Any]:
    current_case = db.scalar(
        select(Case)
        .options(selectinload(Case.articles), selectinload(Case.municipality))
        .where(Case.id == case_id)
    )
    if current_case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manual case not found")

    if not is_manual_case(current_case):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Case is not a manual admin entry")

    municipality = db.get(Municipality, payload.municipality_id)
    if municipality is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Municipality not found")

    last_reported_at = payload.last_reported_at or payload.first_reported_at
    if last_reported_at < payload.first_reported_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Last reported date must be on or after first reported date",
        )

    article = get_primary_case_article(current_case)
    now = utcnow()
    content_hash = hashlib.sha256(
        f"{payload.title}\n{payload.summary}\n{payload.source_url}".encode("utf-8")
    ).hexdigest()

    if article is None:
        article = Article(
            id=f"art_{uuid4().hex[:10]}",
            url=payload.source_url,
            publisher=normalize_publisher(payload.source_url),
            title=payload.source_title.strip(),
            published_at=payload.first_reported_at,
            accessed_at=now,
            language="es",
            fetch_status="cleaned",
            content_hash=content_hash,
            cleaned_text=payload.summary.strip(),
            linked_case_ids=[current_case.id],
        )
        current_case.articles.append(article)
    else:
        if article.url != payload.source_url:
            conflicting_article = db.scalar(select(Article).where(Article.url == payload.source_url))
            if conflicting_article is not None and conflicting_article.id != article.id:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Another article already uses that source URL",
                )

        article.url = payload.source_url
        article.publisher = normalize_publisher(payload.source_url)
        article.title = payload.source_title.strip()
        article.published_at = payload.first_reported_at
        article.accessed_at = now
        article.fetch_status = "cleaned"
        article.content_hash = content_hash
        article.cleaned_text = payload.summary.strip()
        if current_case.id not in article.linked_case_ids:
            article.linked_case_ids = [*article.linked_case_ids, current_case.id]

    current_case.title = payload.title.strip()
    current_case.municipality_id = municipality.id
    current_case.status = payload.status
    current_case.category = payload.category
    current_case.public_summary = payload.summary.strip()
    current_case.internal_summary = f"Manual case updated by {admin.actor_id}"
    current_case.location_lat = municipality.centroid_lat
    current_case.location_lng = municipality.centroid_lng
    current_case.location_precision = "municipality"
    current_case.first_reported_at = payload.first_reported_at
    current_case.last_updated_at = last_reported_at
    current_case.source_article_ids = [article.id]
    current_case.review_reason_codes = ["manual_admin_entry"]
    current_case.tags = ["manual-entry"]
    current_case.confidence_score = 1.0

    db.add(article)
    db.add(current_case)
    db.commit()
    db.refresh(current_case)
    db.refresh(article)

    return success_payload({"item": serialize_manual_case(current_case)})


@router.delete("/cases/manual/{case_id}")
def delete_manual_case(
    case_id: str,
    db: Session = Depends(get_db),
    _: AdminIdentity = Depends(require_admin),
) -> dict[str, Any]:
    current_case = db.scalar(select(Case).options(selectinload(Case.articles)).where(Case.id == case_id))
    if current_case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manual case not found")

    if not is_manual_case(current_case):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Case is not a manual admin entry")

    linked_articles = list(current_case.articles)
    for article in linked_articles:
        article.linked_case_ids = [linked_case_id for linked_case_id in (article.linked_case_ids or []) if linked_case_id != current_case.id]
        if current_case in article.cases:
            article.cases.remove(current_case)
        db.add(article)

    db.delete(current_case)
    db.flush()

    for article in linked_articles:
        db.refresh(article)
        if not article.linked_case_ids and not article.cases:
            db.delete(article)

    db.commit()
    return success_payload({"deleted_case_id": case_id})
