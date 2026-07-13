from datetime import datetime

from flask import Blueprint, g, jsonify, request

from app.extensions import db
from app.models import (
    NightlyNumbersFieldConfig,
    NightlyNumbersReport,
    NightlyNumbersReportValue,
    Store,
)
from app.mobile_api.permissions import (
    mobile_error,
    mobile_login_required,
    scoped_store_query_for_user,
    user_can_access_store_number,
)
from app.nightly_numbers.routes import (
    FIELD_META,
    FIXED_NIGHTLY_REPORT_FIELDS,
    current_business_date,
    ensure_field_config_seeded,
    normalize_field_value,
    parse_float,
    send_nightly_numbers_email,
)


mobile_nightly_numbers_bp = Blueprint(
    "mobile_nightly_numbers",
    __name__,
    url_prefix="/api/mobile/nightly-numbers",
)


NUMERIC_FIELDS = {
    "royalty_sales",
    "variable_labor",
    "labor_goal",
    "food_variance",
    "adt",
    "cash_diff",
}


def normalize_role(user):
    return (getattr(user, "role", "") or "").strip().lower()


def user_can_submit_nightly_numbers(user):
    return normalize_role(user) == "manager"


def field_query(company_id):
    return (
        NightlyNumbersFieldConfig.query
        .filter(
            NightlyNumbersFieldConfig.company_id == company_id,
        )
        .order_by(
            NightlyNumbersFieldConfig.sort_order.asc(),
            NightlyNumbersFieldConfig.id.asc(),
        )
    )


def enabled_fields(company_id):
    ensure_field_config_seeded(company_id)

    return [
        field
        for field in field_query(company_id).all()
        if field.is_enabled
    ]


def serialize_store(store):
    return {
        "id": store.id,
        "company_id": store.company_id,
        "store_number": str(store.store_number),
        "name": getattr(store, "store_name", "") or "",
        "area_name": store.area_name or "",
    }


def get_custom_value(report, field_key):
    if not report:
        return None

    for value in report.custom_values or []:
        if value.field_key == field_key:
            return value.value_text

    return None


def get_report_value(report, field):
    if not report:
        return None

    if field.field_key in FIXED_NIGHTLY_REPORT_FIELDS:
        value = getattr(report, field.field_key, None)

        if field.field_type == "checkbox":
            return bool(value)

        return value

    value = get_custom_value(report, field.field_key)

    if field.field_type == "checkbox":
        return str(value or "").strip().lower() in {
            "yes",
            "true",
            "1",
            "on",
        }

    return value


def serialize_field(field, report=None):
    value = get_report_value(report, field)

    if value is None:
        value = FIELD_META.get(field.field_key, {}).get("default", "")

    return {
        "id": field.id,
        "field_key": field.field_key,
        "field_label": field.field_label,
        "field_type": field.field_type,
        "sort_order": field.sort_order,
        "is_required": bool(field.is_required),
        "placeholder": FIELD_META.get(
            field.field_key,
            {},
        ).get("placeholder", ""),
        "value": value,
    }


def find_report(company_id, store_number, report_date):
    return (
        NightlyNumbersReport.query
        .filter_by(
            company_id=company_id,
            store_number=str(store_number),
            report_date=report_date,
        )
        .first()
    )


def set_custom_value(report, field, raw_value):
    existing = None

    for value in report.custom_values or []:
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
    existing.value_text = normalize_field_value(
        field,
        raw_value,
    )


def apply_value(report, field, raw_value):
    field_key = field.field_key

    if field_key not in FIXED_NIGHTLY_REPORT_FIELDS:
        set_custom_value(
            report,
            field,
            raw_value,
        )
        return

    if field.field_type == "checkbox":
        setattr(
            report,
            field_key,
            bool(raw_value),
        )
        return

    text_value = str(raw_value or "").strip()

    if field_key in NUMERIC_FIELDS:
        setattr(
            report,
            field_key,
            parse_float(text_value),
        )
        return

    setattr(
        report,
        field_key,
        text_value or None,
    )


def validate_required_fields(fields, values):
    missing = []

    for field in fields:
        if not field.is_required:
            continue

        raw_value = values.get(field.field_key)

        if field.field_type == "checkbox":
            if raw_value is not True:
                missing.append(field.field_label)
            continue

        if str(raw_value or "").strip() == "":
            missing.append(field.field_label)

    return missing


