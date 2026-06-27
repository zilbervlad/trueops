from flask import request

from app.mobile_api.auth import mobile_auth_bp
from app.mobile_api.messages import mobile_messages_bp
from app.mobile_api.push import mobile_push_bp
from app.mobile_api.checklist import mobile_checklist_bp
from app.mobile_api.svr import mobile_svr_bp
from app.mobile_api.maintenance import mobile_maintenance_bp
from app.mobile_api.admin import mobile_admin_bp


ALLOWED_MOBILE_ORIGINS = {
    "http://localhost:8081",
    "http://127.0.0.1:8081",
}


def register_mobile_api(app):
    app.register_blueprint(mobile_auth_bp)
    app.register_blueprint(mobile_messages_bp)
    app.register_blueprint(mobile_push_bp)
    app.register_blueprint(mobile_checklist_bp)
    app.register_blueprint(mobile_svr_bp)
    app.register_blueprint(mobile_maintenance_bp)
    app.register_blueprint(mobile_admin_bp)

    @app.after_request
    def add_mobile_api_cors_headers(response):
        if not request.path.startswith("/api/mobile"):
            return response

        origin = request.headers.get("Origin")

        if origin in ALLOWED_MOBILE_ORIGINS:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            response.headers["Access-Control-Allow-Credentials"] = "false"

        return response
