from datetime import timedelta

from flask import session

from app.config import Config
from app.extensions import db, mail, migrate


def create_app():
    from flask import Flask

    app = Flask(__name__)
    app.config.from_object(Config)

    # -------------------------
    # SESSION SETTINGS
    # Keep users logged in longer for True Ops
    # -------------------------
    app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)
    app.config["SESSION_PERMANENT"] = True

    # -------------------------
    # EXTENSIONS
    # -------------------------
    db.init_app(app)
    migrate.init_app(app, db)
    mail.init_app(app)

    # -------------------------
    # BLUEPRINTS
    # -------------------------
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

    # -------------------------
    # GLOBAL TEMPLATE CONTEXT
    # -------------------------
    @app.context_processor
    def inject_companies():
        if session.get("user_id") and session.get("is_platform_admin"):
            from app.models import Company

            companies = (
                Company.query
                .filter_by(is_active=True)
                .order_by(Company.name.asc())
                .all()
            )
            return {"companies": companies}

        return {"companies": []}

    # -------------------------
    # UTILITY ROUTE
    # -------------------------
    @app.route("/create-db")
    def create_db():
        from app import models

        db.create_all()
        ensure_checklist_company_id_columns()
        ensure_nightly_numbers_company_id_column()
        ensure_svr_maintenance_company_id_columns()
        ensure_verification_reports_company_id_column()
        ensure_cash_logs_company_id_column()
        return "Database tables created"

    # -------------------------
    # INITIAL DATABASE SETUP / SEEDS
    # -------------------------
    with app.app_context():
        from app import models

        db.create_all()

        default_company = seed_default_company()

        ensure_checklist_company_id_columns()
        ensure_nightly_numbers_company_id_column()
        ensure_svr_maintenance_company_id_columns()
        ensure_verification_reports_company_id_column()
        ensure_cash_logs_company_id_column()

        ensure_checklist_template_company_column()
        ensure_svr_template_company_column()
        ensure_verification_template_company_column()
        ensure_nightly_numbers_config_company_column()
        seed_admin(default_company)

        # Store seeding is intentionally disabled for True Ops.
        # Stores should be created per company from the admin screen.
        # seed_stores(default_company)

        seed_checklist_template()
        seed_svr_template()

    @app.route("/healthz")
    def healthz():
        return {"status": "ok"}, 200


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



