from flask import Blueprint, g, jsonify, request

from app.extensions import db
from app.models import Store, User
from app.mobile_api.permissions import mobile_error, mobile_login_required
from app.mobile_api.thread_helpers import ensure_default_threads_for_company


mobile_admin_bp = Blueprint(
    "mobile_admin",
    __name__,
    url_prefix="/api/mobile/admin",
)


BASE_ROLES = {"admin", "supervisor", "manager", "maintenance"}


def normalize_role(user):
    return (user.role or "").strip().lower()


def is_mobile_admin(user):
    return normalize_role(user) in {"admin", "platform_admin"}


def valid_roles_for_actor(actor):
    roles = set(BASE_ROLES)

    if normalize_role(actor) == "platform_admin":
        roles.add("platform_admin")

    return roles


def actor_company_id(actor):
    return getattr(actor, "company_id", None)


def serialize_admin_user(user):
    return {
        "id": user.id,
        "company_id": user.company_id,
        "name": user.name,
        "username": user.username,
        "role": user.role,
        "area_name": user.area_name,
        "store_number": user.store_number,
        "email": user.email,
        "notification_email": user.notification_email,
        "email_enabled": bool(user.email_enabled),
        "is_active": bool(user.is_active),
    }


def serialize_admin_store(store):
    return {
        "id": store.id,
        "company_id": store.company_id,
        "store_number": store.store_number,
        "name": store.store_name or f"Store {store.store_number}",
        "area_name": store.area_name,
        "is_active": bool(store.is_active),
    }


def target_user_for_actor(actor, user_id):
    if normalize_role(actor) == "platform_admin":
        return User.query.get(user_id)

    return User.query.filter_by(
        id=user_id,
        company_id=actor_company_id(actor),
    ).first()


def store_allowed_for_actor(actor, store_number):
    if not store_number:
        return True

    query = Store.query.filter_by(store_number=store_number, is_active=True)

    if normalize_role(actor) != "platform_admin":
        query = query.filter(Store.company_id == actor_company_id(actor))

    return query.first() is not None


def clean_scope_for_role(role, area_name, store_number):
    if role in {"admin", "maintenance", "platform_admin"}:
        return None, None

    if role == "supervisor":
        return area_name, None

    if role == "manager":
        return None, store_number

    return area_name, store_number


@mobile_admin_bp.get("/users")
@mobile_login_required
def admin_users():
    actor = g.mobile_user

    if not is_mobile_admin(actor):
        return mobile_error("Admin access required.", 403)

    users_query = User.query

    if normalize_role(actor) != "platform_admin":
        users_query = users_query.filter(User.company_id == actor_company_id(actor))

    users = (
        users_query
        .order_by(User.is_active.desc(), User.name.asc())
        .all()
    )

    stores_query = Store.query.filter_by(is_active=True)

    if normalize_role(actor) != "platform_admin":
        stores_query = stores_query.filter(Store.company_id == actor_company_id(actor))

    stores = (
        stores_query
        .order_by(Store.store_number.asc())
        .all()
    )

    areas = sorted({store.area_name for store in stores if store.area_name})

    return jsonify({
        "success": True,
        "users": [serialize_admin_user(user) for user in users],
        "stores": [serialize_admin_store(store) for store in stores],
        "areas": areas,
        "roles": sorted(valid_roles_for_actor(actor)),
    })


@mobile_admin_bp.post("/users/<int:user_id>")
@mobile_login_required
def update_admin_user(user_id):
    actor = g.mobile_user

    if not is_mobile_admin(actor):
        return mobile_error("Admin access required.", 403)

    target = target_user_for_actor(actor, user_id)

    if not target:
        return mobile_error("User not found.", 404)

    payload = request.get_json(silent=True) or {}

    role = (payload.get("role") or target.role or "").strip().lower()
    name = (payload.get("name") or target.name or "").strip()
    username = (payload.get("username") or target.username or "").strip()
    area_name = (payload.get("area_name") or "").strip() or None
    store_number = (payload.get("store_number") or "").strip() or None
    email = (payload.get("email") or "").strip() or None
    notification_email = (payload.get("notification_email") or "").strip() or None

    if role not in valid_roles_for_actor(actor):
        return mobile_error("Invalid role for your access level.", 400)

    if target.role == "platform_admin" and normalize_role(actor) != "platform_admin":
        return mobile_error("Only platform admins can edit platform admins.", 403)

    if role == "platform_admin" and normalize_role(actor) != "platform_admin":
        return mobile_error("Only platform admins can assign platform admin access.", 403)

    if not name or not username:
        return mobile_error("Name and username are required.", 400)

    existing = User.query.filter(User.username == username, User.id != target.id).first()
    if existing:
        return mobile_error("That username already exists.", 400)

    if role == "supervisor" and not area_name:
        return mobile_error("Supervisors must have an area assigned.", 400)

    if role == "manager" and not store_number:
        return mobile_error("Managers must have a store assigned.", 400)

    if store_number and not store_allowed_for_actor(actor, store_number):
        return mobile_error("That store is not available to this admin.", 400)

    area_name, store_number = clean_scope_for_role(role, area_name, store_number)

    target.name = name
    target.username = username
    target.role = role
    target.area_name = area_name
    target.store_number = store_number
    target.email = email
    target.notification_email = notification_email
    target.email_enabled = bool(payload.get("email_enabled", target.email_enabled))
    target.is_active = bool(payload.get("is_active", target.is_active))

    password = (payload.get("password") or "").strip()
    if password:
      target.set_password(password)

    if normalize_role(actor) == "platform_admin" and payload.get("company_id"):
        try:
            target.company_id = int(payload.get("company_id"))
        except (TypeError, ValueError):
            return mobile_error("Invalid company id.", 400)

    db.session.commit()

    return jsonify({
        "success": True,
        "user": serialize_admin_user(target),
    })


@mobile_admin_bp.post("/messages/ensure-defaults")
@mobile_login_required
def admin_ensure_default_messages():
    actor = g.mobile_user

    if not is_mobile_admin(actor):
        return mobile_error("Admin access required.", 403)

    if not actor.company:
        return mobile_error("No company is assigned to this admin.", 400)

    result = ensure_default_threads_for_company(
        actor.company,
        created_by_user_id=actor.id,
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "created": result.get("created", 0) if isinstance(result, dict) else 0,
        "updated": result.get("updated", 0) if isinstance(result, dict) else 0,
    })
