from datetime import datetime

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func

from app.extensions import db
from app.models import (
    TrueOpsThread,
    TrueOpsThreadMember,
    TrueOpsThreadMessage,
    User,
)
from app.mobile_api.permissions import mobile_error, mobile_login_required
from app.mobile_api.thread_helpers import ensure_default_threads_for_company
from app.mobile_api.serializers import (
    serialize_thread_detail,
    serialize_thread_light,
    serialize_thread_message,
)


mobile_messages_bp = Blueprint(
    "mobile_messages",
    __name__,
    url_prefix="/api/mobile/messages",
)


COMPANY_MESSAGING_ROLES = {"admin", "platform_admin", "hr", "coach"}
AREA_MESSAGING_ROLES = {"admin", "platform_admin", "hr", "coach", "supervisor"}
STORE_MESSAGING_ROLES = {
    "admin",
    "platform_admin",
    "hr",
    "coach",
    "supervisor",
    "general_manager",
    "manager",
    "maintenance",
}


def normalize_role(user):
    return (getattr(user, "role", "") or "").strip().lower()


def same_company(user, other_user):
    if not user or not other_user:
        return False

    if user.role == "platform_admin":
        return True

    return user.company_id and user.company_id == other_user.company_id


def user_can_message_user(sender, recipient):
    if not same_company(sender, recipient):
        return False

    sender_role = normalize_role(sender)
    recipient_role = normalize_role(recipient)

    if sender.id == recipient.id:
        return False

    if sender_role in COMPANY_MESSAGING_ROLES:
        return True

    if sender_role == "supervisor":
        if recipient.company_id != sender.company_id:
            return False
        if recipient.area_name and sender.area_name and recipient.area_name == sender.area_name:
            return True
        if recipient.store_number and sender.area_name:
            return True
        return recipient_role in {"manager", "general_manager", "tm", "maintenance"}

    if sender_role in {"general_manager", "manager"}:
        return bool(sender.store_number and recipient.store_number == sender.store_number)

    if sender_role in {"maintenance"}:
        return recipient_role in {"admin", "supervisor", "manager", "general_manager", "maintenance"}

    return recipient_role in {"admin", "supervisor", "general_manager", "manager"}


def user_can_access_thread(user, thread):
    if not user or not thread:
        return False

    if user.role == "platform_admin":
        return True

    if user.company_id != thread.company_id:
        return False

    role = normalize_role(user)

    if role in COMPANY_MESSAGING_ROLES and thread.thread_type != "direct":
        return True

    membership = TrueOpsThreadMember.query.filter_by(
        thread_id=thread.id,
        user_id=user.id,
    ).first()

    if membership and not membership.hidden_at:
        return True

    if thread.thread_type == "company":
        return role in COMPANY_MESSAGING_ROLES

    if thread.thread_type == "area":
        return bool(user.area_name and user.area_name == thread.area_name)

    if thread.thread_type == "store":
        return bool(user.store_number and user.store_number == thread.store_number)

    if thread.thread_type == "role":
        return bool(role and role == thread.role_key)

    return False


def user_can_send_to_thread(user, thread):
    if not user_can_access_thread(user, thread):
        return False

    role = normalize_role(user)

    if thread.thread_type == "company":
        return role in COMPANY_MESSAGING_ROLES

    if thread.thread_type == "area":
        return role in AREA_MESSAGING_ROLES

    if thread.thread_type == "store":
        return role in STORE_MESSAGING_ROLES

    return True


def ensure_thread_member(thread_id, user_id, member_role="member"):
    membership = TrueOpsThreadMember.query.filter_by(
        thread_id=thread_id,
        user_id=user_id,
    ).first()

    if membership:
        membership.hidden_at = None
        return membership

    membership = TrueOpsThreadMember(
        thread_id=thread_id,
        user_id=user_id,
        member_role=member_role,
    )
    db.session.add(membership)
    return membership


def direct_group_key(company_id, user_a_id, user_b_id):
    ordered = sorted([int(user_a_id), int(user_b_id)])
    return f"company:{company_id}:direct:{ordered[0]}:{ordered[1]}"


