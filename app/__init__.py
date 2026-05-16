from flask import session
from app.config import Config
from app.extensions import db, migrate


def create_app():
    from flask import Flask

    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    migrate.init_app(app, db)

    from app.auth.routes import auth_bp
    from app.dashboard.routes import dashboard_bp
    from app.checklist.routes import checklist_bp
    from app.svr.routes import svr_bp
    from app.maintenance.routes import maintenance_bp
    from app.store_admin.routes import store_admin_bp
    from app.company_admin.routes import company_admin_bp
    from app.reports.routes import reports_bp
    from app.nightly_numbers.routes import nightly_numbers_bp
    from app.cash.routes import cash_bp
    from app.cash_review.routes import cash_review_bp
    from app.verification.routes import verification_bp
    from app.store_dashboard import store_dashboard_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(checklist_bp)
    app.register_blueprint(svr_bp)
    app.register_blueprint(maintenance_bp)
    app.register_blueprint(store_admin_bp)
    app.register_blueprint(company_admin_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(nightly_numbers_bp)
    app.register_blueprint(cash_bp)
    app.register_blueprint(cash_review_bp)
    app.register_blueprint(verification_bp)
    app.register_blueprint(store_dashboard_bp)

    @app.context_processor
    def inject_companies():
        if session.get("user_id") and session.get("is_platform_admin"):
            from app.models import Company
            companies = Company.query.filter_by(is_active=True).order_by(Company.name.asc()).all()
            return {"companies": companies}
        return {"companies": []}

    @app.route("/create-db")
    def create_db():
        from app import models
        db.create_all()
        return "Database tables created"

    with app.app_context():
        from app import models
        db.create_all()

        default_company = seed_default_company()
        seed_admin(default_company)

        # 🚫 DISABLED STORE SEEDING
        # seed_stores(default_company)

        seed_checklist_template()
        seed_svr_template()

    return app


def seed_default_company():
    from app.models import Company

    company = Company.query.filter_by(slug="trueops").first()
    if company:
        return company

    company = Company(
        name="TrueOps",
        slug="trueops",
        accent_color="#38bdf8",
        logo_filename="trueops-logo.png",
        is_active=True,
    )
    db.session.add(company)
    db.session.commit()
    return company


def seed_admin(default_company):
    from app.models import User

    existing = User.query.filter_by(username="admin").first()
    if existing:
        updated = False

        if not existing.company_id:
            existing.company_id = default_company.id
            updated = True

        if existing.role == "admin":
            existing.role = "platform_admin"
            updated = True

        if updated:
            db.session.commit()

        return

    admin = User(
        company_id=default_company.id,
        name="Admin",
        username="admin",
        role="platform_admin",
        is_active=True
    )
    admin.set_password("admin123")

    db.session.add(admin)
    db.session.commit()


# 🚫 STORE SEEDING DISABLED COMPLETELY
def seed_stores(default_company):
    return


def seed_checklist_template():
    from app.models import ChecklistTemplateItem

    if ChecklistTemplateItem.query.count() > 0:
        return

    items = [
        ("Before Open / Before 10:30", "Put on uniform & clock in / start office PULSE", 2, 1, True),
        ("Before Open / Before 10:30", "Take orders now", 1, 2, True),
        ("Before Open / Before 10:30", "Turn on makeline", 2, 3, True),
        ("Before Open / Before 10:30", "Check schedule", 2, 4, True),
    ]

    for section_name, task_text, expected_minutes, sort_order, is_required in items:
        db.session.add(
            ChecklistTemplateItem(
                section_name=section_name,
                task_text=task_text,
                expected_minutes=expected_minutes,
                sort_order=sort_order,
                is_required=is_required,
                is_active=True,
            )
        )

    db.session.commit()


def seed_svr_template():
    from app.models import SVRTemplateField

    if SVRTemplateField.query.count() > 0:
        return

    fields = [
        ("date", "Date", "date", 1),
        ("store_number", "Store #", "readonly", 2),
        ("manager_on_duty", "Manager on duty", "text", 3),
    ]

    for field_key, field_label, field_type, sort_order in fields:
        db.session.add(
            SVRTemplateField(
                field_key=field_key,
                field_label=field_label,
                field_type=field_type,
                sort_order=sort_order,
                is_active=True,
            )
        )

    db.session.commit()