"""initial schema"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260414_000001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "municipalities",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("region", sa.String(length=100), nullable=False),
        sa.Column("coastal", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("centroid_lat", sa.Float(), nullable=False),
        sa.Column("centroid_lng", sa.Float(), nullable=False),
        sa.Column("geojson_key", sa.String(length=100), nullable=False, unique=True),
    )

    op.create_table(
        "articles",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("url", sa.Text(), nullable=False, unique=True),
        sa.Column("publisher", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accessed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("language", sa.String(length=16), nullable=False),
        sa.Column("fetch_status", sa.String(length=50), nullable=False),
        sa.Column("content_hash", sa.String(length=255), nullable=False),
        sa.Column("cleaned_text", sa.Text(), nullable=False),
        sa.Column("linked_case_ids", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "cases",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("slug", sa.String(length=255), nullable=False, unique=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("municipality_id", sa.String(length=100), sa.ForeignKey("municipalities.id"), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("publication_status", sa.String(length=50), nullable=False),
        sa.Column("review_state", sa.String(length=50), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("public_summary", sa.Text(), nullable=False),
        sa.Column("internal_summary", sa.Text(), nullable=False),
        sa.Column("location_lat", sa.Float(), nullable=False),
        sa.Column("location_lng", sa.Float(), nullable=False),
        sa.Column("location_precision", sa.String(length=50), nullable=False),
        sa.Column("first_reported_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_article_ids", sa.JSON(), nullable=False),
        sa.Column("review_reason_codes", sa.JSON(), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False),
    )
    op.create_index("ix_cases_municipality_id", "cases", ["municipality_id"])
    op.create_index("ix_cases_publication_status", "cases", ["publication_status"])

    op.create_table(
        "article_extractions",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("article_id", sa.String(length=100), sa.ForeignKey("articles.id"), nullable=False),
        sa.Column("schema_version", sa.String(length=50), nullable=False),
        sa.Column("relevance", sa.String(length=50), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False),
        sa.Column("extracted_case_title", sa.String(length=255), nullable=False),
        sa.Column("extracted_summary", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("municipality_ids", sa.JSON(), nullable=False),
        sa.Column("claims", sa.JSON(), nullable=False),
        sa.Column("sensitive_flags", sa.JSON(), nullable=False),
        sa.Column("needs_review", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("model_name", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_article_extractions_article_id", "article_extractions", ["article_id"])

    op.create_table(
        "review_queue",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("reason_codes", sa.JSON(), nullable=False),
        sa.Column("editable_fields", sa.JSON(), nullable=False),
        sa.Column("assigned_to", sa.String(length=100), nullable=True),
        sa.Column("decision_notes", sa.Text(), nullable=True),
        sa.Column("audit_events", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_review_queue_status", "review_queue", ["status"])

    op.create_table(
        "case_article_links",
        sa.Column("case_id", sa.String(length=100), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("article_id", sa.String(length=100), sa.ForeignKey("articles.id", ondelete="CASCADE"), nullable=False),
        sa.PrimaryKeyConstraint("case_id", "article_id"),
    )


def downgrade() -> None:
    op.drop_table("case_article_links")
    op.drop_index("ix_review_queue_status", table_name="review_queue")
    op.drop_table("review_queue")
    op.drop_index("ix_article_extractions_article_id", table_name="article_extractions")
    op.drop_table("article_extractions")
    op.drop_index("ix_cases_publication_status", table_name="cases")
    op.drop_index("ix_cases_municipality_id", table_name="cases")
    op.drop_table("cases")
    op.drop_table("articles")
    op.drop_table("municipalities")
