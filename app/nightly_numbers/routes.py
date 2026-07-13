from datetime import datetime, timedelta
import re
from zoneinfo import ZoneInfo

from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify

from app.auth.routes import login_required, role_required
from app.extensions import db
from app.services.tenant import scoped_get_or_404
from app.models import NightlyNumbersReport, NightlyNumbersFieldConfig, NightlyNumbersReportValue, Store, User
from app.services.email_service import send_email

nightly_numbers_bp = Blueprint("nightly_numbers", __name__, url_prefix="/nightly-numbers")

APP_TZ = ZoneInfo("America/New_York")
BUSINESS_DAY_CUTOFF_HOUR = 5

DEFAULT_FIELD_CONFIG = [
    {
        "field_key": "manager_name",
        "field_label": "Your Name",
        "field_type": "text",
        "sort_order": 0,
        "is_enabled": True,
        "is_required": True,
    },
    {
        "field_key": "royalty_sales",
        "field_label": "Royalty Sales",
        "field_type": "text",
        "sort_order": 1,
        "is_enabled": True,
        "is_required": True,
    },
    {
        "field_key": "variable_labor",
        "field_label": "Labor Variance",
        "field_type": "text",
        "sort_order": 2,
        "is_enabled": True,
        "is_required": True,
    },
    {
        "field_key": "labor_goal",
        "field_label": "Variance to Ideal",
        "field_type": "text",
        "sort_order": 3,
        "is_enabled": True,
        "is_required": True,
    },
    {
        "field_key": "invoices_transfers_checked",
        "field_label": "Invoices / Transfers Checked",
        "field_type": "checkbox",
        "sort_order": 4,
        "is_enabled": True,
        "is_required": False,
    },
    {
        "field_key": "food_variance",
        "field_label": "Food Variance",
        "field_type": "text",
        "sort_order": 5,
        "is_enabled": True,
        "is_required": True,
    },
    {
        "field_key": "food_variance_details",
        "field_label": "Food Variance Details",
        "field_type": "textarea",
        "sort_order": 6,
        "is_enabled": True,
        "is_required": False,
    },
    {
        "field_key": "adt",
        "field_label": "ADT",
        "field_type": "text",
        "sort_order": 7,
        "is_enabled": True,
        "is_required": True,
    },
    {
        "field_key": "adt_reason",
        "field_label": "ADT Above 25 Min - Why?",
        "field_type": "textarea",
        "sort_order": 8,
        "is_enabled": True,
        "is_required": False,
    },
    {
        "field_key": "load_time",
        "field_label": "Load Time",
        "field_type": "text",
        "sort_order": 9,
        "is_enabled": True,
        "is_required": True,
    },
    {
        "field_key": "bad_orders",
        "field_label": "Bad Orders - Record Order #",
        "field_type": "textarea",
        "sort_order": 10,
        "is_enabled": True,
        "is_required": False,
    },
    {
        "field_key": "cash_diff",
        "field_label": "Cash +/-",
        "field_type": "text",
        "sort_order": 11,
        "is_enabled": True,
        "is_required": True,
    },
    {
        "field_key": "food_order_placed",
        "field_label": "Food Order Placed",
        "field_type": "checkbox",
        "sort_order": 12,
        "is_enabled": True,
        "is_required": False,
    },
]


FIXED_NIGHTLY_REPORT_FIELDS = {
    "manager_name",
    "royalty_sales",
    "variable_labor",
    "labor_goal",
    "invoices_transfers_checked",
    "food_variance",
    "food_variance_details",
    "adt",
    "adt_reason",
    "load_time",
    "bad_orders",
    "cash_diff",
    "food_order_placed",
}


def make_field_key(label):
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "_", (label or "").strip().lower()).strip("_")
    return cleaned or "custom_field"


def unique_field_key(base_key):
    company_id = current_company_id()
    key = base_key
    counter = 2

    while NightlyNumbersFieldConfig.query.filter_by(company_id=company_id, field_key=key).first():
        key = f"{base_key}_{counter}"
        counter += 1

    return key


def is_fixed_report_field(field_key):
    return field_key in FIXED_NIGHTLY_REPORT_FIELDS


def normalize_field_value(field, raw_value):
    if field.field_type == "checkbox":
        return "Yes" if raw_value in [True, "true", "True", "1", "yes", "Yes", "on"] else "No"

    if raw_value is None:
        return ""

    return str(raw_value)


