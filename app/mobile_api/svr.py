from datetime import datetime

from flask import Blueprint, g, jsonify, request

from app.extensions import db
from app.models import Company, Store, SVRReport, SVRReportValue, SVRTemplateField
from app.mobile_api.permissions import mobile_error, mobile_login_required
from app.svr.routes import (
    sync_maintenance_from_svr,
    sync_weekly_focus_from_svr,
    today_et,
)


mobile_svr_bp = Blueprint(
    "mobile_svr",
    __name__,
    url_prefix="/api/mobile/svr",
)


def normalize_role(user):
    if getattr(user, "is_platform_admin", False):
        return "platform_admin"

    return (getattr(user, "role", "") or "").strip().lower()


def visible_store_query(user):
    role = normalize_role(user)

    query = Store.query.filter_by(
        company_id=user.company_id,
        is_active=True,
    )

    if role in {"admin", "hr", "coach", "maintenance"}:
        return query

    if role == "supervisor":
        return query.filter(Store.area_name == user.area_name)

    if role in {"general_manager", "manager"}:
        return query.filter(Store.store_number == user.store_number)

    return query.filter(Store.id == -1)


def visible_store_numbers(user):
    return {str(store.store_number) for store in visible_store_query(user).all()}


def resolve_store_for_user(user, store_number):
    store_number = str(store_number or "").strip()

    if not store_number:
        first_store = visible_store_query(user).order_by(Store.store_number.asc()).first()
        store_number = first_store.store_number if first_store else ""

    if not store_number:
        return None

    if store_number not in visible_store_numbers(user):
        return None

    query = Store.query.filter_by(
        store_number=store_number,
        is_active=True,
    )

    query = query.filter_by(company_id=user.company_id)

    return query.first()


def active_template_fields_for_company(company_id):
    def active(query):
        return query.filter(SVRTemplateField.is_active == True)

    if company_id:
        company_query = active(
            SVRTemplateField.query.filter(SVRTemplateField.company_id == company_id)
        )

        if company_query.count() > 0:
            return company_query.order_by(
                SVRTemplateField.sort_order.asc(),
                SVRTemplateField.id.asc(),
            ).all()

    trueops_company = Company.query.filter_by(slug="trueops").first()
    trueops_company_id = trueops_company.id if trueops_company else None

    if trueops_company_id:
        master_query = active(
            SVRTemplateField.query.filter(SVRTemplateField.company_id == trueops_company_id)
        )

        if master_query.count() > 0:
            return master_query.order_by(
                SVRTemplateField.sort_order.asc(),
                SVRTemplateField.id.asc(),
            ).all()

    return active(
        SVRTemplateField.query.filter(SVRTemplateField.company_id.is_(None))
    ).order_by(
        SVRTemplateField.sort_order.asc(),
        SVRTemplateField.id.asc(),
    ).all()


def parse_visit_date(value):
    value = (value or "").strip()

    if not value:
        return today_et()

    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def serialize_store(store):
    return {
        "id": store.id,
        "store_number": store.store_number,
        "name": getattr(store, "store_name", "") or "",
        "area_name": store.area_name,
        "company_id": store.company_id,
    }


def serialize_field(field):
    return {
        "id": field.id,
        "field_key": field.field_key,
        "field_label": field.field_label,
        "field_type": field.field_type,
        "sort_order": field.sort_order,
    }


def serialize_report(report):
    values = sorted(report.values, key=lambda value: (value.sort_order, value.id))

    return {
        "id": report.id,
        "company_id": report.company_id,
        "store_number": report.store_number,
        "visit_date": report.visit_date.isoformat() if report.visit_date else None,
        "manager_on_duty": report.manager_on_duty or "",
        "supervisor_name": report.supervisor_name or "",
        "created_by_user_id": report.created_by_user_id,
        "created_at": report.created_at.isoformat() if report.created_at else None,
        "updated_at": report.updated_at.isoformat() if report.updated_at else None,
        "values": [
            {
                "id": value.id,
                "field_key": value.field_key,
                "field_label": value.field_label,
                "field_type": value.field_type,
                "sort_order": value.sort_order,
                "value_text": value.value_text or "",
            }
            for value in values
        ],
    }


@mobile_svr_bp.get("/stores")
@mobile_login_required
def svr_stores():
    user = g.mobile_user
    stores = visible_store_query(user).order_by(Store.store_number.asc()).all()

    return jsonify({
        "success": True,
        "stores": [serialize_store(store) for store in stores],
    })


@mobile_svr_bp.get("/template")
@mobile_login_required
def svr_template():
    user = g.mobile_user
    store = resolve_store_for_user(user, request.args.get("store_number"))

    if not store:
        return mobile_error("Store not found.", 404)

    fields = active_template_fields_for_company(store.company_id)

    return jsonify({
        "success": True,
        "store": serialize_store(store),
        "visit_date": today_et().isoformat(),
        "fields": [serialize_field(field) for field in fields],
    })


@mobile_svr_bp.get("/reports/recent")
@mobile_login_required
def recent_svr_reports():
    user = g.mobile_user
    allowed_stores = visible_store_numbers(user)

    query = SVRReport.query.filter(SVRReport.company_id == user.company_id)

    reports = (
        query
        .order_by(SVRReport.visit_date.desc(), SVRReport.created_at.desc())
        .limit(50)
        .all()
    )

    reports = [
        report
        for report in reports
        if str(report.store_number) in allowed_stores
    ][:20]

    return jsonify({
        "success": True,
        "reports": [serialize_report(report) for report in reports],
    })


@mobile_svr_bp.post("/reports")
@mobile_login_required
def create_svr_report():
    user = g.mobile_user
    data = request.get_json(silent=True) or {}

    store = resolve_store_for_user(user, data.get("store_number"))

    if not store:
        return mobile_error("Store not found.", 404)

    visit_date = parse_visit_date(data.get("visit_date"))

    if not visit_date:
        return mobile_error("Invalid visit date.", 400)

    manager_on_duty = (data.get("manager_on_duty") or "").strip()
    values_payload = data.get("values") or {}

    fields = active_template_fields_for_company(store.company_id)

    report = SVRReport(
        company_id=store.company_id,
        store_number=str(store.store_number),
        visit_date=visit_date,
        manager_on_duty=manager_on_duty,
        supervisor_name=getattr(user, "name", None),
        created_by_user_id=user.id,
    )

    db.session.add(report)
    db.session.flush()

    for field in fields:
        if field.field_key == "store_number":
            value_text = str(store.store_number)
        elif field.field_key == "date":
            value_text = visit_date.strftime("%Y-%m-%d")
        elif field.field_key == "manager_on_duty":
            value_text = manager_on_duty
        else:
            value_text = str(values_payload.get(field.field_key, "") or "").strip()

        db.session.add(
            SVRReportValue(
                report_id=report.id,
                template_field_id=field.id,
                field_key=field.field_key,
                field_label=field.field_label,
                field_type=field.field_type,
                sort_order=field.sort_order,
                value_text=value_text,
            )
        )

    db.session.commit()
    sync_maintenance_from_svr(report)
    sync_weekly_focus_from_svr(report)

    return jsonify({
        "success": True,
        "report": serialize_report(report),
    })
