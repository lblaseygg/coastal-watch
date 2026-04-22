"""add municipality_ids to cases"""

from __future__ import annotations

import json

from alembic import op
import sqlalchemy as sa


revision = "20260422_000002"
down_revision = "20260414_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cases", sa.Column("municipality_ids", sa.JSON(), nullable=True))

    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, municipality_id FROM cases")).mappings().all()
    for row in rows:
        connection.execute(
            sa.text("UPDATE cases SET municipality_ids = :municipality_ids WHERE id = :id"),
            {
                "id": row["id"],
                "municipality_ids": json.dumps([row["municipality_id"]]),
            },
        )

    op.alter_column("cases", "municipality_ids", nullable=False)


def downgrade() -> None:
    op.drop_column("cases", "municipality_ids")