def get_custom_report_value(report, field_key):
    if not report:
        return None

    for value in getattr(report, "custom_values", []) or []:
        if value.field_key == field_key:
            return value.value_text

    return None


def set_custom_report_value(report, field, raw_value):
    existing = None

    for value in getattr(report, "custom_values", []) or []:
        if value.field_key == field.field_key:
            existing = value
            break

    if not existing:
        existing = NightlyNumbersReportValue(
            report_id=report.id,
            field_config_id=field.id,
            field_key=field.field_key,
            field_label=field.field_label,
            field_type=field.field_type,
            sort_order=field.sort_order,
        )
        db.session.add(existing)

    existing.field_config_id = field.id
    existing.field_label = field.field_label
    existing.field_type = field.field_type
    existing.sort_order = field.sort_order
    existing.value_text = normalize_field_value(field, raw_value)


def get_report_display_value(report, field):
    if is_fixed_report_field(field.field_key):
        value = getattr(report, field.field_key, None)

        if field.field_type == "checkbox":
            return "Yes" if value else "No"

        return value

    return get_custom_report_value(report, field.field_key)


def build_report_field_values(reports, fields):
    output = {}

    for report in reports:
        output[report.id] = {}
        for field in fields:
            output[report.id][field.field_key] = get_report_display_value(report, field)

    return output


FIELD_META = {
    "manager_name": {
        "placeholder": "Enter your name",
    },
    "royalty_sales": {
        "placeholder": "Example: 8249.55",
    },
    "variable_labor": {
        "placeholder": "Example: 20.00",
    },
    "labor_goal": {
        "placeholder": "Example: 21.0",
        "default": "21.0",
    },
    "food_variance": {
        "placeholder": "Example: 0.01",
    },
    "food_variance_details": {
        "placeholder": "Explain variances if needed",
        "rows": 3,
    },
    "adt": {
        "placeholder": "Example: 27.83",
    },
    "adt_reason": {
        "placeholder": "Explain if ADT was above target",
        "rows": 3,
    },
    "load_time": {
        "placeholder": "Example: 04:59",
    },
    "bad_orders": {
        "placeholder": "Order numbers or notes",
        "rows": 3,
    },
    "cash_diff": {
        "placeholder": "Example: -11.53",
    },
}


def current_company_id():
    return session.get("current_company_id")


def current_business_date():
    now_et = datetime.now(APP_TZ)
    if now_et.hour < BUSINESS_DAY_CUTOFF_HOUR:
        return now_et.date() - timedelta(days=1)
    return now_et.date()


def nightly_numbers_config_query(company_id=None):
    company_id = company_id or current_company_id()

    query = NightlyNumbersFieldConfig.query

    if company_id and hasattr(NightlyNumbersFieldConfig, "company_id"):
        query = query.filter(
            NightlyNumbersFieldConfig.company_id == company_id
        )

    return query


def ensure_field_config_seeded(company_id=None):
    company_id = company_id or current_company_id()

    if not company_id:
        return

    existing_count = NightlyNumbersFieldConfig.query.filter_by(
        company_id=company_id
    ).count()

    if existing_count > 0:
        return

    source_company_row = db.session.execute(
        db.text("""
            SELECT company_id
            FROM nightly_numbers_field_config
            WHERE company_id IS NOT NULL
              AND company_id != :company_id
            GROUP BY company_id
            ORDER BY MIN(sort_order) ASC, MIN(id) ASC
            LIMIT 1
        """),
        {"company_id": company_id},
    ).first()

    source_fields = []
    if source_company_row:
        source_fields = NightlyNumbersFieldConfig.query.filter(
            NightlyNumbersFieldConfig.company_id == source_company_row[0]
        ).order_by(
            NightlyNumbersFieldConfig.sort_order.asc(),
            NightlyNumbersFieldConfig.id.asc(),
        ).all()

    if not source_fields:
        source_fields = NightlyNumbersFieldConfig.query.filter(
            NightlyNumbersFieldConfig.company_id.is_(None)
        ).order_by(
            NightlyNumbersFieldConfig.sort_order.asc(),
            NightlyNumbersFieldConfig.id.asc(),
        ).all()

    if source_fields:
        seen_field_keys = set()

        for field in source_fields:
            if field.field_key in seen_field_keys:
                continue

            seen_field_keys.add(field.field_key)

            db.session.add(
                NightlyNumbersFieldConfig(
                    company_id=company_id,
                    field_key=field.field_key,
                    field_label=field.field_label,
                    field_type=field.field_type,
                    sort_order=field.sort_order,
                    is_enabled=field.is_enabled,
                    is_required=field.is_required,
                )
            )

        db.session.commit()
        return

    for field_def in DEFAULT_FIELD_CONFIG:
        db.session.add(
            NightlyNumbersFieldConfig(
                company_id=company_id,
                **field_def,
            )
        )

    db.session.commit()


