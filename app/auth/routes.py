from functools import wraps
from flask import Blueprint, render_template, request, redirect, url_for, session, flash
from app.models import User, Company
from app.extensions import db
from app.services.email_service import send_email

auth_bp = Blueprint("auth", __name__)


def login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("auth.login"))
        return view(*args, **kwargs)
    return wrapped_view


def role_required(*allowed_roles):
    def decorator(view):
        @wraps(view)
        def wrapped_view(*args, **kwargs):
            if "user_id" not in session:
                return redirect(url_for("auth.login"))

            if session.get("is_platform_admin"):
                return view(*args, **kwargs)

            user_role = session.get("user_role")
            if user_role not in allowed_roles:
                flash("You do not have permission to view that page.", "error")
                return redirect(url_for("dashboard.home"))

            return view(*args, **kwargs)
        return wrapped_view
    return decorator


def current_company_id():
    return session.get("current_company_id")


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").strip()

        user = User.query.filter_by(username=username, is_active=True).first()

        if user and user.check_password(password):
            effective_role = "admin" if user.role == "platform_admin" else user.role

            session["user_id"] = user.id
            session["user_name"] = user.name
            session["user_role"] = effective_role
            session["actual_role"] = user.role
            session["is_platform_admin"] = user.role == "platform_admin"

            session["user_area"] = user.area_name
            session["user_store"] = user.store_number

            session["current_company_id"] = user.company_id
            session["current_company_name"] = user.company.name if user.company else None

            return redirect(url_for("dashboard.home"))

        flash("Invalid username or password.", "error")

    return render_template("login.html")


@auth_bp.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("auth.login"))


@auth_bp.route("/switch-company", methods=["POST"])
@login_required
def switch_company():
    if not session.get("is_platform_admin"):
        flash("You do not have permission to switch companies.", "error")
        return redirect(url_for("dashboard.home"))

    company_id = request.form.get("company_id", "").strip()
    if not company_id.isdigit():
        flash("Invalid company selection.", "error")
        return redirect(url_for("dashboard.home"))

    company = Company.query.filter_by(id=int(company_id), is_active=True).first()
    if not company:
        flash("Company not found.", "error")
        return redirect(url_for("dashboard.home"))

    session["current_company_id"] = company.id
    session["current_company_name"] = company.name

    flash(f"Switched to {company.name}.", "success")
    return redirect(url_for("dashboard.home"))


