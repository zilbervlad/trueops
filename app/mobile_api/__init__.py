from app.mobile_api.auth import mobile_auth_bp


def register_mobile_api(app):
    app.register_blueprint(mobile_auth_bp)
