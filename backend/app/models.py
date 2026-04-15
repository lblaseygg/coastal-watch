from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, Column, Float, ForeignKey, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


case_article_links = Table(
    "case_article_links",
    Base.metadata,
    Column("case_id", String(100), ForeignKey("cases.id", ondelete="CASCADE"), primary_key=True),
    Column("article_id", String(100), ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True),
)


class Municipality(Base):
    __tablename__ = "municipalities"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    region: Mapped[str] = mapped_column(String(100))
    coastal: Mapped[bool] = mapped_column(Boolean, default=True)
    centroid_lat: Mapped[float] = mapped_column(Float)
    centroid_lng: Mapped[float] = mapped_column(Float)
    geojson_key: Mapped[str] = mapped_column(String(100), unique=True)

    cases: Mapped[list["Case"]] = relationship(back_populates="municipality")


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True)
    title: Mapped[str] = mapped_column(String(255))
    municipality_id: Mapped[str] = mapped_column(ForeignKey("municipalities.id"))
    status: Mapped[str] = mapped_column(String(50))
    publication_status: Mapped[str] = mapped_column(String(50))
    review_state: Mapped[str] = mapped_column(String(50))
    category: Mapped[str] = mapped_column(String(100))
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    public_summary: Mapped[str] = mapped_column(Text)
    internal_summary: Mapped[str] = mapped_column(Text)
    location_lat: Mapped[float] = mapped_column(Float)
    location_lng: Mapped[float] = mapped_column(Float)
    location_precision: Mapped[str] = mapped_column(String(50))
    first_reported_at: Mapped[datetime]
    last_updated_at: Mapped[datetime]
    source_article_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    review_reason_codes: Mapped[list[str]] = mapped_column(JSON, default=list)
    confidence_score: Mapped[float] = mapped_column(Float)

    municipality: Mapped[Municipality] = relationship(back_populates="cases")
    articles: Mapped[list["Article"]] = relationship(
        secondary=case_article_links,
        back_populates="cases",
    )


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    url: Mapped[str] = mapped_column(Text, unique=True)
    publisher: Mapped[str] = mapped_column(String(255))
    title: Mapped[str] = mapped_column(String(500))
    published_at: Mapped[datetime]
    accessed_at: Mapped[datetime]
    language: Mapped[str] = mapped_column(String(16))
    fetch_status: Mapped[str] = mapped_column(String(50))
    content_hash: Mapped[str] = mapped_column(String(255))
    cleaned_text: Mapped[str] = mapped_column(Text)
    linked_case_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    cases: Mapped[list[Case]] = relationship(
        secondary=case_article_links,
        back_populates="articles",
    )
    extractions: Mapped[list["ArticleExtraction"]] = relationship(back_populates="article")


class ArticleExtraction(Base):
    __tablename__ = "article_extractions"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    article_id: Mapped[str] = mapped_column(ForeignKey("articles.id"))
    schema_version: Mapped[str] = mapped_column(String(50))
    relevance: Mapped[str] = mapped_column(String(50))
    confidence_score: Mapped[float] = mapped_column(Float)
    extracted_case_title: Mapped[str] = mapped_column(String(255))
    extracted_summary: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(100))
    municipality_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    claims: Mapped[list[dict[str, object]]] = mapped_column(JSON, default=list)
    sensitive_flags: Mapped[list[str]] = mapped_column(JSON, default=list)
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False)
    model_name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    article: Mapped[Article] = relationship(back_populates="extractions")


class ReviewQueueItem(Base):
    __tablename__ = "review_queue"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(100))
    entity_id: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(50))
    reason_codes: Mapped[list[str]] = mapped_column(JSON, default=list)
    editable_fields: Mapped[list[str]] = mapped_column(JSON, default=list)
    assigned_to: Mapped[str | None] = mapped_column(String(100), nullable=True)
    decision_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    audit_events: Mapped[list[dict[str, object]]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow)