def ensure_checklist_company_id_columns():
    """
    Adds company_id to checklist tables for existing databases and backfills
    from stores using the current globally-unique store_number.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(db.engine)

    daily_columns = {col["name"] for col in inspector.get_columns("daily_checklists")}
    if "company_id" not in daily_columns:
        try:
            db.session.execute(text("ALTER TABLE daily_checklists ADD COLUMN IF NOT EXISTS company_id INTEGER"))
        except Exception:
            db.session.rollback()
            db.session.execute(text("ALTER TABLE daily_checklists ADD COLUMN company_id INTEGER"))

        try:
            db.session.execute(text("CREATE INDEX IF NOT EXISTS ix_daily_checklists_company_id ON daily_checklists (company_id)"))
        except Exception:
            db.session.rollback()

    exception_columns = {col["name"] for col in inspector.get_columns("checklist_exceptions")}
    if "company_id" not in exception_columns:
        try:
            db.session.execute(text("ALTER TABLE checklist_exceptions ADD COLUMN IF NOT EXISTS company_id INTEGER"))
        except Exception:
            db.session.rollback()
            db.session.execute(text("ALTER TABLE checklist_exceptions ADD COLUMN company_id INTEGER"))

        try:
            db.session.execute(text("CREATE INDEX IF NOT EXISTS ix_checklist_exceptions_company_id ON checklist_exceptions (company_id)"))
        except Exception:
            db.session.rollback()

    db.session.execute(text("""
        UPDATE daily_checklists
        SET company_id = stores.company_id
        FROM stores
        WHERE daily_checklists.company_id IS NULL
          AND daily_checklists.store_number = stores.store_number
          AND stores.company_id IS NOT NULL
    """))

    db.session.execute(text("""
        UPDATE checklist_exceptions
        SET company_id = stores.company_id
        FROM stores
        WHERE checklist_exceptions.company_id IS NULL
          AND checklist_exceptions.store_number = stores.store_number
          AND stores.company_id IS NOT NULL
    """))

    db.session.commit()


def ensure_nightly_numbers_company_id_column():
    """
    Adds company_id to nightly_numbers_reports for existing databases and
    backfills from stores using the current globally-unique store_number.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(db.engine)

    columns = {col["name"] for col in inspector.get_columns("nightly_numbers_reports")}
    if "company_id" not in columns:
        try:
            db.session.execute(text("ALTER TABLE nightly_numbers_reports ADD COLUMN IF NOT EXISTS company_id INTEGER"))
        except Exception:
            db.session.rollback()
            db.session.execute(text("ALTER TABLE nightly_numbers_reports ADD COLUMN company_id INTEGER"))

        try:
            db.session.execute(text("CREATE INDEX IF NOT EXISTS ix_nightly_numbers_reports_company_id ON nightly_numbers_reports (company_id)"))
        except Exception:
            db.session.rollback()

    db.session.execute(text("""
        UPDATE nightly_numbers_reports
        SET company_id = stores.company_id
        FROM stores
        WHERE nightly_numbers_reports.company_id IS NULL
          AND nightly_numbers_reports.store_number = stores.store_number
          AND stores.company_id IS NOT NULL
    """))

    db.session.commit()


def ensure_svr_maintenance_company_id_columns():
    """
    Adds company_id to SVR, weekly focus, and maintenance tables for existing
    databases and backfills from stores using the current globally-unique store_number.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(db.engine)

    table_names = [
        "svr_reports",
        "weekly_focus_items",
        "maintenance_tickets",
    ]

    for table_name in table_names:
        columns = {col["name"] for col in inspector.get_columns(table_name)}
        if "company_id" not in columns:
            try:
                db.session.execute(text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS company_id INTEGER"))
            except Exception:
                db.session.rollback()
                db.session.execute(text(f"ALTER TABLE {table_name} ADD COLUMN company_id INTEGER"))

            try:
                db.session.execute(text(f"CREATE INDEX IF NOT EXISTS ix_{table_name}_company_id ON {table_name} (company_id)"))
            except Exception:
                db.session.rollback()

    db.session.execute(text("""
        UPDATE svr_reports
        SET company_id = stores.company_id
        FROM stores
        WHERE svr_reports.company_id IS NULL
          AND svr_reports.store_number = stores.store_number
          AND stores.company_id IS NOT NULL
    """))

    db.session.execute(text("""
        UPDATE weekly_focus_items
        SET company_id = stores.company_id
        FROM stores
        WHERE weekly_focus_items.company_id IS NULL
          AND weekly_focus_items.store_number = stores.store_number
          AND stores.company_id IS NOT NULL
    """))

    db.session.execute(text("""
        UPDATE maintenance_tickets
        SET company_id = stores.company_id
        FROM stores
        WHERE maintenance_tickets.company_id IS NULL
          AND maintenance_tickets.store_number = stores.store_number
          AND stores.company_id IS NOT NULL
    """))

    db.session.commit()


def ensure_verification_reports_company_id_column():
    """
    Adds company_id to verification_reports for existing databases and backfills
    from stores using the current globally-unique store_number.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(db.engine)

    columns = {col["name"] for col in inspector.get_columns("verification_reports")}
    if "company_id" not in columns:
        try:
            db.session.execute(text("ALTER TABLE verification_reports ADD COLUMN IF NOT EXISTS company_id INTEGER"))
        except Exception:
            db.session.rollback()
            db.session.execute(text("ALTER TABLE verification_reports ADD COLUMN company_id INTEGER"))

        try:
            db.session.execute(text("CREATE INDEX IF NOT EXISTS ix_verification_reports_company_id ON verification_reports (company_id)"))
        except Exception:
            db.session.rollback()

    db.session.execute(text("""
        UPDATE verification_reports
        SET company_id = stores.company_id
        FROM stores
        WHERE verification_reports.company_id IS NULL
          AND verification_reports.store_number = stores.store_number
          AND stores.company_id IS NOT NULL
    """))

    db.session.commit()