def get_field_config(company_id=None):
    company_id = company_id or current_company_id()

    ensure_field_config_seeded(company_id)

    return nightly_numbers_config_query(company_id).order_by(
        NightlyNumbersFieldConfig.sort_order.asc(),
        NightlyNumbersFieldConfig.id.asc(),
    ).all()


def get_visible_stores():
    role = session.get("user_role")
    user_area = session.get("user_area")
    user_store = session.get("user_store")
    company_id = current_company_id()

    if role == "admin":
        query = Store.query.filter_by(is_active=True)
        if company_id:
            query = query.filter_by(company_id=company_id)
        return query.order_by(Store.store_number.asc()).all()

    if role == "supervisor":
        return Store.query.filter_by(
            company_id=company_id,
            area_name=user_area,
            is_active=True
        ).order_by(Store.store_number.asc()).all()

    if role == "manager":
        return Store.query.filter_by(
            company_id=company_id,
            store_number=user_store,
            is_active=True
        ).order_by(Store.store_number.asc()).all()

    return []


def parse_float(value):
    value = (value or "").strip().replace(",", "")
    if value == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def get_report_value(report, field_key):
    if not report:
        return None

    if is_fixed_report_field(field_key):
        return getattr(report, field_key, None)

    return get_custom_report_value(report, field_key)


def apply_form_value_to_report(report, field):
    field_key = field.field_key

    if not is_fixed_report_field(field_key):
        if field.field_type == "checkbox":
            raw_value = request.form.get(field_key) == "on"
        else:
            raw_value = request.form.get(field_key, "").strip()
        set_custom_report_value(report, field, raw_value)
        return

    if field.field_type == "checkbox":
        setattr(report, field_key, request.form.get(field_key) == "on")
        return

    raw_value = request.form.get(field_key, "").strip()

    if field_key in [
        "royalty_sales",
        "variable_labor",
        "labor_goal",
        "food_variance",
        "adt",
        "cash_diff",
    ]:
        setattr(report, field_key, parse_float(raw_value))
        return

    setattr(report, field_key, raw_value or None)


def send_nightly_numbers_email(
    report: NightlyNumbersReport,
    company_id=None,
):
    company_id = company_id or report.company_id or current_company_id()

    store = Store.query.filter_by(
        company_id=company_id,
        store_number=report.store_number
    ).first()

    if not store:
        raise ValueError(f"Store {report.store_number} is not in the selected company.")

    manager_user = User.query.filter_by(
        company_id=company_id,
        store_number=report.store_number,
        role="manager",
        is_active=True
    ).first()

    manager_email = manager_user.get_notification_email() if manager_user else None

    supervisor = User.query.filter_by(
        company_id=company_id,
        area_name=store.area_name,
        role="supervisor",
        is_active=True
    ).first()

    supervisor_email = supervisor.get_notification_email() if supervisor else None

    admin_users = User.query.filter(
        User.company_id == company_id,
        User.role.in_(["admin", "platform_admin"]),
        User.is_active == True
    ).all()

    admin_emails = []
    for admin in admin_users:
        email = admin.get_notification_email()
        if email:
            admin_emails.append(email)

    cc_emails = []
    if supervisor_email:
        cc_emails.append(supervisor_email)
    cc_emails.extend(admin_emails)

    cc_emails = [email for email in dict.fromkeys(cc_emails) if email and email != manager_email]

    if not manager_email:
        raise ValueError(f"No manager notification email configured for store {report.store_number}.")

    fields = (
        NightlyNumbersFieldConfig.query
        .filter(
            NightlyNumbersFieldConfig.company_id == company_id,
        )
        .order_by(
            NightlyNumbersFieldConfig.sort_order.asc(),
            NightlyNumbersFieldConfig.id.asc(),
        )
        .all()
    )

    enabled_fields = [
        field
        for field in fields
        if field.is_enabled
    ]

    lines = [
        "Nightly Numbers Report",
        f"Store: {report.store_number}",
        f"Date: {report.report_date.strftime('%B %d, %Y')}",
        "",
    ]

    for field in enabled_fields:
        value = get_report_display_value(report, field)

        if value is None or value == "":
            value = "Not provided"

        lines.append(f"{field.field_label}: {value}")

    if report.variable_labor is not None and report.labor_goal is not None:
        diff = round(report.variable_labor - report.labor_goal, 2)
        if diff > 0:
            lines.append(f"Labor Status: Above ideal by {diff}")
        elif diff < 0:
            lines.append(f"Labor Status: Below ideal by {abs(diff)}")
        else:
            lines.append("Labor Status: On ideal")

    lines.extend(["", "- TrueOps"])

    body = "\n".join(lines)

    send_email(
        to_email=manager_email,
        subject=f"Store {report.store_number} Nightly Numbers - {report.report_date.strftime('%b %d, %Y')}",
        body=body,
        cc_emails=cc_emails if cc_emails else None
    )

    return {
        "manager_email": manager_email,
        "supervisor_email": supervisor_email,
        "admin_emails": admin_emails,
    }


