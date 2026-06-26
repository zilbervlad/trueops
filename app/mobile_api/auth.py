from datetime import datetime, timedelta
import secrets

from flask import Blueprint, jsonify, request, g

from app.extensions import db
from app.models import MobileAuthToken, User
from app.mobile_api.permissions import mobile_login_required
from app.mobile_api.serializers import serialize_mobile_context


mobile_auth_bp = Blueprint("mobile_auth", __name__, url_prefix="/api/mobile")


@mobile_auth_bp.post("/login")
def mobile_login():
    data = request.get_json(silent=True) or {}

    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    platform = (data.get("platform") or "").strip() or None
    device_name = (data.get("device_name") or "").strip() or None

    if not username or not password:
        return jsonify({
            "success": False,
            "error": "Username and password are required.",
        }), 400

    user = User.query.filter_by(
        username=username,
        is_active=True,
    ).first()

    if not user or not user.check_password(password):
        return jsonify({
            "success": False,
            "error": "Invalid username or password.",
        }), 401

    if not user.company_id and not user.is_platform_admin():
        return jsonify({
            "success": False,
            "error": "This account is not assigned to a company.",
        }), 403

    token = MobileAuthToken(
        token=secrets.token_urlsafe(64),
        user_id=user.id,
        company_id=user.company_id,
        platform=platform,
        device_name=device_name,
        expires_at=datetime.utcnow() + timedelta(days=90),
        is_active=True,
    )

    db.session.add(token)
    db.session.commit()

    return jsonify({
        "success": True,
        "token": token.token,
        "context": serialize_mobile_context(user),
    })


@mobile_auth_bp.get("/me")
@mobile_login_required
def mobile_me():
    return jsonify({
        "success": True,
        "context": serialize_mobile_context(g.mobile_user),
    })


@mobile_auth_bp.get("/modules")
@mobile_login_required
def mobile_modules():
    context = serialize_mobile_context(g.mobile_user)

    return jsonify({
        "success": True,
        "modules": context["modules"],
    })


@mobile_auth_bp.post("/logout")
@mobile_login_required
def mobile_logout():
    g.mobile_token.is_active = False
    db.session.commit()

    return jsonify({
        "success": True,
    })