def ensure_cash_logs_company_id_column():
    """
    Adds company_id to cash_logs for existing databases.
    db.create_all() does not alter existing tables.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(db.engine)
    if "cash_logs" not in inspector.get_table_names():
        return

    columns = [column["name"] for column in inspector.get_columns("cash_logs")]
    if "company_id" in columns:
        return

    try:
        db.session.execute(
            text("ALTER TABLE cash_logs ADD COLUMN IF NOT EXISTS company_id INTEGER")
        )
    except Exception:
        db.session.rollback()
        db.session.execute(
            text("ALTER TABLE cash_logs ADD COLUMN company_id INTEGER")
        )

    try:
        db.session.execute(
            text("CREATE INDEX IF NOT EXISTS ix_cash_logs_company_id ON cash_logs (company_id)")
        )
    except Exception:
        pass

    db.session.commit()


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
        is_active=True,
    )
    admin.set_password("admin123")

    db.session.add(admin)
    db.session.commit()


# Store seeding is disabled for True Ops.
# True Ops should allow each company to create/manage its own stores.
def seed_stores(default_company):
    return


def ensure_checklist_template_company_column():
    """
    Adds company_id to checklist_template_items for existing databases.

    db.create_all() does not alter existing tables, so this protects both
    local SQLite and Render Postgres without requiring a manual migration.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(db.engine)
    columns = [column["name"] for column in inspector.get_columns("checklist_template_items")]

    if "company_id" in columns:
        return

    dialect = db.engine.dialect.name

    if dialect == "postgresql":
        db.session.execute(
            text("ALTER TABLE checklist_template_items ADD COLUMN IF NOT EXISTS company_id INTEGER")
        )
        db.session.execute(
            text("CREATE INDEX IF NOT EXISTS ix_checklist_template_items_company_id ON checklist_template_items (company_id)")
        )
    else:
        db.session.execute(
            text("ALTER TABLE checklist_template_items ADD COLUMN company_id INTEGER")
        )

    db.session.commit()


def ensure_svr_template_company_column():
    """
    Adds company_id to svr_template_fields for existing databases and removes
    the old global UNIQUE constraint on field_key so each company can have
    its own SVR template fields.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(db.engine)
    columns = [column["name"] for column in inspector.get_columns("svr_template_fields")]
    dialect = db.engine.dialect.name

    if "company_id" not in columns:
        if dialect == "postgresql":
            db.session.execute(
                text("ALTER TABLE svr_template_fields ADD COLUMN IF NOT EXISTS company_id INTEGER")
            )
        else:
            db.session.execute(
                text("ALTER TABLE svr_template_fields ADD COLUMN company_id INTEGER")
            )

        db.session.commit()

    if dialect == "postgresql":
        db.session.execute(
            text("ALTER TABLE svr_template_fields DROP CONSTRAINT IF EXISTS svr_template_fields_field_key_key")
        )
        db.session.execute(
            text("CREATE INDEX IF NOT EXISTS ix_svr_template_fields_company_id ON svr_template_fields (company_id)")
        )
        db.session.commit()

def ensure_verification_template_company_column():
    """
    Adds company_id to verification_template_fields for existing databases and removes
    the old global UNIQUE constraint on field_key so each company can have
    its own verification template fields.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(db.engine)
    columns = [column["name"] for column in inspector.get_columns("verification_template_fields")]
    dialect = db.engine.dialect.name

    if "company_id" not in columns:
        if dialect == "postgresql":
            db.session.execute(
                text("ALTER TABLE verification_template_fields ADD COLUMN IF NOT EXISTS company_id INTEGER")
            )
        else:
            db.session.execute(
                text("ALTER TABLE verification_template_fields ADD COLUMN company_id INTEGER")
            )

        db.session.commit()

    if dialect == "postgresql":
        db.session.execute(
            text("ALTER TABLE verification_template_fields DROP CONSTRAINT IF EXISTS verification_template_fields_field_key_key")
        )
        db.session.execute(
            text("CREATE INDEX IF NOT EXISTS ix_verification_template_fields_company_id ON verification_template_fields (company_id)")
        )
        db.session.commit()