@auth_bp.route("/users", methods=["GET", "POST"])
@login_required
@role_required("admin")
def manage_users():
    selected_company_id = current_company_id()
    is_platform_admin = session.get("is_platform_admin", False)

    if request.method == "POST":
        action = request.form.get("action", "").strip()

        form_company_id = request.form.get("company_id", "").strip()
        target_company_id = int(form_company_id) if (is_platform_admin and form_company_id.isdigit()) else selected_company_id

        if not target_company_id:
            flash("No company is selected for this action.", "error")
            return redirect(url_for("auth.manage_users"))

        if action == "create":
            name = request.form.get("name", "").strip()
            username = request.form.get("username", "").strip()
            password = request.form.get("password", "").strip()
            role = request.form.get("role", "").strip()
            area_name = request.form.get("area_name", "").strip() or None
            store_number = request.form.get("store_number", "").strip() or None
            email = request.form.get("email", "").strip() or None
            notification_email = request.form.get("notification_email", "").strip() or None
            email_enabled = request.form.get("email_enabled") == "on"

            valid_roles = {"admin", "supervisor", "manager", "maintenance", "platform_admin"}

            if not name or not username or not password or role not in valid_roles:
                flash("Please complete all required fields correctly.", "error")
                return redirect(url_for("auth.manage_users"))

            existing_user = User.query.filter_by(username=username).first()
            if existing_user:
                flash("That username already exists.", "error")
                return redirect(url_for("auth.manage_users"))

            if role == "supervisor" and not area_name:
                flash("Supervisors must have an area assigned.", "error")
                return redirect(url_for("auth.manage_users"))

            if role == "manager" and not store_number:
                flash("Managers must have a store assigned.", "error")
                return redirect(url_for("auth.manage_users"))

            if role in {"admin", "maintenance", "platform_admin"}:
                area_name = None
                store_number = None

            if role == "supervisor":
                store_number = None

            if role == "manager":
                area_name = None

            user = User(
                company_id=target_company_id,
                name=name,
                username=username,
                role=role,
                area_name=area_name,
                store_number=store_number,
                email=email,
                notification_email=notification_email,
                email_enabled=email_enabled,
                is_active=True,
            )
            user.set_password(password)

            db.session.add(user)
            db.session.commit()

            flash("User created successfully.", "success")
            return redirect(url_for("auth.manage_users"))

        if action == "update":
            user_id = request.form.get("user_id", "").strip()
            user = User.query.get(user_id)

            if not user:
                flash("User not found.", "error")
                return redirect(url_for("auth.manage_users"))

            if not is_platform_admin and user.company_id != selected_company_id:
                flash("You do not have permission to edit that user.", "error")
                return redirect(url_for("auth.manage_users"))

            name = request.form.get("name", "").strip()
            username = request.form.get("username", "").strip()
            role = request.form.get("role", "").strip()
            area_name = request.form.get("area_name", "").strip() or None
            store_number = request.form.get("store_number", "").strip() or None
            email = request.form.get("email", "").strip() or None
            notification_email = request.form.get("notification_email", "").strip() or None
            email_enabled = request.form.get("email_enabled") == "on"
            new_password = request.form.get("password", "").strip()

            valid_roles = {"admin", "supervisor", "manager", "maintenance", "platform_admin"}

            if user.role in {"admin", "platform_admin"}:
                user.email = email
                user.notification_email = notification_email
                user.email_enabled = email_enabled

                if new_password:
                    user.set_password(new_password)
                    db.session.commit()
                    flash("Admin email settings and password updated successfully.", "success")
                else:
                    db.session.commit()
                    flash("Admin email settings updated successfully.", "success")

                return redirect(url_for("auth.manage_users"))

            if not name or not username or role not in valid_roles:
                flash("Please complete all required fields correctly.", "error")
                return redirect(url_for("auth.manage_users"))

            existing_user = User.query.filter(
                User.username == username,
                User.id != user.id
            ).first()
            if existing_user:
                flash("That username already exists.", "error")
                return redirect(url_for("auth.manage_users"))

            if role == "supervisor" and not area_name:
                flash("Supervisors must have an area assigned.", "error")
                return redirect(url_for("auth.manage_users"))

            if role == "manager" and not store_number:
                flash("Managers must have a store assigned.", "error")
                return redirect(url_for("auth.manage_users"))

            if role in {"admin", "maintenance", "platform_admin"}:
                area_name = None
                store_number = None

            if role == "supervisor":
                store_number = None

            if role == "manager":
                area_name = None

            user.company_id = target_company_id
            user.name = name
            user.username = username
            user.role = role
            user.area_name = area_name
            user.store_number = store_number
            user.email = email
            user.notification_email = notification_email
            user.email_enabled = email_enabled

            if new_password:
                user.set_password(new_password)

            db.session.commit()
            flash("User updated successfully.", "success")
            return redirect(url_for("auth.manage_users"))

        if action == "deactivate":
            user_id = request.form.get("user_id", "").strip()
            user = User.query.get(user_id)

            if not user:
                flash("User not found.", "error")
                return redirect(url_for("auth.manage_users"))

            if not is_platform_admin and user.company_id != selected_company_id:
                flash("You do not have permission to deactivate that user.", "error")
                return redirect(url_for("auth.manage_users"))

            if user.role in {"admin", "platform_admin"}:
                flash("Admin users cannot be deactivated here.", "error")
                return redirect(url_for("auth.manage_users"))

            user.is_active = False
            db.session.commit()

            flash("User deactivated.", "success")
            return redirect(url_for("auth.manage_users"))

        if action == "activate":
            user_id = request.form.get("user_id", "").strip()
            user = User.query.get(user_id)

            if not user:
                flash("User not found.", "error")
                return redirect(url_for("auth.manage_users"))

            if not is_platform_admin and user.company_id != selected_company_id:
                flash("You do not have permission to activate that user.", "error")
                return redirect(url_for("auth.manage_users"))

            user.is_active = True
            db.session.commit()

            flash("User activated.", "success")
            return redirect(url_for("auth.manage_users"))

    if is_platform_admin:
        users = User.query.order_by(User.name.asc()).all()
        companies = Company.query.filter_by(is_active=True).order_by(Company.name.asc()).all()
    else:
        users = User.query.filter_by(company_id=selected_company_id).order_by(User.name.asc()).all()
        companies = Company.query.filter_by(id=selected_company_id).all()

    return render_template(
        "users.html",
        users=users,
        companies=companies,
        selected_company_id=selected_company_id,
        is_platform_admin=is_platform_admin,
    )


@auth_bp.route("/users/<int:user_id>/send-test-email", methods=["POST"])
@login_required
@role_required("admin")
def send_test_email_to_user(user_id):
    user = User.query.get_or_404(user_id)

    selected_company_id = current_company_id()
    is_platform_admin = session.get("is_platform_admin", False)

    if not is_platform_admin and user.company_id != selected_company_id:
        flash("You do not have permission to email that user.", "error")
        return redirect(url_for("auth.manage_users"))

    to_email = user.get_notification_email()
    if not to_email:
        flash("This user does not have an email address configured for notifications.", "error")
        return redirect(url_for("auth.manage_users"))

    try:
        send_email(
            to_email=to_email,
            subject="TrueOps Test Email",
            body=(
                f"Hello {user.name},\n\n"
                "This is a test email from TrueOps.\n\n"
                "If you received this, your email settings are working."
            ),
        )
        flash(f"Test email sent to {to_email}.", "success")
    except Exception as e:
        flash(f"Failed to send test email: {str(e)}", "error")

    return redirect(url_for("auth.manage_users"))