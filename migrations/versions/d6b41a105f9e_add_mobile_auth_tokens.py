"""add mobile auth tokens

Revision ID: d6b41a105f9e
Revises: f8380d888b29
Create Date: 2026-06-26
"""

from alembic import op
import sqlalchemy as sa


revision = "d6b41a105f9e"
down_revision = "f8380d888b29"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "mobile_auth_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("token", sa.String(length=160), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=True),
        sa.Column("platform", sa.String(length=40), nullable=True),
        sa.Column("device_name", sa.String(length=160), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_mobile_auth_tokens_token",
        "mobile_auth_tokens",
        ["token"],
        unique=True,
    )

    op.create_index(
        "ix_mobile_auth_tokens_user_id",
        "mobile_auth_tokens",
        ["user_id"],
        unique=False,
    )

    op.create_index(
        "ix_mobile_auth_tokens_company_id",
        "mobile_auth_tokens",
        ["company_id"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_mobile_auth_tokens_company_id", table_name="mobile_auth_tokens")
    op.drop_index("ix_mobile_auth_tokens_user_id", table_name="mobile_auth_tokens")
    op.drop_index("ix_mobile_auth_tokens_token", table_name="mobile_auth_tokens")
    op.drop_table("mobile_auth_tokens")
