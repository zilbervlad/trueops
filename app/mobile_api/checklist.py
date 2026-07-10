from collections import defaultdict
from datetime import datetime

from flask import Blueprint, g, jsonify, request

from app.extensions import db
from app.models import DailyChecklist, DailyChecklistItem, Store
from app.mobile_api.permissions import mobile_error, mobile_login_required, scoped_store_query_for_user, user_can_access_store_number
from app.checklist.routes import (
    build_section_stats,
    calculate_manager_walk_integrity,
    current_ops_date,
    get_active_checklist_template_items_for_company,
    is_past_ops_day,
    update_checklist_progress,
)


mobile_checklist_bp = Blueprint(
    "mobile_checklist",
    __name__,
    url_prefix="/api/mobile/checklist",
)


SECTION_ORDER = [
    "Before Open / Before 10:30",
    "During Dayshift",
    "3-O'Clock Restock",
    "Manager's Walk",
]


def normalize_role(user):
    is_platform_admin = getattr(user, "is_platform_admin", False)

    if callable(is_platform_admin):
        try:
            if is_platform_admin():
                return "platform_admin"
        except TypeError:
            pass
    elif is_platform_admin:
        return "platform_admin"

    return (getattr(user, "role", "") or "").strip().lower()

def visible_store_query(user):
    return scoped_store_query_for_user(user, Store)


def visible_store_numbers(user):
    return {str(store.store_number) for store in visible_store_query(user).all()}


def parse_date(value):
    if not value:
        return current_ops_date()

    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def get_or_create_mobile_daily_checklist(company_id, store_number, checklist_date):
    daily = (
        DailyChecklist.query
        .filter_by(
            company_id=company_id,
            store_number=str(store_number),
            checklist_date=checklist_date,
        )
        .first()
    )

    if daily:
        # Keep today's generated checklist aligned with the current template.
        # Past ops days remain historical snapshots and are never modified.
        if not is_past_ops_day(checklist_date):
            template_items = get_active_checklist_template_items_for_company(company_id)
            active_by_id = {item.id: item for item in template_items}

            existing_by_template_id = {
                item.template_item_id: item
                for item in daily.items
                if item.template_item_id is not None
            }

            # Remove items that were deactivated or removed from the template.
            for item in list(daily.items):
                if (
                    item.template_item_id is not None
                    and item.template_item_id not in active_by_id
                ):
                    db.session.delete(item)

            # Add newly activated items and refresh current template details.
            for template in template_items:
                existing = existing_by_template_id.get(template.id)

                if existing:
                    existing.section_name = template.section_name
                    existing.task_text = template.task_text
                    existing.expected_minutes = template.expected_minutes
                    existing.is_required = template.is_required
                else:
                    db.session.add(
                        DailyChecklistItem(
                            daily_checklist_id=daily.id,
                            template_item_id=template.id,
                            section_name=template.section_name,
                            task_text=template.task_text,
                            expected_minutes=template.expected_minutes,
                            is_required=template.is_required,
                            is_completed=False,
                            notes="",
                        )
                    )

            db.session.commit()
            update_checklist_progress(daily)

        return daily

    daily = DailyChecklist(
        company_id=company_id,
        store_number=str(store_number),
        checklist_date=checklist_date,
        status="in_progress",
        percent_complete=0.0,
        integrity_score=0.0,
        integrity_possible=0,
    )
    db.session.add(daily)
    db.session.flush()

    template_items = get_active_checklist_template_items_for_company(company_id)

    for template in template_items:
        db.session.add(
            DailyChecklistItem(
                daily_checklist_id=daily.id,
                template_item_id=template.id,
                section_name=template.section_name,
                task_text=template.task_text,
                expected_minutes=template.expected_minutes,
                is_required=template.is_required,
                is_completed=False,
                notes="",
            )
        )

    db.session.commit()
    return daily


def serialize_item(item):
    return {
        "id": item.id,
        "template_item_id": item.template_item_id,
        "section_name": item.section_name,
        "task_text": item.task_text,
        "expected_minutes": item.expected_minutes,
        "is_required": item.is_required,
        "is_completed": item.is_completed,
        "notes": item.notes or "",
        "completed_at": item.completed_at.isoformat() if item.completed_at else None,
    }