@nightly_numbers_bp.route("/", methods=["GET", "POST"])
@login_required
@role_required("manager", "admin", "supervisor")
def index():
    role = session.get("user_role")
    user_store = session.get("user_store")
    company_id = current_company_id()

    if role != "manager":
        return redirect(url_for("nightly_numbers.admin"))

    if not user_store:
        flash("No store is assigned to this manager.", "error")
        return redirect(url_for("dashboard.home"))

    store = Store.query.filter_by(
        company_id=company_id,
        store_number=user_store,
        is_active=True
    ).first()

    if not store:
        flash("Your store is not in the selected company.", "error")
        return redirect(url_for("dashboard.home"))

    fields = get_field_config()
    business_date = current_business_date()
    today_str = business_date.strftime("%Y-%m-%d")

    if request.method == "POST":
        report_date_str = request.form.get("report_date", "").strip() or today_str

        try:
            report_date = datetime.strptime(report_date_str, "%Y-%m-%d").date()
        except ValueError:
            flash("Invalid report date.", "error")
            return redirect(url_for("nightly_numbers.index"))

        report = NightlyNumbersReport.query.filter_by(
            company_id=company_id,
            store_number=user_store,
            report_date=report_date,
        ).first()

        if not report:
            report = NightlyNumbersReport(
                company_id=company_id,
                store_number=user_store,
                report_date=report_date,
                created_by_user_id=session.get("user_id"),
            )
            db.session.add(report)
            db.session.flush()

        for field in fields:
            apply_form_value_to_report(report, field)

        db.session.commit()

        try:
            email_result = send_nightly_numbers_email(report)
            flash(
                f"Nightly numbers saved and emailed to {email_result['manager_email']}.",
                "success"
            )
        except Exception as e:
            flash(f"Nightly numbers saved, but email failed: {str(e)}", "error")

        return redirect(url_for("nightly_numbers.index", reset=1))

    reset = request.args.get("reset")
    existing_report = None

    if not reset:
        existing_report = NightlyNumbersReport.query.filter_by(
            company_id=company_id,
            store_number=user_store,
            report_date=business_date,
        ).first()

    field_values = {}
    for field in fields:
        value = get_report_value(existing_report, field.field_key)

        if value is None and field.field_key in FIELD_META and "default" in FIELD_META[field.field_key]:
            value = FIELD_META[field.field_key]["default"]

        field_values[field.field_key] = value

    return render_template(
        "nightly_numbers.html",
        report=existing_report,
        today_str=today_str,
        store_number=user_store,
        fields=fields,
        field_values=field_values,
        field_meta=FIELD_META,
    )


