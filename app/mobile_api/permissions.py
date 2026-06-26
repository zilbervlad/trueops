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