def serialize_daily_checklist(daily):
    items = sorted(
        daily.items,
        key=lambda item: (
            SECTION_ORDER.index(item.section_name)
            if item.section_name in SECTION_ORDER
            else 999,
            item.id,
        ),
    )

    grouped = defaultdict(list)
    for item in items:
        grouped[item.section_name].append(item)

    ordered_section_names = [
        section for section in SECTION_ORDER if section in grouped
    ] + [
        section for section in grouped.keys() if section not in SECTION_ORDER
    ]

    sections = []
    for section_name in ordered_section_names:
        section_items = grouped[section_name]
        total = len(section_items)
        completed = sum(1 for item in section_items if item.is_completed)

        sections.append({
            "section_name": section_name,
            "completed": completed,
            "total": total,
            "percent": round((completed / total) * 100) if total else 0,
            "items": [serialize_item(item) for item in section_items],
        })

    return {
        "id": daily.id,
        "company_id": daily.company_id,
        "store_number": daily.store_number,
        "checklist_date": daily.checklist_date.isoformat(),
        "manager_on_duty": daily.manager_on_duty or "",
        "opening_manager": daily.opening_manager or "",
        "closing_manager": daily.closing_manager or "",
        "status": daily.status,
        "percent_complete": daily.percent_complete,
        "integrity_score": daily.integrity_score,
        "integrity_possible": daily.integrity_possible,
        "manager_walk_integrity": calculate_manager_walk_integrity(daily),
        "read_only": is_past_ops_day(daily.checklist_date),
        "sections": sections,
        "section_stats": build_section_stats(daily),
    }


def load_checklist_response(store_number="", selected_date=None):
    user = g.mobile_user
    company_id = user.company_id

    store_number = (store_number or user.store_number or "").strip()
    selected_date = selected_date or current_ops_date()

    if not store_number:
        first_store = visible_store_query(user).order_by(Store.store_number.asc()).first()
        store_number = first_store.store_number if first_store else ""

    if not store_number:
        return mobile_error("No visible store found.", 404)

    if str(store_number) not in visible_store_numbers(user):
        return mobile_error("Unauthorized store.", 403)

    store_query = Store.query.filter_by(
        store_number=str(store_number),
        is_active=True,
    )

    store_query = store_query.filter_by(company_id=company_id)

    store = store_query.first()

    if not store:
        return mobile_error("Store not found.", 404)

    checklist_company_id = store.company_id

    daily = get_or_create_mobile_daily_checklist(
        company_id=checklist_company_id,
        store_number=str(store_number),
        checklist_date=selected_date,
    )

    return jsonify({
        "success": True,
        "store": {
            "id": store.id,
            "store_number": store.store_number,
            "name": getattr(store, "store_name", "") or "",
            "area_name": store.area_name,
        },
        "checklist": serialize_daily_checklist(daily),
    })


@mobile_checklist_bp.get("/stores")
@mobile_login_required
def checklist_stores():
    user = g.mobile_user

    stores = visible_store_query(user).order_by(Store.store_number.asc()).all()

    return jsonify({
        "success": True,
        "stores": [
            {
                "id": store.id,
                "store_number": store.store_number,
                "name": getattr(store, "store_name", "") or "",
                "area_name": store.area_name,
            }
            for store in stores
        ],
    })




@mobile_checklist_bp.get("/heatmap")
@mobile_login_required
def checklist_heatmap():
    user = g.mobile_user
    selected_date = parse_date((request.args.get("date") or "").strip())

    if not selected_date:
        return mobile_error("Invalid date.", 400)

    stores = visible_store_query(user).order_by(Store.store_number.asc()).all()
    store_numbers = [str(store.store_number) for store in stores]

    checklists = {
        str(row.store_number): row
        for row in DailyChecklist.query.filter(
            DailyChecklist.company_id == user.company_id,
            DailyChecklist.checklist_date == selected_date,
            DailyChecklist.store_number.in_(store_numbers),
        ).all()
    }

    rows = []

    for store in stores:
        store_number = str(store.store_number)
        daily = checklists.get(store_number)

        percent = float(daily.percent_complete or 0) if daily else 0
        integrity = float(daily.integrity_score or 0) if daily else 0
        manager_walk = calculate_manager_walk_integrity(daily) if daily else 0

        if percent >= 90 and integrity >= 90:
            status = "green"
            status_label = "Strong"
        elif percent >= 70:
            status = "yellow"
            status_label = "Watch"
        elif daily:
            status = "red"
            status_label = "Behind"
        else:
            status = "gray"
            status_label = "Not started"

        rows.append({
            "store_number": store.store_number,
            "name": getattr(store, "store_name", "") or f"Store {store.store_number}",
            "area_name": store.area_name,
            "percent_complete": round(percent),
            "integrity_score": round(integrity),
            "manager_walk_integrity": round(manager_walk),
            "status": status,
            "status_label": status_label,
            "has_checklist": bool(daily),
        })

    summary = {
        "total": len(rows),
        "green": sum(1 for row in rows if row["status"] == "green"),
        "yellow": sum(1 for row in rows if row["status"] == "yellow"),
        "red": sum(1 for row in rows if row["status"] == "red"),
        "gray": sum(1 for row in rows if row["status"] == "gray"),
        "average_percent": round(sum(row["percent_complete"] for row in rows) / len(rows)) if rows else 0,
    }

    return jsonify({
        "success": True,
        "date": selected_date.isoformat(),
        "summary": summary,
        "stores": rows,
    })


