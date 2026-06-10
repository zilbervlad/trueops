from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from app.auth.routes import login_required
from app.extensions import db
from app.models import Company

company_admin_bp = Blueprint("company_admin", __name__, url_prefix="/companies")


def platform_admin_required(view):
    from functools import wraps

    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("auth.login"))

        if not session.get("is_platform_admin"):
            flash("You do not have permission to view that page.", "error")
            return redirect(url_for("dashboard.home"))

        return view(*args, **kwargs)

    return wrapped_view


@company_admin_bp.route("/", methods=["GET", "POST"])
@login_required
@platform_admin_required
def index():
    if request.method == "POST":
        action = request.form.get("action", "").strip()

        if action == "create":
            name = request.form.get("name", "").strip()
            slug = request.form.get("slug", "").strip().lower()
            accent_color = request.form.get("accent_color", "").strip() or None
            logo_filename = request.form.get("logo_filename", "").strip() or None

            if not name or not slug:
                flash("Company name and slug are required.", "error")
                return redirect(url_for("company_admin.index"))

            existing_slug = Company.query.filter_by(slug=slug).first()
            if existing_slug:
                flash("That company slug already exists.", "error")
                return redirect(url_for("company_admin.index"))

            company = Company(
                name=name,
                slug=slug,
                accent_color=accent_color,
                logo_filename=logo_filename,
                is_active=True,
            )
            db.session.add(company)
            db.session.commit()

            flash("Company created successfully.", "success")
            return redirect(url_for("company_admin.index"))

        if action == "update":
            company_id = request.form.get("company_id", "").strip()
            company = Company.query.get(company_id)

            if not company:
                flash("Company not found.", "error")
                return redirect(url_for("company_admin.index"))

            name = request.form.get("name", "").strip()
            slug = request.form.get("slug", "").strip().lower()
            accent_color = request.form.get("accent_color", "").strip() or None
            logo_filename = request.form.get("logo_filename", "").strip() or None

            if not name or not slug:
                flash("Company name and slug are required.", "error")
                return redirect(url_for("company_admin.index"))

            duplicate = Company.query.filter(
                Company.slug == slug,
                Company.id != company.id
            ).first()
            if duplicate:
                flash("Another company already uses that slug.", "error")
                return redirect(url_for("company_admin.index"))

            company.name = name
            company.slug = slug
            company.accent_color = accent_color
            company.logo_filename = logo_filename
            company.is_active = request.form.get("is_active") == "on"

            db.session.commit()
            flash("Company updated successfully.", "success")
            return redirect(url_for("company_admin.index"))

        if action == "deactivate":
            company_id = request.form.get("company_id", "").strip()
            company = Company.query.get(company_id)

            if not company:
                flash("Company not found.", "error")
                return redirect(url_for("company_admin.index"))

            company.is_active = False
            db.session.commit()

            if session.get("current_company_id") == company.id:
                session["current_company_id"] = None
                session["current_company_name"] = None

            flash("Company deactivated.", "success")
            return redirect(url_for("company_admin.index"))

        if action == "activate":
            company_id = request.form.get("company_id", "").strip()
            company = Company.query.get(company_id)

            if not company:
                flash("Company not found.", "error")
                return redirect(url_for("company_admin.index"))

            company.is_active = True
            db.session.commit()

            flash("Company activated.", "success")
            return redirect(url_for("company_admin.index"))

    companies = Company.query.order_by(Company.name.asc()).all()

    return render_template(
        "companies.html",
        companies=companies,
    )