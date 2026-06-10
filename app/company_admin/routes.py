from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from app.auth.routes import login_required
from app.extensions import db
from app.models import Company, ChecklistTemplateItem, SVRTemplateField, VerificationTemplateField

company_admin_bp = Blueprint("company_admin", __name__, url_prefix="/companies")


def clone_company_template_rows(model, new_company_id, master_company_id):
    """
    Copy template rows from TrueOps master to a new company exactly once.
    If the company already has rows, do nothing.
    """
    if not new_company_id or not master_company_id:
        return 0

    existing_count = model.query.filter_by(company_id=new_company_id).count()
    if existing_count > 0:
        return 0

    master_rows = (
        model.query
        .filter_by(company_id=master_company_id)
        .order_by(model.id.asc())
        .all()
    )

    clone_columns = [
        column.name
        for column in model.__table__.columns
        if column.name not in ("id", "company_id")
    ]

    copied = 0
    for row in master_rows:
        clone = model(company_id=new_company_id)
        for column_name in clone_columns:
            setattr(clone, column_name, getattr(row, column_name))
        db.session.add(clone)
        copied += 1

    return copied


def clone_master_templates_for_company(company_id):
    """
    New companies start with TrueOps master templates.
    After that, edits/deletes/adds are company-specific.
    """
    master_company = Company.query.filter_by(slug="trueops").first()
    if not master_company:
        return {
            "checklist": 0,
            "svr": 0,
            "verification": 0,
        }

    return {
        "checklist": clone_company_template_rows(ChecklistTemplateItem, company_id, master_company.id),
        "svr": clone_company_template_rows(SVRTemplateField, company_id, master_company.id),
        "verification": clone_company_template_rows(VerificationTemplateField, company_id, master_company.id),
    }


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

            copied = clone_master_templates_for_company(company.id)
            db.session.commit()

            flash(
                f"Company created successfully. Templates copied: checklist {copied['checklist']}, SVR {copied['svr']}, verification {copied['verification']}.",
                "success"
            )
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