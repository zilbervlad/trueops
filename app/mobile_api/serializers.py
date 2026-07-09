import base64

from app.models import Store


def serialize_company(company):
    if not company:
        return None

    return {
        "id": company.id,
        "name": company.name,
        "slug": company.slug,
        "accent_color": company.accent_color,
        "logo_filename": company.logo_filename,
    }


def serialize_user(user):
    if not user:
        return None

    return {
        "id": user.id,
        "company_id": user.company_id,
        "name": user.name,
        "username": user.username,
        "role": user.role,
        "area_name": user.area_name,
        "store_number": user.store_number,
        "email": user.email,
        "is_active": bool(user.is_active),
        "is_platform_admin": bool(user.is_platform_admin()),
    }


def serialize_store(store):
    return {
        "id": store.id,
        "company_id": store.company_id,
        "store_number": store.store_number,
        "store_name": store.store_name,
        "area_name": store.area_name,
        "is_active": bool(store.is_active),
    }


def visible_stores_for_user(user):
    if not user or not user.company_id:
        return []

    query = Store.query.filter_by(
        company_id=user.company_id,
        is_active=True,
    )

    role = (user.role or "").strip().lower()

    if role in {"admin", "platform_admin", "maintenance"}:
        return query.order_by(Store.store_number.asc()).all()

    if role == "supervisor":
        if not user.area_name:
            return []
        return (
            query
            .filter_by(area_name=user.area_name)
            .order_by(Store.store_number.asc())
            .all()
        )

    if role == "manager":
        if not user.store_number:
            return []
        return (
            query
            .filter_by(store_number=user.store_number)
            .order_by(Store.store_number.asc())
            .all()
        )

    return []


def serialize_mobile_context(user):
    stores = visible_stores_for_user(user)

    return {
        "user": serialize_user(user),
        "company": serialize_company(user.company),
        "stores": [serialize_store(store) for store in stores],
        "modules": [
            {
                "key": "home",
                "label": "Home",
                "enabled": True,
            },
            {
                "key": "messages",
                "label": "Messages",
                "enabled": True,
            },
            {
                "key": "checklist",
                "label": "Daily Checklist",
                "enabled": True,
            },
            {
                "key": "svr",
                "label": "SVR",
                "enabled": True,
            },
            {
                "key": "maintenance",
                "label": "Maintenance",
                "enabled": True,
            },
        ],
    }


def display_thread_name(thread, current_user=None):
    if not thread:
        return ""

    if thread.thread_type != "direct" or not current_user:
        return thread.name

    other_members = [
        member.user
        for member in (thread.members or [])
        if member.user and member.user.id != current_user.id
    ]

    if other_members:
        return other_members[0].name or other_members[0].username or thread.name

    return thread.name




def serialize_message_attachment(attachment):
    if not attachment:
        return None

    encoded = base64.b64encode(attachment.data or b"").decode("ascii")

    return {
        "id": attachment.id,
        "filename": attachment.filename,
        "content_type": attachment.content_type,
        "data_url": f"data:{attachment.content_type};base64,{encoded}",
        "created_at": attachment.created_at.isoformat() if attachment.created_at else None,
    }


def serialize_thread_message(message, current_user=None):
    sender = message.sender

    reaction_groups = {}
    for reaction in (message.reactions or []):
        if not reaction.emoji:
            continue

        group = reaction_groups.setdefault(reaction.emoji, {
            "emoji": reaction.emoji,
            "count": 0,
            "mine": False,
            "users": [],
        })

        group["count"] += 1

        if reaction.user:
            group["users"].append({
                "id": reaction.user.id,
                "name": reaction.user.name,
            })

        if current_user and reaction.user_id == current_user.id:
            group["mine"] = True

    reply_to = None
    parent = getattr(message, "reply_to", None)

    if parent:
        parent_sender = parent.sender
        reply_to = {
            "id": parent.id,
            "sender_name": parent_sender.name if parent_sender else "Unknown",
            "body": "This message was deleted" if parent.is_deleted else parent.body,
            "is_deleted": bool(parent.is_deleted),
        }

    return {
        "id": message.id,
        "thread_id": message.thread_id,
        "sender_user_id": message.sender_user_id,
        "sender_name": sender.name if sender else "Unknown",
        "sender_role": sender.role if sender else None,
        "body": "This message was deleted" if message.is_deleted else message.body,
        "requires_ack": bool(message.requires_ack),
        "is_deleted": bool(message.is_deleted),
        "is_mine": bool(current_user and message.sender_user_id == current_user.id),
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "ack_count": len(message.acks or []),
        "attachments": [
            serialize_message_attachment(attachment)
            for attachment in (message.attachments or [])
        ],
        "reply_to_message_id": getattr(message, "reply_to_message_id", None),
        "reply_to": reply_to,
        "reactions": list(reaction_groups.values()),
    }


def serialize_thread_light(thread, current_user=None, last_message=None, unread_count=0, member_count=0):
    return {
        "id": thread.id,
        "company_id": thread.company_id,
        "thread_type": thread.thread_type,
        "name": display_thread_name(thread, current_user),
        "group_key": thread.group_key,
        "store_number": thread.store_number,
        "area_name": thread.area_name,
        "role_key": thread.role_key,
        "is_active": bool(thread.is_active),
        "created_at": thread.created_at.isoformat() if thread.created_at else None,
        "member_count": member_count,
        "unread_count": unread_count,
        "last_message": serialize_thread_message(last_message, current_user) if last_message else None,
    }


def serialize_thread_detail(thread, current_user=None, messages=None):
    return {
        "id": thread.id,
        "company_id": thread.company_id,
        "thread_type": thread.thread_type,
        "name": display_thread_name(thread, current_user),
        "group_key": thread.group_key,
        "store_number": thread.store_number,
        "area_name": thread.area_name,
        "role_key": thread.role_key,
        "is_active": bool(thread.is_active),
        "created_at": thread.created_at.isoformat() if thread.created_at else None,
        "members": [
            {
                "id": member.user.id,
                "name": member.user.name,
                "role": member.user.role,
                "member_role": member.member_role,
                "muted": bool(member.muted),
                "hidden": bool(member.hidden_at),
            }
            for member in (thread.members or [])
            if member.user and not member.hidden_at
        ],
        "messages": [
            serialize_thread_message(message, current_user)
            for message in (messages or [])
        ],
    }