@mobile_nightly_numbers_bp.get("/stores")
@mobile_login_required
def nightly_numbers_stores():
    user = g.mobile_user

    stores = (
        scoped_store_query_for_user(user, Store)
        .order_by(Store.store_number.asc())
        .all()
    )

    return jsonify({
        "success": True,
        "can_submit": user_can_submit_nightly_numbers(user),
        "stores": [
            serialize_store(store)
            for store in stores
        ],
    })


@mobile_nightly_numbers_bp.get("/form")
@mobile_login_required
def nightly_numbers_form():
    user = g.mobile_user
    company_id = user.company_id

    if not user_can_submit_nightly_numbers(user):
        return mobile_error(
            "Nightly Numbers submission is available to store managers.",
            403,
        )

    store_number = (
        request.args.get("store_number")
        or user.store_number
        or ""
    ).strip()

    if not store_number:
        return mobile_error(
            "No store is assigned to this user.",
            400,
        )

    if not user_can_access_store_number(
        user,
        Store,
        store_number,
    ):
        return mobile_error(
            "You do not have access to that store.",
            403,
        )

    report_date_text = (
        request.args.get("report_date")
        or current_business_date().isoformat()
    )

    try:
        report_date = datetime.strptime(
            report_date_text,
            "%Y-%m-%d",
        ).date()
    except ValueError:
        return mobile_error(
            "Invalid report date.",
            400,
        )

    store = (
        Store.query
        .filter_by(
            company_id=company_id,
            store_number=store_number,
            is_active=True,
        )
        .first()
    )

    if not store:
        return mobile_error(
            "Store not found.",
            404,
        )

    report = find_report(
        company_id,
        store_number,
        report_date,
    )

    fields = enabled_fields(company_id)

    return jsonify({
        "success": True,
        "business_date": current_business_date().isoformat(),
        "report_date": report_date.isoformat(),
        "store": serialize_store(store),
        "report_id": report.id if report else None,
        "has_existing_report": bool(report),
        "fields": [
            serialize_field(
                field,
                report,
            )
            for field in fields
        ],
    })


@mobile_nightly_numbers_bp.post("/submit")
@mobile_login_required
def submit_nightly_numbers():
    user = g.mobile_user
    company_id = user.company_id

    if not user_can_submit_nightly_numbers(user):
        return mobile_error(
            "Nightly Numbers submission is available to store managers.",
            403,
        )

    payload = request.get_json(silent=True) or {}

    store_number = str(
        payload.get("store_number")
        or user.store_number
        or ""
    ).strip()

    if not store_number:
        return mobile_error(
            "Store is required.",
            400,
        )

    if not user_can_access_store_number(
        user,
        Store,
        store_number,
    ):
        return mobile_error(
            "You do not have access to that store.",
            403,
        )

    report_date_text = str(
        payload.get("report_date")
        or current_business_date().isoformat()
    ).strip()

    try:
        report_date = datetime.strptime(
            report_date_text,
            "%Y-%m-%d",
        ).date()
    except ValueError:
        return mobile_error(
            "Invalid report date.",
            400,
        )

    values = payload.get("values") or {}

    if not isinstance(values, dict):
        return mobile_error(
            "Invalid Nightly Numbers values.",
            400,
        )

    fields = enabled_fields(company_id)

    missing_fields = validate_required_fields(
        fields,
        values,
    )

    if missing_fields:
        return mobile_error(
            "Complete required fields: "
            + ", ".join(missing_fields),
            400,
        )

    report = find_report(
        company_id,
        store_number,
        report_date,
    )

    created = report is None

    if not report:
        report = NightlyNumbersReport(
            company_id=company_id,
            store_number=store_number,
            report_date=report_date,
            created_by_user_id=user.id,
        )
        db.session.add(report)
        db.session.flush()

    for field in fields:
        apply_value(
            report,
            field,
            values.get(field.field_key),
        )

    db.session.commit()

    email_sent = False
    email_error = None
    email_result = None

    try:
        email_result = send_nightly_numbers_email(
            report,
            company_id=company_id,
        )
        email_sent = True
    except Exception as exc:
        email_error = str(exc)

    return jsonify({
        "success": True,
        "created": created,
        "report_id": report.id,
        "store_number": report.store_number,
        "report_date": report.report_date.isoformat(),
        "email_sent": email_sent,
        "email_error": email_error,
        "email": email_result,
        "message": (
            "Nightly numbers saved and emailed."
            if email_sent
            else "Nightly numbers saved, but the email could not be sent."
        ),
    })
