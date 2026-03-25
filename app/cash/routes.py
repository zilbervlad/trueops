from datetime import datetime

from flask import Blueprint, render_template, request, redirect, url_for, session, flash
from app.extensions import db
from app.models import CashLog
from app.auth.routes import login_required

cash_bp = Blueprint("cash", __name__, url_prefix="/cash")


def get_manager_store():
    user_role = session.get("user_role")
    store_number = session.get("user_store")

    if user_role != "manager":
        flash("Only managers can access Cash Control.", "error")
        return None

    if not store_number:
        flash("No store assigned to this user.", "error")
        return None

    return store_number


@cash_bp.route("/", methods=["GET", "POST"])
@login_required
def index():
    store_number = get_manager_store()
    if not store_number:
        return redirect(url_for("dashboard.home"))

    if request.method == "POST":
        edit_log_id = (request.form.get("edit_log_id") or "").strip()
        shift_type = (request.form.get("shift_type") or "").strip()
        log_date_raw = (request.form.get("log_date") or "").strip()
        manager_name = (request.form.get("manager_name") or session.get("user_name") or "").strip()

        if not shift_type:
            flash("Shift type is required.", "error")
            return redirect(url_for("cash.index"))

        if not log_date_raw:
            flash("Log date is required.", "error")
            return redirect(url_for("cash.index"))

        try:
            log_date = datetime.strptime(log_date_raw, "%Y-%m-%d").date()
        except ValueError:
            flash("Invalid log date.", "error")
            return redirect(url_for("cash.index"))

        try:
            back_till = float(request.form.get("back_till") or 0)
            front_till = float(request.form.get("front_till") or 0)
            driver_banks = float(request.form.get("driver_banks") or 0)
        except ValueError:
            flash("Cash amounts must be valid numbers.", "error")
            return redirect(url_for("cash.index"))

        total_cash = back_till + front_till + driver_banks

        if edit_log_id:
            log = CashLog.query.get(edit_log_id)

            if not log:
                flash("Cash log not found.", "error")
                return redirect(url_for("cash.index"))

            if log.store_number != store_number:
                flash("You can only edit cash logs for your own store.", "error")
                return redirect(url_for("cash.index"))

            log.shift_type = shift_type
            log.log_date = log_date
            log.manager_name = manager_name
            log.back_till = back_till
            log.front_till = front_till
            log.driver_banks = driver_banks
            log.total_cash = total_cash

            db.session.commit()
            flash("Cash log updated successfully.", "success")
            return redirect(url_for("cash.index"))

        log = CashLog(
            store_number=store_number,
            log_date=log_date,
            shift_type=shift_type,
            back_till=back_till,
            front_till=front_till,
            driver_banks=driver_banks,
            total_cash=total_cash,
            manager_name=manager_name,
        )

        db.session.add(log)
        db.session.commit()

        flash("Cash log submitted successfully.", "success")
        return redirect(url_for("cash.index"))

    edit_id = request.args.get("edit")
    edit_log = None

    if edit_id:
        edit_log = CashLog.query.get(edit_id)
        if not edit_log:
            flash("Cash log not found.", "error")
            return redirect(url_for("cash.index"))
        if edit_log.store_number != store_number:
            flash("You can only edit cash logs for your own store.", "error")
            return redirect(url_for("cash.index"))

    logs = (
        CashLog.query.filter_by(store_number=store_number)
        .order_by(CashLog.log_date.desc(), CashLog.created_at.desc())
        .limit(10)
        .all()
    )

    today_str = datetime.now().strftime("%Y-%m-%d")

    return render_template(
        "cash.html",
        logs=logs,
        today_str=edit_log.log_date.strftime("%Y-%m-%d") if edit_log else today_str,
        store_number=store_number,
        manager_name=edit_log.manager_name if edit_log and edit_log.manager_name else session.get("user_name", ""),
        edit_log=edit_log,
    )