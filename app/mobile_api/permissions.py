from datetime import datetime

from functools import wraps
from flask import jsonify, request, g

from app.extensions import db
from app.models import MobileAuthToken, User


def mobile_error(message, status_code=400):
    return jsonify({
        "success": False,
        "error": message,
    }), status_code


def get_bearer_token():
    auth_header = request.headers.get("Authorization", "").strip()

    if not auth_header.lower().startswith("bearer "):
        return None

    return auth_header.split(" ", 1)[1].strip()


def current_mobile_user():
    token_value = get_bearer_token()

    if not token_value:
        return None, None

    token = MobileAuthToken.query.filter_by(
        token=token_value,
        is_active=True,
    ).first()

    if not token:
        return None, None

    if token.expires_at and token.expires_at < datetime.utcnow():
        token.is_active = False
        db.session.commit()
        return None, None

    user = User.query.filter_by(
        id=token.user_id,
        is_active=True,
    ).first()

    if not user:
        return None, None

    if token.company_id and user.company_id and token.company_id != user.company_id:
        return None, None

    token.last_used_at = datetime.utcnow()
    db.session.commit()

    return user, token


def mobile_login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        user, token = current_mobile_user()

        if not user:
            return mobile_error("Authentication required.", 401)

        g.mobile_user = user
        g.mobile_token = token
        g.mobile_company_id = user.company_id

        return view(*args, **kwargs)

    return wrapped_view


def normalize_mobile_role(user):
    return (getattr(user, "role", "") or "").strip().lower()


def scoped_store_query_for_user(user, StoreModel):
    """
    Single source of truth for mobile ops store visibility.

    Admin-style roles see only their selected company.
    Supervisors see stores in their assigned area.
    Managers/GMs/TMs see only their assigned store.
    No user should see stores outside their company.
    """
    if not user or not getattr(user, "company_id", None):
        return StoreModel.query.filter(False)

    role = normalize_mobile_role(user)

    query = StoreModel.query.filter(
        StoreModel.company_id == user.company_id,
        StoreModel.is_active.is_(True),
    )

    if role in {"platform_admin", "admin", "hr", "coach"}:
        return query

    if role == "maintenance":
        # Keep maintenance company-scoped for now. If we later assign maintenance users
        # to stores/areas, tighten this here and every module follows.
        return query

    if role == "supervisor":
        area_name = (getattr(user, "area_name", "") or "").strip()
        if not area_name:
            return StoreModel.query.filter(False)

        return query.filter(StoreModel.area_name == area_name)

    store_number = (getattr(user, "store_number", "") or "").strip()
    if not store_number:
        return StoreModel.query.filter(False)

    return query.filter(StoreModel.store_number == store_number)


def scoped_store_numbers_for_user(user, StoreModel):
    return [
        str(store.store_number)
        for store in scoped_store_query_for_user(user, StoreModel).all()
    ]


def user_can_access_store_number(user, StoreModel, store_number):
    if not store_number:
        return False

    allowed = set(scoped_store_numbers_for_user(user, StoreModel))
    return str(store_number) in allowed