@mobile_messages_bp.get("/people")
@mobile_login_required
def list_message_people():
    user = g.mobile_user

    if not user.company_id:
        return jsonify({
            "success": True,
            "people": [],
        })

    candidates = (
        User.query
        .filter(User.company_id == user.company_id)
        .filter(User.is_active.is_(True))
        .filter(User.id != user.id)
        .order_by(User.name.asc())
        .all()
    )

    people = []

    for candidate in candidates:
        if not user_can_message_user(user, candidate):
            continue

        people.append({
            "id": candidate.id,
            "name": candidate.name,
            "username": candidate.username,
            "role": candidate.role,
            "store_number": candidate.store_number,
            "area_name": candidate.area_name,
            "email": candidate.email,
        })

    return jsonify({
        "success": True,
        "people": people,
    })


@mobile_messages_bp.get("/threads")
@mobile_login_required
def list_threads():
    user = g.mobile_user

    base_query = TrueOpsThread.query.filter_by(
        company_id=user.company_id,
        is_active=True,
    )

    role = normalize_role(user)

    if role in COMPANY_MESSAGING_ROLES:
        direct_thread_ids = [
            membership.thread_id
            for membership in TrueOpsThreadMember.query.filter_by(
                user_id=user.id,
                hidden_at=None,
            ).all()
        ]

        query = base_query.filter(
            db.or_(
                TrueOpsThread.thread_type != "direct",
                TrueOpsThread.id.in_(direct_thread_ids),
            )
        )
    else:
        query = (
            base_query
            .join(TrueOpsThreadMember)
            .filter(TrueOpsThreadMember.user_id == user.id)
            .filter(TrueOpsThreadMember.hidden_at.is_(None))
        )

    threads = query.order_by(TrueOpsThread.created_at.desc()).all()
    thread_ids = [thread.id for thread in threads]

    latest_messages = {}
    member_counts = {}
    memberships = {}

    if thread_ids:
        latest_rows = (
            db.session.query(
                TrueOpsThreadMessage.thread_id.label("thread_id"),
                func.max(TrueOpsThreadMessage.created_at).label("last_time"),
            )
            .filter(TrueOpsThreadMessage.thread_id.in_(thread_ids))
            .group_by(TrueOpsThreadMessage.thread_id)
            .all()
        )

        for row in latest_rows:
            message = (
                TrueOpsThreadMessage.query
                .filter_by(thread_id=row.thread_id, created_at=row.last_time)
                .order_by(TrueOpsThreadMessage.id.desc())
                .first()
            )
            if message:
                latest_messages[row.thread_id] = message

        member_counts = {
            row.thread_id: row.member_count
            for row in (
                db.session.query(
                    TrueOpsThreadMember.thread_id.label("thread_id"),
                    func.count(TrueOpsThreadMember.id).label("member_count"),
                )
                .filter(TrueOpsThreadMember.thread_id.in_(thread_ids))
                .group_by(TrueOpsThreadMember.thread_id)
                .all()
            )
        }

        memberships = {
            membership.thread_id: membership
            for membership in TrueOpsThreadMember.query.filter(
                TrueOpsThreadMember.thread_id.in_(thread_ids),
                TrueOpsThreadMember.user_id == user.id,
            ).all()
        }

    serialized = []

    for thread in threads:
        membership = memberships.get(thread.id)
        unread_count = 0

        if membership:
            unread_query = TrueOpsThreadMessage.query.filter(
                TrueOpsThreadMessage.thread_id == thread.id,
                TrueOpsThreadMessage.sender_user_id != user.id,
            )

            if membership.last_read_at:
                unread_query = unread_query.filter(
                    TrueOpsThreadMessage.created_at > membership.last_read_at
                )

            unread_count = unread_query.count()

        serialized.append(serialize_thread_light(
            thread,
            current_user=user,
            last_message=latest_messages.get(thread.id),
            unread_count=unread_count,
            member_count=member_counts.get(thread.id, 0),
        ))

    return jsonify({
        "success": True,
        "threads": serialized,
    })