@mobile_checklist_bp.get("")
@mobile_checklist_bp.get("/")
@mobile_login_required
def get_checklist():
    selected_date = parse_date((request.args.get("date") or "").strip())

    if not selected_date:
        return mobile_error("Invalid date.", 400)

    return load_checklist_response(
        store_number=(request.args.get("store_number") or "").strip(),
        selected_date=selected_date,
    )


@mobile_checklist_bp.get("/today")
@mobile_login_required
def get_today_checklist():
    return load_checklist_response(
        store_number=(request.args.get("store_number") or "").strip(),
        selected_date=current_ops_date(),
    )


@mobile_checklist_bp.post("/items/<int:item_id>/toggle")
@mobile_login_required
def toggle_checklist_item(item_id):
    user = g.mobile_user
    company_id = user.company_id

    data = request.get_json(silent=True) or {}
    is_completed = bool(data.get("is_completed", False))
    notes = (data.get("notes") or "").strip()

    item = DailyChecklistItem.query.get(item_id)

    if not item:
        return mobile_error("Item not found.", 404)

    daily = item.daily_checklist

    if not daily:
        return mobile_error("Unauthorized checklist.", 403)

    if normalize_role(user) != "platform_admin" and daily.company_id != company_id:
        return mobile_error("Unauthorized checklist.", 403)

    if str(daily.store_number) not in visible_store_numbers(user):
        return mobile_error("Unauthorized store.", 403)

    if is_past_ops_day(daily.checklist_date):
        return mobile_error("Past checklists are read-only.", 400)

    item.is_completed = is_completed
    item.notes = notes
    item.completed_at = datetime.utcnow() if is_completed else None

    db.session.commit()
    update_checklist_progress(daily)

    return jsonify({
        "success": True,
        "checklist": serialize_daily_checklist(daily),
    })


@mobile_checklist_bp.post("/manager")
@mobile_login_required
def save_checklist_manager():
    user = g.mobile_user
    company_id = user.company_id

    data = request.get_json(silent=True) or {}

    store_number = (data.get("store_number") or user.store_number or "").strip()
    selected_date = parse_date((data.get("date") or "").strip())
    opening_manager = (data.get("opening_manager") or "").strip()
    closing_manager = (data.get("closing_manager") or "").strip()

    if not selected_date:
        return mobile_error("Invalid date.", 400)

    if not store_number:
        return mobile_error("Missing store.", 400)

    if str(store_number) not in visible_store_numbers(user):
        return mobile_error("Unauthorized store.", 403)

    if is_past_ops_day(selected_date):
        return mobile_error("Past checklists are read-only.", 400)

    store_query = Store.query.filter_by(
        store_number=str(store_number),
        is_active=True,
    )

    store_query = store_query.filter_by(company_id=company_id)

    store = store_query.first()

    if not store:
        return mobile_error("Store not found.", 404)

    daily = get_or_create_mobile_daily_checklist(
        company_id=store.company_id,
        store_number=str(store_number),
        checklist_date=selected_date,
    )

    daily.manager_on_duty = opening_manager
    daily.opening_manager = opening_manager
    daily.closing_manager = closing_manager

    db.session.commit()
    update_checklist_progress(daily)

    return jsonify({
        "success": True,
        "checklist": serialize_daily_checklist(daily),
    })