@nightly_numbers_bp.route("/admin", methods=["GET", "POST"])
@login_required
@role_required("admin", "supervisor")
def admin():
    show_inactive = request.args.get("show_inactive") == "1"

    fields = get_field_config()
    if not show_inactive:
        fields = [field for field in fields if field.is_enabled]

    if request.method == "POST":
        is_ajax = request.headers.get("X-Requested-With") == "XMLHttpRequest"

        if session.get("user_role") != "admin":
            if is_ajax:
                return jsonify({
                    "success": False,
                    "message": "Only admins can update nightly form settings."
                }), 403

            flash("Only admins can update nightly form settings.", "error")
            return redirect(url_for("nightly_numbers.admin"))

        action = request.form.get("action", "").strip()


        if action == "create_field":
            field_label = request.form.get("field_label", "").strip()
            field_type = request.form.get("field_type", "text").strip()
            sort_order_raw = request.form.get("sort_order", "999").strip()
            is_enabled = request.form.get("is_enabled") == "on"
            is_required = request.form.get("is_required") == "on"

            allowed_types = {"text", "textarea", "checkbox", "number", "money", "percent"}
            if field_type not in allowed_types:
                field_type = "text"

            if not field_label:
                flash("Field label is required.", "error")
                return redirect(url_for("nightly_numbers.admin"))

            try:
                sort_order = int(sort_order_raw)
            except ValueError:
                sort_order = 999

            base_key = make_field_key(field_label)
            field_key = unique_field_key(base_key)

            db.session.add(
                NightlyNumbersFieldConfig(
                    company_id=current_company_id(),
                    field_key=field_key,
                    field_label=field_label,
                    field_type=field_type,
                    sort_order=sort_order,
                    is_enabled=is_enabled,
                    is_required=is_required,
                )
            )
            db.session.commit()

            flash("Nightly field created.", "success")
            return redirect(url_for("nightly_numbers.admin"))

        # Handles the autosave rows from nightly_numbers_admin.html.
        if action == "update_single_field":
            field_id = request.form.get("field_id", "").strip()

            try:
                field_id_int = int(field_id)
            except ValueError:
                return jsonify({
                    "success": False,
                    "message": "Invalid field id."
                }), 400

            field = nightly_numbers_config_query().filter(
                NightlyNumbersFieldConfig.id == field_id_int
            ).first()

            if not field:
                return jsonify({
                    "success": False,
                    "message": "Field not found."
                }), 404

            field_label = request.form.get("field_label", "").strip()
            field_type = request.form.get("field_type", field.field_type).strip()
            sort_order_raw = request.form.get("sort_order", str(field.sort_order)).strip()

            allowed_types = {"text", "textarea", "checkbox", "number", "money", "percent"}
            if field_type not in allowed_types:
                field_type = "text"

            try:
                sort_order = int(sort_order_raw)
            except ValueError:
                sort_order = field.sort_order

            if field_label:
                field.field_label = field_label

            field.field_type = field_type
            field.sort_order = sort_order
            field.is_enabled = request.form.get("is_enabled") == "1"
            field.is_required = request.form.get("is_required") == "1"

            db.session.commit()

            return jsonify({
                "success": True,
                "field_id": field.id,
                "field_label": field.field_label,
                "field_type": field.field_type,
                "sort_order": field.sort_order,
                "is_enabled": field.is_enabled,
                "is_required": field.is_required,
            })

        # Keeps support for the older full-form save format, just in case.
        for field in fields:
            field.field_label = request.form.get(
                f"label_{field.id}",
                field.field_label
            ).strip() or field.field_label

            field.is_enabled = request.form.get(f"enabled_{field.id}") == "on"
            field.is_required = request.form.get(f"required_{field.id}") == "on"

        db.session.commit()

        if is_ajax:
            return jsonify({
                "success": True,
                "message": "Nightly form settings updated."
            })

        flash("Nightly form settings updated.", "success")
        return redirect(url_for("nightly_numbers.admin"))

    visible_stores = get_visible_stores()
    visible_store_numbers = {store.store_number for store in visible_stores}

    selected_store = request.args.get("store", "").strip()
    selected_date = request.args.get("date", "").strip()

    query = NightlyNumbersReport.query

    company_id = current_company_id()
    if company_id and hasattr(NightlyNumbersReport, "company_id"):
        query = query.filter(NightlyNumbersReport.company_id == company_id)

    if selected_store:
        query = query.filter_by(store_number=selected_store)

    if selected_date:
        try:
            parsed_date = datetime.strptime(selected_date, "%Y-%m-%d").date()
            query = query.filter_by(report_date=parsed_date)
        except ValueError:
            flash("Invalid date filter ignored.", "error")

    reports = query.order_by(
        NightlyNumbersReport.report_date.desc(),
        NightlyNumbersReport.store_number.asc()
    ).all()

    reports = [r for r in reports if r.store_number in visible_store_numbers]
    report_field_values = build_report_field_values(reports, fields)

    return render_template(
        "nightly_numbers_admin.html",
        reports=reports,
        stores=visible_stores,
        selected_store=selected_store,
        selected_date=selected_date,
        fields=fields,
        show_inactive=show_inactive,
        report_field_values=report_field_values,
    )


