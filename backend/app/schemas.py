from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ErrorPayload(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None


class MetaPayload(BaseModel):
    schema_version: str = "phase0-v1"
    request_id: str = Field(default_factory=lambda: f"req_{uuid4().hex[:12]}")
    generated_at: datetime = Field(default_factory=utcnow)


class Envelope(BaseModel):
    data: Any
    meta: MetaPayload = Field(default_factory=MetaPayload)
    error: ErrorPayload | None = None


class Point(BaseModel):
    lat: float
    lng: float


class CaseLocation(Point):
    precision: str


class MunicipalityMapItem(BaseModel):
    id: str
    name: str
    geojson_key: str
    centroid: Point
    case_counts: dict[str, int]
    highlight_status: str


class PublicCaseSummary(BaseModel):
    id: str
    slug: str
    title: str
    municipality_id: str
    status: str
    category: str
    tags: list[str]
    public_summary: str
    location: CaseLocation
    first_reported_at: datetime
    last_updated_at: datetime


class PublicSource(BaseModel):
    id: str
    url: str
    publisher: str
    title: str
    published_at: datetime


class AuditEvent(BaseModel):
    action: str
    actor_id: str
    at: datetime
    note: str | None = None
    metadata: dict[str, Any] | None = None


class ReviewQueueItemSummary(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    status: str
    reason_codes: list[str]
    editable_fields: list[str]
    assigned_to: str | None = None
    decision_notes: str | None = None
    created_at: datetime
    updated_at: datetime


class AdminArticleExtractionClaim(BaseModel):
    text: str
    evidence_snippet: str
    sensitive: bool


class AdminArticleExtractionDetail(BaseModel):
    id: str
    article_id: str
    schema_version: str
    relevance: str
    confidence_score: float
    extracted_case_title: str
    extracted_summary: str
    category: str
    municipality_ids: list[str]
    claims: list[AdminArticleExtractionClaim]
    sensitive_flags: list[str]
    needs_review: bool
    model_name: str
    created_at: datetime


class AdminArticleDetail(BaseModel):
    id: str
    url: str
    publisher: str
    title: str
    published_at: datetime
    accessed_at: datetime
    language: str
    fetch_status: str
    linked_case_ids: list[str]
    cleaned_text: str


class AdminReviewQueueItemDetail(ReviewQueueItemSummary):
    audit_events: list[AuditEvent]
    extraction: AdminArticleExtractionDetail | None = None
    article: AdminArticleDetail | None = None
    linked_case: PublicCaseSummary | None = None


class ReviewDecisionInput(BaseModel):
    action: str
    note: str | None = None
    assigned_to: str | None = None
    edits: dict[str, Any] = Field(default_factory=dict)


def success_payload(data: Any) -> dict[str, Any]:
    return Envelope(data=data).model_dump(mode="json")


def error_payload(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return Envelope(data=None, error=ErrorPayload(code=code, message=message, details=details)).model_dump(
        mode="json"
    )
