from collections import defaultdict
from datetime import datetime, timedelta

from flask import Blueprint, render_template, request, session
from app.auth.routes import login_required, role_required
from app.models import CashLog, Store

cash_review_bp = Blueprint("cash_review", __name__, url_prefix="/cash-review")


def get_visible_stores():
    role = session.get("user_role")
    user_area = session.get("user_area")

    if role == "admin":
        return Store.query.filter_by(is_active=True).order_by(Store.store_number.asc()).all()

    if role == "supervisor":
        return Store.query.filter_by(
            area_name=user_area,
            is_active=True
        ).order_by(Store.store_number.asc()).all()

    return []


def build_closing_to_opening_diffs(logs):
    by_store = defaultdict(list)

    for log in logs:
        by_store[log.store_number].append(log)

    diff_rows = []

    for store_number, store_logs in by_store.items():
        ordered = sorted(
            store_logs,
            key=lambda x: (x.log_date, x.created_at or datetime.min, x.id or 0)
        )

        for i, current_log in enumerate(ordered):
            if current_log.shift_type != "closing":
                continue

            next_opening = None
            for future_log in ordered[i + 1:]:
                if future_log.shift_type == "opening":
                    next_opening = future_log
                    break

            if not next_opening:
                continue

            closing_total = current_log.total_cash or 0
            opening_total = next_opening.total_cash or 0
            diff_amount = opening_total - closing_total

            diff_rows.append({
                "store_number": store_number,
                "closing_date": current_log.log_date,
                "opening_date": next_opening.log_date,
                "closing_total": closing_total,
                "opening_total": opening_total,
                "difference": diff_amount,
                "closing_manager": current_log.manager_name,
                "opening_manager": next_opening.manager_name,
            })

    diff_rows.sort(
        key=lambda x: (x["closing_date"], x["store_number"]),
        reverse=True
    )
    return diff_rows


@cash_review_bp.route("/", methods=["GET"])
@login_required
@role_required("admin", "supervisor")
def index():
    visible_stores = get_visible_stores()
    visible_store_numbers = {store.store_number for store in visible_stores}

    store_filter = (request.args.get("store") or "").strip()
    shift_filter = (request.args.get("shift") or "").strip()
    date_filter = (request.args.get("date") or "").strip()

    query = CashLog.query.filter(CashLog.store_number.in_(visible_store_numbers)).order_by(
        CashLog.log_date.desc(),
        CashLog.created_at.desc()
    )

    if store_filter:
        query = query.filter(CashLog.store_number == store_filter)

    selected_date = None
    if date_filter:
        try:
            selected_date = datetime.strptime(date_filter, "%Y-%m-%d").date()
            query = query.filter(CashLog.log_date == selected_date)
        except ValueError:
            selected_date = None

    if shift_filter:
        query = query.filter(CashLog.shift_type == shift_filter)

    logs = query.limit(100).all()

    midshift_logs = [
        log for log in logs
        if log.shift_type == "midshift"
    ]

    midshift_logs = sorted(
        midshift_logs,
        key=lambda x: (
            abs(x.cash_over_short or 0),
            x.log_date,
            x.store_number
        ),
        reverse=True
    )

    diff_base_query = CashLog.query.filter(CashLog.store_number.in_(visible_store_numbers))

    if store_filter:
        diff_base_query = diff_base_query.filter(CashLog.store_number == store_filter)

    if selected_date:
        diff_base_query = diff_base_query.filter(
            CashLog.log_date >= selected_date - timedelta(days=1),
            CashLog.log_date <= selected_date + timedelta(days=1)
        )

    diff_logs = diff_base_query.all()
    closing_opening_diffs = build_closing_to_opening_diffs(diff_logs)

    return render_template(
        "cash_review.html",
        stores=visible_stores,
        logs=logs,
        midshift_logs=midshift_logs,
        closing_opening_diffs=closing_opening_diffs,
        store_filter=store_filter,
        shift_filter=shift_filter,
        date_filter=date_filter,
    )