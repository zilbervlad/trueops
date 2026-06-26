"""add trueops messages

Revision ID: 1c7d58f7f2b0
Revises: d6b41a105f9e
Create Date: 2026-06-26
"""

from alembic import op
import sqlalchemy as sa


revision = "1c7d58f7f2b0"
down_revision = "d6b41a105f9e"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "trueops_threads",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("thread_type", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("group_key", sa.String(length=220), nullable=False),
        sa.Column("store_number", sa.String(length=10), nullable=True),
        sa.Column("area_name", sa.String(length=120), nullable=True),
        sa.Column("role_key", sa.String(length=50), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_trueops_threads_company_id", "trueops_threads", ["company_id"])
    op.create_index("ix_trueops_threads_thread_type", "trueops_threads", ["thread_type"])
    op.create_index("ix_trueops_threads_group_key", "trueops_threads", ["group_key"])
    op.create_index("ix_trueops_threads_store_number", "trueops_threads", ["store_number"])
    op.create_index("ix_trueops_threads_area_name", "trueops_threads", ["area_name"])
    op.create_index("ix_trueops_threads_role_key", "trueops_threads", ["role_key"])

    op.create_table(
        "trueops_thread_members",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("thread_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("member_role", sa.String(length=40), nullable=False),
        sa.Column("muted", sa.Boolean(), nullable=False),
        sa.Column("last_read_at", sa.DateTime(), nullable=True),
        sa.Column("hidden_at", sa.DateTime(), nullable=True),
        sa.Column("joined_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["thread_id"], ["trueops_threads.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_trueops_thread_members_thread_id", "trueops_thread_members", ["thread_id"])
    op.create_index("ix_trueops_thread_members_user_id", "trueops_thread_members", ["user_id"])

    op.create_table(
        "trueops_thread_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("thread_id", sa.Integer(), nullable=False),
        sa.Column("sender_user_id", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("requires_ack", sa.Boolean(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["thread_id"], ["trueops_threads.id"]),
        sa.ForeignKeyConstraint(["sender_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_trueops_thread_messages_company_id", "trueops_thread_messages", ["company_id"])
    op.create_index("ix_trueops_thread_messages_thread_id", "trueops_thread_messages", ["thread_id"])
    op.create_index("ix_trueops_thread_messages_sender_user_id", "trueops_thread_messages", ["sender_user_id"])

    op.create_table(
        "trueops_thread_message_acks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("message_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["message_id"], ["trueops_thread_messages.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_trueops_thread_message_acks_message_id", "trueops_thread_message_acks", ["message_id"])
    op.create_index("ix_trueops_thread_message_acks_user_id", "trueops_thread_message_acks", ["user_id"])

    op.create_table(
        "trueops_push_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token", sa.Text(), nullable=False),
        sa.Column("platform", sa.String(length=40), nullable=True),
        sa.Column("device_name", sa.String(length=160), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )
    op.create_index("ix_trueops_push_tokens_company_id", "trueops_push_tokens", ["company_id"])
    op.create_index("ix_trueops_push_tokens_user_id", "trueops_push_tokens", ["user_id"])


def downgrade():
    op.drop_index("ix_trueops_push_tokens_user_id", table_name="trueops_push_tokens")
    op.drop_index("ix_trueops_push_tokens_company_id", table_name="trueops_push_tokens")
    op.drop_table("trueops_push_tokens")

    op.drop_index("ix_trueops_thread_message_acks_user_id", table_name="trueops_thread_message_acks")
    op.drop_index("ix_trueops_thread_message_acks_message_id", table_name="trueops_thread_message_acks")
    op.drop_table("trueops_thread_message_acks")

    op.drop_index("ix_trueops_thread_messages_sender_user_id", table_name="trueops_thread_messages")
    op.drop_index("ix_trueops_thread_messages_thread_id", table_name="trueops_thread_messages")
    op.drop_index("ix_trueops_thread_messages_company_id", table_name="trueops_thread_messages")
    op.drop_table("trueops_thread_messages")

    op.drop_index("ix_trueops_thread_members_user_id", table_name="trueops_thread_members")
    op.drop_index("ix_trueops_thread_members_thread_id", table_name="trueops_thread_members")
    op.drop_table("trueops_thread_members")

    op.drop_index("ix_trueops_threads_role_key", table_name="trueops_threads")
    op.drop_index("ix_trueops_threads_area_name", table_name="trueops_threads")
    op.drop_index("ix_trueops_threads_store_number", table_name="trueops_threads")
    op.drop_index("ix_trueops_threads_group_key", table_name="trueops_threads")
    op.drop_index("ix_trueops_threads_thread_type", table_name="trueops_threads")
    op.drop_index("ix_trueops_threads_company_id", table_name="trueops_threads")
    op.drop_table("trueops_threads")
