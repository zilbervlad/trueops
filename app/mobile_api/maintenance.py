from datetime import datetime

from flask import Blueprint, g, jsonify, request

from app.extensions import db
from app.models import MaintenanceTicket, Store
from app.mobile_api.permissions import mobile_error, mobile_login_required


mobile_maintenance_bp = Blueprint(
    "mobile_maintenance",
    __name__,
    url_prefix="/api/mobile/maintenance",
)


VALID_STATUSES = {"open", "assigned", "in_progress", "complete"}
VALID_PRIORITIES = {"low", "normal", "high", "urgent"}


def normalize_role(user):
    if getattr(user, "is_platform_admin", False):
        return "platform_admin"

    return (getattr(user, "role", "") or "").strip().lower()


def visible_store_query(user):
    role = normalize_role(user)

    if role == "platform_admin":
        return Store.query.filter_by(is_active=True)

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

    if normalize_role(user) != "platform_admin":
        query = query.filter_by(company_id=user.company_id)

    return query.first()


def parse_date(value):
    value = (value or "").strip()

    if not value:
        return None

    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def parse_time(value):
    value = (value or "").strip()

    if not value:
        return None

    try:
        return datetime.strptime(value, "%H:%M").time()
    except ValueError:
        return None


def parse_int(value):
    value = str(value or "").strip()

    if not value:
        return None

    try:
        parsed = int(value)
        return parsed if parsed >= 0 else None
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


def serialize_ticket(ticket):
    return {
        "id": ticket.id,
        "company_id": ticket.company_id,
        "store_number": ticket.store_number,
        "title": ticket.title or "",
        "details": ticket.details or "",
        "source_type": ticket.source_type or "manual",
        "svr_report_id": ticket.svr_report_id,
        "status": ticket.status or "open",
        "assigned_to": ticket.assigned_to or "",
        "scheduled_date": ticket.scheduled_date.isoformat() if ticket.scheduled_date else "",
        "scheduled_time": ticket.scheduled_time.strftime("%H:%M") if ticket.scheduled_time else "",
        "estimated_minutes": ticket.estimated_minutes,
        "priority": ticket.priority or "normal",
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
    }


def ticket_allowed_for_user(user, ticket):
    if not ticket:
        return False

    if str(ticket.store_number) not in visible_store_numbers(user):
        return False

    if normalize_role(user) == "platform_admin":
        return True

    return ticket.company_id == user.company_id


@mobile_maintenance_bp.get("/stores")
@mobile_login_required
def maintenance_stores():
    user = g.mobile_user
    stores = visible_store_query(user).order_by(Store.store_number.asc()).all()

    return jsonify({
        "success": True,
        "stores": [serialize_store(store) for store in stores],
    })


@mobile_maintenance_bp.get("/tickets")
@mobile_login_required
def maintenance_tickets():
    user = g.mobile_user

    status_filter = (request.args.get("status") or "").strip()
    store_filter = (request.args.get("store_number") or "").strip()

    allowed_stores = visible_store_numbers(user)

    query = MaintenanceTicket.query

    if normalize_role(user) != "platform_admin":
        query = query.filter(MaintenanceTicket.company_id == user.company_id)

    tickets = (
        query
        .order_by(MaintenanceTicket.created_at.asc(), MaintenanceTicket.id.asc())
        .all()
    )

    tickets = [
        ticket
        for ticket in tickets
        if str(ticket.store_number) in allowed_stores
    ]

    if status_filter:
        tickets = [ticket for ticket in tickets if ticket.status == status_filter]

    if store_filter:
        tickets = [ticket for ticket in tickets if str(ticket.store_number) == store_filter]

    return jsonify({
        "success": True,
        "tickets": [serialize_ticket(ticket) for ticket in tickets],
    })


@mobile_maintenance_bp.post("/tickets")
@mobile_login_required
def create_maintenance_ticket():
    user = g.mobile_user
    data = request.get_json(silent=True) or {}

    store = resolve_store_for_user(user, data.get("store_number"))

    if not store:
        return mobile_error("Store not found.", 404)

    title = (data.get("title") or "").strip()
    details = (data.get("details") or "").strip()

    if not title and details:
        title = "General maintenance task"

    if not title:
        return mobile_error("Task title is required.", 400)

    priority = (data.get("priority") or "normal").strip()
    if priority not in VALID_PRIORITIES:
        priority = "normal"

    status = (data.get("status") or "open").strip()
    if status not in VALID_STATUSES:
        status = "open"

    ticket = MaintenanceTicket(
        company_id=store.company_id,
        store_number=str(store.store_number),
        title=title,
        details=details,
        source_type="manual",
        status=status,
        assigned_to=(data.get("assigned_to") or "").strip() or None,
        scheduled_date=parse_date(data.get("scheduled_date")),
        scheduled_time=parse_time(data.get("scheduled_time")),
        estimated_minutes=parse_int(data.get("estimated_minutes")),
        priority=priority,
    )

    db.session.add(ticket)
    db.session.commit()

    return jsonify({
        "success": True,
        "ticket": serialize_ticket(ticket),
    })


@mobile_maintenance_bp.post("/tickets/<int:ticket_id>/status")
@mobile_login_required
def update_maintenance_status(ticket_id):
    user = g.mobile_user
    data = request.get_json(silent=True) or {}

    ticket = MaintenanceTicket.query.get(ticket_id)

    if not ticket_allowed_for_user(user, ticket):
        return mobile_error("Ticket not found.", 404)

    status = (data.get("status") or "").strip()

    if status not in VALID_STATUSES:
        return mobile_error("Invalid status.", 400)

    ticket.status = status
    db.session.commit()

    return jsonify({
        "success": True,
        "ticket": serialize_ticket(ticket),
    })


@mobile_maintenance_bp.post("/tickets/<int:ticket_id>")
@mobile_login_required
def update_maintenance_ticket(ticket_id):
    user = g.mobile_user
    data = request.get_json(silent=True) or {}

    ticket = MaintenanceTicket.query.get(ticket_id)

    if not ticket_allowed_for_user(user, ticket):
        return mobile_error("Ticket not found.", 404)

    if "title" in data:
        title = (data.get("title") or "").strip()
        if not title:
            return mobile_error("Task title is required.", 400)
        ticket.title = title

    if "details" in data:
        ticket.details = (data.get("details") or "").strip()

    if "assigned_to" in data:
        ticket.assigned_to = (data.get("assigned_to") or "").strip() or None

    if "priority" in data:
        priority = (data.get("priority") or "normal").strip()
        ticket.priority = priority if priority in VALID_PRIORITIES else "normal"

    if "status" in data:
        status = (data.get("status") or "open").strip()
        if status not in VALID_STATUSES:
            return mobile_error("Invalid status.", 400)
        ticket.status = status

    if "scheduled_date" in data:
        ticket.scheduled_date = parse_date(data.get("scheduled_date"))

    if "scheduled_time" in data:
        ticket.scheduled_time = parse_time(data.get("scheduled_time"))

    if "estimated_minutes" in data:
        ticket.estimated_minutes = parse_int(data.get("estimated_minutes"))

    db.session.commit()

    return jsonify({
        "success": True,
        "ticket": serialize_ticket(ticket),
    })
