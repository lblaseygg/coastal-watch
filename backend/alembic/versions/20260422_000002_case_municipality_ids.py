"""add municipality_ids to cases"""

from __future__ import annotations

import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260422_000002"
down_revision = "20260414_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = inspect(connection)
    existing_columns = {column["name"] for column in inspector.get_columns("cases")}

    if "municipality_ids" not in existing_columns:
        op.add_column("cases", sa.Column("municipality_ids", sa.JSON(), nullable=True))

    rows = connection.execute(sa.text("SELECT id, municipality_id FROM cases")).mappings().all()
    for row in rows:
        connection.execute(
            sa.text("UPDATE cases SET municipality_ids = :municipality_ids WHERE id = :id"),
            {
                "id": row["id"],
                "municipality_ids": json.dumps([row["municipality_id"]]),
            },
        )

    if connection.dialect.name == "sqlite":
        with op.batch_alter_table("cases") as batch_op:
            batch_op.alter_column("municipality_ids", existing_type=sa.JSON(), nullable=False)
    else:
        op.alter_column("cases", "municipality_ids", existing_type=sa.JSON(), nullable=False)


def downgrade() -> None:
    op.drop_column("cases", "municipality_ids")