@nightly_numbers_bp.route("/reports", methods=["GET"])
@login_required
@role_required("admin", "supervisor")
def reports():
    fields = get_field_config()
    fields = [field for field in fields if field.is_enabled]

    visible_stores = get_visible_stores()
    visible_store_numbers = {store.store_number for store in visible_stores}

    selected_store = request.args.get("store", "").strip()
    selected_date = request.args.get("date", "").strip()

    query = NightlyNumbersReport.query

    company_id = current_company_id()
    if company_id and hasattr(NightlyNumbersReport, "company_id"):
        query = query.filter(NightlyNumbersReport.company_id == company_id)

    if selected_store:
        query = query.filter_by(store_number=selected_store)

    if selected_date:
        try:
            parsed_date = datetime.strptime(selected_date, "%Y-%m-%d").date()
            query = query.filter_by(report_date=parsed_date)
        except ValueError:
            flash("Invalid date filter ignored.", "error")

    reports = query.order_by(
        NightlyNumbersReport.report_date.desc(),
        NightlyNumbersReport.store_number.asc()
    ).all()

    reports = [report for report in reports if report.store_number in visible_store_numbers]
    report_field_values = build_report_field_values(reports, fields)

    report_metrics = {
        "report_count": len(reports),
        "store_count": len({report.store_number for report in reports}),
        "labor_high_count": sum(
            1 for report in reports
            if report.variable_labor is not None
            and report.labor_goal is not None
            and report.variable_labor > report.labor_goal
        ),
        "adt_high_count": sum(
            1 for report in reports
            if report.adt is not None and report.adt > 25
        ),
    }

    return render_template(
        "nightly_numbers_reports.html",
        reports=reports,
        report_metrics=report_metrics,
        stores=visible_stores,
        selected_store=selected_store,
        selected_date=selected_date,
        fields=fields,
        report_field_values=report_field_values,
    )


@nightly_numbers_bp.route("/admin/<int:report_id>", methods=["GET", "POST"])
@login_required
@role_required("admin")
def edit_report(report_id):
    report = scoped_get_or_404(NightlyNumbersReport, report_id)

    visible_store_numbers = {store.store_number for store in get_visible_stores()}
    if report.store_number not in visible_store_numbers:
        flash("You do not have access to that nightly report.", "error")
        return redirect(url_for("nightly_numbers.admin"))

    if request.method == "POST":
        report_date_str = request.form.get("report_date", "").strip()

        try:
            report.report_date = datetime.strptime(report_date_str, "%Y-%m-%d").date()
        except ValueError:
            flash("Invalid report date.", "error")
            return redirect(url_for("nightly_numbers.edit_report", report_id=report.id))

        report.manager_name = request.form.get("manager_name", "").strip() or None
        report.royalty_sales = parse_float(request.form.get("royalty_sales"))
        report.variable_labor = parse_float(request.form.get("variable_labor"))
        report.labor_goal = parse_float(request.form.get("labor_goal"))
        report.invoices_transfers_checked = request.form.get("invoices_transfers_checked") == "on"
        report.food_variance = parse_float(request.form.get("food_variance"))
        report.food_variance_details = request.form.get("food_variance_details", "").strip() or None
        report.adt = parse_float(request.form.get("adt"))
        report.adt_reason = request.form.get("adt_reason", "").strip() or None
        report.load_time = request.form.get("load_time", "").strip() or None
        report.bad_orders = request.form.get("bad_orders", "").strip() or None
        report.cash_diff = parse_float(request.form.get("cash_diff"))
        report.food_order_placed = request.form.get("food_order_placed") == "on"

        db.session.commit()
        flash("Nightly numbers report updated.", "success")
        return redirect(url_for("nightly_numbers.admin"))

    return render_template(
        "nightly_numbers_edit.html",
        report=report,
    )