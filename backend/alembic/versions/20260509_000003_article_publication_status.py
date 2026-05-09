"""add article publication status

Revision ID: 20260509_000003
Revises: 20260422_000002
Create Date: 2026-05-09 00:00:03
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260509_000003"
down_revision = "20260422_000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = inspect(connection)
    existing_columns = {column["name"] for column in inspector.get_columns("articles")}

    if "publication_status" not in existing_columns:
        op.add_column("articles", sa.Column("publication_status", sa.String(length=50), nullable=True))

    op.execute("UPDATE articles SET publication_status = 'draft' WHERE publication_status IS NULL")
    if connection.dialect.name == "sqlite":
        with op.batch_alter_table("articles") as batch_op:
            batch_op.alter_column("publication_status", existing_type=sa.String(length=50), nullable=False)
    else:
        op.alter_column("articles", "publication_status", existing_type=sa.String(length=50), nullable=False)


def downgrade() -> None:
    op.drop_column("articles", "publication_status")