@mobile_messages_bp.get("/threads/<int:thread_id>")
@mobile_login_required
def get_thread(thread_id):
    user = g.mobile_user

    thread = TrueOpsThread.query.filter_by(
        id=thread_id,
        company_id=user.company_id,
        is_active=True,
    ).first()

    if not thread or not user_can_access_thread(user, thread):
        return mobile_error("Thread not found.", 404)

    messages = (
        TrueOpsThreadMessage.query
        .filter_by(thread_id=thread.id, company_id=thread.company_id)
        .order_by(TrueOpsThreadMessage.created_at.asc(), TrueOpsThreadMessage.id.asc())
        .limit(100)
        .all()
    )

    return jsonify({
        "success": True,
        "thread": serialize_thread_detail(thread, current_user=user, messages=messages),
    })


@mobile_messages_bp.post("/threads/<int:thread_id>/messages")
@mobile_login_required
def create_thread_message(thread_id):
    user = g.mobile_user
    data = request.get_json(silent=True) or {}

    body = (data.get("body") or "").strip()
    requires_ack = bool(data.get("requires_ack", False))

    if not body:
        return mobile_error("Message body is required.", 400)

    thread = TrueOpsThread.query.filter_by(
        id=thread_id,
        company_id=user.company_id,
        is_active=True,
    ).first()

    if not thread or not user_can_send_to_thread(user, thread):
        return mobile_error("You do not have permission to send to this thread.", 403)

    message = TrueOpsThreadMessage(
        company_id=thread.company_id,
        thread_id=thread.id,
        sender_user_id=user.id,
        body=body,
        requires_ack=requires_ack,
    )

    ensure_thread_member(thread.id, user.id)

    db.session.add(message)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": serialize_thread_message(message, current_user=user),
    }), 201


@mobile_messages_bp.post("/direct")
@mobile_login_required
def find_or_create_direct_thread():
    user = g.mobile_user
    data = request.get_json(silent=True) or {}

    recipient_user_id = data.get("recipient_user_id")

    try:
        recipient_user_id = int(recipient_user_id)
    except (TypeError, ValueError):
        return mobile_error("recipient_user_id is required.", 400)

    recipient = User.query.filter_by(
        id=recipient_user_id,
        is_active=True,
    ).first()

    if not recipient:
        return mobile_error("Recipient not found.", 404)

    if not user_can_message_user(user, recipient):
        return mobile_error("You do not have permission to message this user.", 403)

    company_id = user.company_id or recipient.company_id
    group_key = direct_group_key(company_id, user.id, recipient.id)

    thread = TrueOpsThread.query.filter_by(
        company_id=company_id,
        group_key=group_key,
    ).first()

    if not thread:
        thread = TrueOpsThread(
            company_id=company_id,
            thread_type="direct",
            name=f"{user.name} + {recipient.name}",
            group_key=group_key,
            created_by_user_id=user.id,
        )
        db.session.add(thread)
        db.session.flush()

    ensure_thread_member(thread.id, user.id, member_role="owner")
    ensure_thread_member(thread.id, recipient.id, member_role="member")

    db.session.commit()

    return jsonify({
        "success": True,
        "thread": serialize_thread_detail(thread, current_user=user, messages=[]),
    })


@mobile_messages_bp.post("/threads/<int:thread_id>/read")
@mobile_login_required
def mark_thread_read(thread_id):
    user = g.mobile_user

    thread = TrueOpsThread.query.filter_by(
        id=thread_id,
        company_id=user.company_id,
        is_active=True,
    ).first()

    if not thread or not user_can_access_thread(user, thread):
        return mobile_error("Thread not found.", 404)

    membership = ensure_thread_member(thread.id, user.id)
    membership.last_read_at = datetime.utcnow()

    db.session.commit()

    return jsonify({
        "success": True,
    })


@mobile_messages_bp.post("/threads/ensure-defaults")
@mobile_login_required
def ensure_default_threads():
    user = g.mobile_user
    role = normalize_role(user)

    if role not in COMPANY_MESSAGING_ROLES:
        return mobile_error("You do not have permission to create default threads.", 403)

    if not user.company:
        return mobile_error("No company found for this user.", 400)

    threads = ensure_default_threads_for_company(
        user.company,
        created_by_user_id=user.id,
    )

    return jsonify({
        "success": True,
        "thread_count": len(threads),
        "threads": [
            serialize_thread_light(thread, current_user=user)
            for thread in threads
        ],
    })
