from flask import Blueprint, g, jsonify, request

from app.extensions import db
from app.models import TrueOpsPushToken
from app.mobile_api.permissions import mobile_error, mobile_login_required


mobile_push_bp = Blueprint(
    "mobile_push",
    __name__,
    url_prefix="/api/mobile",
)


@mobile_push_bp.post("/push-token")
@mobile_login_required
def save_push_token():
    user = g.mobile_user
    data = request.get_json(silent=True) or {}

    token = (data.get("token") or "").strip()
    platform = (data.get("platform") or "").strip() or None
    device_name = (data.get("device_name") or "").strip() or None

    if not token:
        return mobile_error("Push token is required.", 400)

    row = TrueOpsPushToken.query.filter_by(token=token).first()

    if not row:
        row = TrueOpsPushToken(
            company_id=user.company_id,
            user_id=user.id,
            token=token,
            platform=platform,
            device_name=device_name,
            is_active=True,
        )
        db.session.add(row)
    else:
        row.company_id = user.company_id
        row.user_id = user.id
        row.platform = platform
        row.device_name = device_name
        row.is_active = True

    db.session.commit()

    return jsonify({
        "success": True,
    })