def ensure_nightly_numbers_config_company_column():
    """
    Adds company_id to nightly_numbers_field_config for existing databases and removes
    the old global UNIQUE constraint on field_key so each company can have its own
    nightly numbers field settings.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(db.engine)
    columns = [column["name"] for column in inspector.get_columns("nightly_numbers_field_config")]
    dialect = db.engine.dialect.name

    if "company_id" not in columns:
        if dialect == "postgresql":
            db.session.execute(
                text("ALTER TABLE nightly_numbers_field_config ADD COLUMN IF NOT EXISTS company_id INTEGER")
            )
        else:
            db.session.execute(
                text("ALTER TABLE nightly_numbers_field_config ADD COLUMN company_id INTEGER")
            )

        db.session.commit()

    if dialect == "postgresql":
        db.session.execute(
            text("ALTER TABLE nightly_numbers_field_config DROP CONSTRAINT IF EXISTS nightly_numbers_field_config_field_key_key")
        )
        db.session.execute(
            text("CREATE INDEX IF NOT EXISTS ix_nightly_numbers_field_config_company_id ON nightly_numbers_field_config (company_id)")
        )
        db.session.commit()


def seed_checklist_template():
    from app.models import ChecklistTemplateItem, Company

    trueops_company = Company.query.filter_by(slug="trueops").first()
    trueops_company_id = trueops_company.id if trueops_company else None

    # TrueOps is multi-company now. We should never keep global/default
    # checklist template rows because they can bleed into company views.
    if trueops_company_id:
        # Do not delete old global rows: daily_checklist_items may still
        # reference them by template_item_id. Reassign them to TrueOps instead.
        ChecklistTemplateItem.query.filter(
            ChecklistTemplateItem.company_id.is_(None)
        ).update(
            {"company_id": trueops_company_id},
            synchronize_session=False,
        )

        existing_trueops_items = ChecklistTemplateItem.query.filter_by(
            company_id=trueops_company_id
        ).count()

        if existing_trueops_items > 0:
            db.session.commit()
            return
    elif ChecklistTemplateItem.query.count() > 0:
        return

    items = [
        ("Before Open / Before 10:30", "Put on uniform & clock in / start office PULSE", 2, 1, True),
        ("Before Open / Before 10:30", "Take orders now", 1, 2, True),
        ("Before Open / Before 10:30", "Turn on makeline", 2, 3, True),
        ("Before Open / Before 10:30", "Check schedule", 2, 4, True),
        ("Before Open / Before 10:30", "Run prep report - check enough food for day", 3, 5, True),
        ("Before Open / Before 10:30", "Put wash in dryer / hang laundry", 2, 6, True),
        ("Before Open / Before 10:30", "Bring out dough for 1-way proof", 3, 7, True),
        ("Before Open / Before 10:30", "Count till", 2, 8, True),
        ("Before Open / Before 10:30", "Turn on oven & open sign", 2, 9, True),
        ("Before Open / Before 10:30", "Set up makeline & stock cabinets", 4, 10, True),
        ("Before Open / Before 10:30", "Place scales & thermometers", 2, 11, True),
        ("Before Open / Before 10:30", "Set up dough & cut tables", 4, 12, True),
        ("Before Open / Before 10:30", "Check shelf-life dates - toss expired food", 3, 13, True),
        ("Before Open / Before 10:30", "Check all labels for rotation - including dough", 3, 14, True),
        ("Before Open / Before 10:30", "Clean customer area - including windows & sills", 4, 15, True),
        ("Before Open / Before 10:30", "Sweep / clean outside - 6' out from door", 3, 16, True),
        ("Before Open / Before 10:30", "Stock napkin & c-fold containers and soaps", 2, 17, True),
        ("Before Open / Before 10:30", "Check image - TM & cars", 2, 18, True),
        ("Before Open / Before 10:30", "Prep fresh sauce & warm cold sauce", 3, 19, True),
        ("Before Open / Before 10:30", "Complete self OER & correct as needed", 4, 20, True),
        ("Before Open / Before 10:30", "Stock cheese and prep for next day", 3, 21, True),
        ("Before Open / Before 10:30", "Clean all bathrooms & stock", 4, 22, True),

        ("During Dayshift", "Prep all products for day (done by 11am)", 5, 23, True),
        ("During Dayshift", "Pick up bank slips & staple to daily", 2, 24, True),
        ("During Dayshift", "Check & clean hot bags", 3, 25, True),
        ("During Dayshift", "Wash dishes", 5, 26, True),
        ("During Dayshift", "Sweep & mop office & trash area", 4, 27, True),
        ("During Dayshift", "Box-top & fold boxes", 3, 28, True),
        ("During Dayshift", "Cleaning task of the day", 5, 29, True),
        ("During Dayshift", "Sweep / shovel / sand / entry area", 4, 30, True),
        ("During Dayshift", "Hang all laundry", 2, 31, True),
        ("During Dayshift", "Fill out temp log", 2, 32, True),
        ("During Dayshift", "2 hr sanitation swap - time stamp buckets", 2, 33, True),

        ("3-O'Clock Restock", "Restock makeline rail and cabinets", 4, 34, True),
        ("3-O'Clock Restock", "Restock cut table and clean & sanitize", 4, 35, True),
        ("3-O'Clock Restock", "Pick makeline pits - wash pits", 4, 36, True),
        ("3-O'Clock Restock", "Clean and sanitize dough table", 4, 37, True),
        ("3-O'Clock Restock", "Restock Coke and box counter", 3, 38, True),
        ("3-O'Clock Restock", "Sweep floor", 3, 39, True),
        ("3-O'Clock Restock", "Wash all remaining dishes", 4, 40, True),
        ("3-O'Clock Restock", "Call / post dayshift numbers as required", 2, 41, True),
        ("3-O'Clock Restock", "Dayshift cash-out complete & logged", 2, 42, True),

        ("Manager's Walk", "Carryout area clean - swept, mopped, wiped etc", 3, 43, True),
        ("Manager's Walk", "Under counter shelves clean", 3, 44, True),
        ("Manager's Walk", "All counters clean & sanitized", 3, 45, True),
        ("Manager's Walk", "Under phone counter clean and organized", 2, 46, True),
        ("Manager's Walk", "Oven clean, wiped incl catch trays & fan covers", 4, 47, True),
        ("Manager's Walk", "Organize office desktop & sweep floor", 3, 48, True),
        ("Manager's Walk", "Makeline clean and wiped down - in and out", 4, 49, True),
        ("Manager's Walk", "Cut table and blue bins clean", 3, 50, True),
        ("Manager's Walk", "Laundry started (dirty towels)", 2, 51, True),
        ("Manager's Walk", "3 comp & handsinks clean", 3, 52, True),
        ("Manager's Walk", "Front stocked with boxes", 2, 53, True),
        ("Manager's Walk", "Bag rack clean & neat", 2, 54, True),
        ("Manager's Walk", "Heat racks clean and wiped incl very top", 3, 55, True),
        ("Manager's Walk", "Floor clean - under everything", 4, 56, True),
        ("Manager's Walk", "Trash empty &/or out back", 3, 57, True),
        ("Manager's Walk", "All dishes clean - check them! & drying", 3, 58, True),
        ("Manager's Walk", "All equipment turned off - ovens, hoods, etc", 2, 59, True),
        ("Manager's Walk", "Back room clean / swept & mopped", 4, 60, True),
        ("Manager's Walk", "Mops & bucket rinsed and drying", 2, 61, True),
        ("Manager's Walk", "Utensils back in place up front", 2, 62, True),
        ("Manager's Walk", "Walk-in clean and organized - food covered", 4, 63, True),
        ("Manager's Walk", "Safe secure with till inside", 2, 64, True),
        ("Manager's Walk", "Accurate inventory - incl line-by-line check", 4, 65, True),
        ("Manager's Walk", "Call / post numbers as required", 2, 66, True),
        ("Manager's Walk", "Paperwork properly filed / EOD run", 3, 67, True),
    ]

    for section_name, task_text, expected_minutes, sort_order, is_required in items:
        db.session.add(
            ChecklistTemplateItem(
                company_id=trueops_company_id,
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
    from app.models import SVRTemplateField, Company

    trueops_company = Company.query.filter_by(slug="trueops").first()
    trueops_company_id = trueops_company.id if trueops_company else None

    # If old global SVR fields exist, assign them to TrueOps instead of
    # trying to insert duplicate field_key values.
    if trueops_company_id:
        global_fields = SVRTemplateField.query.filter(
            SVRTemplateField.company_id.is_(None)
        ).all()

        if global_fields:
            for field in global_fields:
                field.company_id = trueops_company_id
            db.session.commit()
            return

        existing_trueops_fields = SVRTemplateField.query.filter_by(
            company_id=trueops_company_id
        ).count()

        if existing_trueops_fields > 0:
            return
    elif SVRTemplateField.query.count() > 0:
        return

    fields = [
        ("date", "Date", "date", 1),
        ("store_number", "Store #", "readonly", 2),
        ("manager_on_duty", "Manager on duty", "text", 3),
        ("restroom_notes", "Restroom notes", "textarea", 4),
        ("checklist_book_notes", "Checklist book notes", "textarea", 5),
        ("one_way_proof", "1-way proof - dough projection/dough marked inside the walk-in", "textarea", 6),
        ("pizza_quality_notes", "Pizza Quality notes", "textarea", 7),
        ("load_go", "Load & Go - certified load captain on the schedule for every rush", "textarea", 8),
        ("last_weeks_svr_review", "Last week's SVR review", "textarea", 9),
        ("outside_store_condition_notes", "Outside store condition notes", "textarea", 10),
        ("carry_out_notes", "Carry out notes", "textarea", 11),
        ("store_condition_notes", "Store condition notes", "textarea", 12),
        ("refrigeration_units_notes", "Refrigeration units notes", "textarea", 13),
        ("bake_wares_notes", "Bake wares notes", "textarea", 14),
        ("oven_heatrack_notes", "Oven/heatrack notes", "textarea", 15),
        ("call_out_calendar_notes", "Call out calendar notes - who needs a meeting?", "textarea", 16),
        ("deposit_log", "Deposit Log - which days are missing?", "textarea", 17),
        ("pest_control", "Pest Control", "textarea", 18),
        ("cleaning_list_for_week", "Cleaning list for the week", "textarea", 19),
        ("goals_for_week", "Goals for the week", "textarea", 20),
        ("maintenance_needs", "Maintenance needs", "textarea", 21),
    ]

    for field_key, field_label, field_type, sort_order in fields:
        existing = SVRTemplateField.query.filter_by(
            company_id=trueops_company_id,
            field_key=field_key,
        ).first()

        if existing:
            continue

        db.session.add(
            SVRTemplateField(
                company_id=trueops_company_id,
                field_key=field_key,
                field_label=field_label,
                field_type=field_type,
                sort_order=sort_order,
                is_active=True,
            )
        )

    db.session.commit()

