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


def success_payload(data: Any) -> dict[str, Any]:
    return Envelope(data=data).model_dump(mode="json")


def error_payload(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return Envelope(data=None, error=ErrorPayload(code=code, message=message, details=details)).model_dump(
        mode="json"
    )
