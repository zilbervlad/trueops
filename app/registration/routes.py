import base64
from datetime import datetime
from io import BytesIO

import qrcode
from flask import Blueprint, abort, flash, redirect, render_template, request, session, url_for
from werkzeug.security import generate_password_hash

from app.extensions import db
from app.auth.routes import login_required, role_required
from app.models import Company, PendingRegistrationRequest, Store, User


registration_bp = Blueprint("registration", __name__, url_prefix="/registration")


def get_current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    return User.query.get(user_id)


def current_company_id():
    user = get_current_user()
    return session.get("current_company_id") or (user.company_id if user else None)


def current_company():
    company_id = current_company_id()
    if not company_id:
        return None
    return Company.query.filter_by(id=company_id, is_active=True).first()


def current_user_role():
    user = get_current_user()
    return (user.role if user else None) or session.get("user_role")


def can_review_registration_requests():
    return current_user_role() in {"platform_admin", "admin", "supervisor", "general_manager"}


def can_access_registration_qr():
    return current_user_role() in {"platform_admin", "admin", "supervisor", "general_manager", "manager"}


def visible_store_numbers():
    role = current_user_role()
    company_id = current_company_id()

    if not company_id:
        return set()

    if role in {"platform_admin", "admin"}:
        return None

    if role == "supervisor":
        user = get_current_user()
        area_name = (user.area_name if user else None) or session.get("user_area")
        if not area_name:
            return set()

        return {
            store.store_number
            for store in Store.query.filter_by(
                company_id=company_id,
                area_name=area_name,
                is_active=True,
            ).all()
        }

    if role in {"general_manager", "manager"}:
        user = get_current_user()
        store_number = user.store_number if user else None
        return {store_number} if store_number else set()

    return set()


def visible_qr_stores():
    company_id = current_company_id()
    visible = visible_store_numbers()

    query = Store.query.filter_by(company_id=company_id, is_active=True)

    if visible is not None:
        if not visible:
            return []
        query = query.filter(Store.store_number.in_(visible))

    return query.order_by(Store.store_number.asc()).all()


def can_review_registration_request(registration):
    if registration.company_id != current_company_id():
        return False

    visible = visible_store_numbers()
    if visible is None:
        return True

    return registration.store_number in visible


def allowed_approval_roles():
    role = current_user_role()

    if role in {"platform_admin", "admin"}:
        return ["tm", "manager", "general_manager", "supervisor", "maintenance", "admin"]

    if role == "supervisor":
        return ["tm", "manager", "general_manager"]

    if role == "general_manager":
        return ["tm"]

    return []


def registration_status_counts(registrations):
    counts = {"pending": 0, "approved": 0, "rejected": 0}
    for registration in registrations:
        if registration.status in counts:
            counts[registration.status] += 1
    return counts


def make_registration_qr_data_uri(target_url):
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=3,
    )
    qr.add_data(target_url)
    qr.make(fit=True)

    image = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    image.save(buffer, format="PNG")

    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def company_from_slug(slug):
    return Company.query.filter_by(slug=slug, is_active=True).first()


@registration_bp.route("/qr")
@login_required
@role_required("platform_admin", "admin", "supervisor", "general_manager", "manager")
def qr_center():
    if not can_access_registration_qr():
        flash("You do not have permission to access registration QR codes.", "error")
        return redirect(url_for("dashboard.home"))

    company = current_company()
    if not company:
        abort(403)

    stores = visible_qr_stores()
    role = current_user_role()

    selected_store = (request.args.get("store") or "").strip()
    allowed_store_numbers = {store.store_number for store in stores}

    if selected_store not in allowed_store_numbers:
        selected_store = stores[0].store_number if stores else ""

    company_register_url = url_for(
        "registration.public_register",
        company_slug=company.slug,
        _external=True,
    )

    selected_store_url = (
        url_for(
            "registration.public_register",
            company_slug=company.slug,
            store=selected_store,
            _external=True,
        )
        if selected_store
        else company_register_url
    )

    return render_template(
        "registration_qr_center.html",
        company=company,
        stores=stores,
        selected_store=selected_store,
        company_register_url=company_register_url,
        company_qr=make_registration_qr_data_uri(company_register_url),
        selected_store_url=selected_store_url,
        selected_store_qr=make_registration_qr_data_uri(selected_store_url),
        show_company_qr=(role in {"platform_admin", "admin"}),
    )


@registration_bp.route("/qr/print")
@login_required
@role_required("platform_admin", "admin", "supervisor", "general_manager", "manager")
def qr_print():
    if not can_access_registration_qr():
        flash("You do not have permission to print registration QR codes.", "error")
        return redirect(url_for("dashboard.home"))

    company = current_company()
    if not company:
        abort(403)

    stores = visible_qr_stores()
    allowed_store_numbers = {store.store_number for store in stores}
    selected_store = (request.args.get("store") or "").strip()

    if selected_store not in allowed_store_numbers:
        flash("You do not have access to that store QR.", "error")
        return redirect(url_for("registration.qr_center"))

    selected_store_obj = next(
        (store for store in stores if store.store_number == selected_store),
        None,
    )

    register_url = url_for(
        "registration.public_register",
        company_slug=company.slug,
        store=selected_store,
        _external=True,
    )

    return render_template(
        "registration_qr_print.html",
        company=company,
        selected_store=selected_store,
        selected_store_name=selected_store_obj.store_name if selected_store_obj else "",
        register_url=register_url,
        qr_data_uri=make_registration_qr_data_uri(register_url),
    )


@registration_bp.route("/public/<company_slug>/register", methods=["GET", "POST"])
def public_register(company_slug):
    company = company_from_slug(company_slug)
    if not company:
        abort(404)

    store_number = (request.args.get("store") or request.form.get("store_number") or "").strip()

    stores = (
        Store.query
        .filter_by(company_id=company.id, is_active=True)
        .order_by(Store.store_number.asc())
        .all()
    )

    if request.method == "POST":
        full_name = request.form.get("full_name", "").strip()
        username = request.form.get("username", "").strip().lower()
        email = request.form.get("email", "").strip() or None
        phone = request.form.get("phone", "").strip() or None
        requested_position = request.form.get("requested_position", "").strip() or None
        password = request.form.get("password", "").strip()
        confirm_password = request.form.get("confirm_password", "").strip()

        allowed_store_numbers = {store.store_number for store in stores}

        if not full_name or not username or not store_number or not password:
            flash("Please complete name, username, store, and password.", "error")
            return render_template(
                "public_register.html",
                company=company,
                stores=stores,
                store_number=store_number,
                requested_position=requested_position,
            )

        if store_number not in allowed_store_numbers:
            flash("Please select a valid store.", "error")
            return render_template(
                "public_register.html",
                company=company,
                stores=stores,
                store_number=store_number,
                requested_position=requested_position,
            )

        if password != confirm_password:
            flash("Passwords do not match.", "error")
            return render_template(
                "public_register.html",
                company=company,
                stores=stores,
                store_number=store_number,
                requested_position=requested_position,
            )

        existing_user = User.query.filter_by(company_id=company.id, username=username).first()
        if existing_user:
            flash("That username already exists. Please choose another username.", "error")
            return render_template(
                "public_register.html",
                company=company,
                stores=stores,
                store_number=store_number,
                requested_position=requested_position,
            )

        existing_pending = PendingRegistrationRequest.query.filter_by(
            company_id=company.id,
            username=username,
            status="pending",
        ).first()
        if existing_pending:
            flash("A pending request already exists for that username.", "error")
            return render_template(
                "public_register.html",
                company=company,
                stores=stores,
                store_number=store_number,
                requested_position=requested_position,
            )

        registration = PendingRegistrationRequest(
            company_id=company.id,
            full_name=full_name,
            username=username,
            email=email,
            phone=phone,
            requested_position=requested_position,
            store_number=store_number,
            password_hash=generate_password_hash(password),
        )

        db.session.add(registration)
        db.session.commit()

        return render_template("public_register_success.html", company=company)

    return render_template(
        "public_register.html",
        company=company,
        stores=stores,
        store_number=store_number,
        requested_position="",
    )


@registration_bp.route("/requests")
@login_required
@role_required("platform_admin", "admin", "supervisor", "general_manager")
def registration_requests():
    if not can_review_registration_requests():
        flash("You do not have permission to review registration requests.", "error")
        return redirect(url_for("dashboard.home"))

    company_id = current_company_id()
    if not company_id:
        abort(403)

    visible = visible_store_numbers()
    query = PendingRegistrationRequest.query.filter_by(company_id=company_id)

    if visible is not None:
        if not visible:
            registrations = []
        else:
            registrations = (
                query
                .filter(PendingRegistrationRequest.store_number.in_(visible))
                .order_by(
                    PendingRegistrationRequest.status.asc(),
                    PendingRegistrationRequest.created_at.desc(),
                )
                .all()
            )
    else:
        registrations = (
            query
            .order_by(
                PendingRegistrationRequest.status.asc(),
                PendingRegistrationRequest.created_at.desc(),
            )
            .all()
        )

    stores = visible_qr_stores()

    return render_template(
        "registration_requests.html",
        registrations=registrations,
        stores=stores,
        status_counts=registration_status_counts(registrations),
        allowed_roles=allowed_approval_roles(),
    )


@registration_bp.route("/requests/<int:registration_id>/update-store", methods=["POST"])
@login_required
@role_required("platform_admin", "admin", "supervisor", "general_manager")
def update_registration_request_store(registration_id):
    registration = PendingRegistrationRequest.query.filter_by(
        id=registration_id,
        company_id=current_company_id(),
    ).first_or_404()

    if not can_review_registration_request(registration):
        abort(403)

    if registration.status != "pending":
        flash("Only pending registration requests can be updated.", "error")
        return redirect(url_for("registration.registration_requests"))

    new_store_number = request.form.get("store_number", "").strip()

    store = Store.query.filter_by(
        company_id=current_company_id(),
        store_number=new_store_number,
        is_active=True,
    ).first()

    if not store:
        flash(f"Store {new_store_number} was not found or is inactive.", "error")
        return redirect(url_for("registration.registration_requests"))

    original_store_number = registration.store_number
    registration.store_number = new_store_number
    db.session.commit()

    flash(
        f"Updated {registration.full_name}'s registration from Store {original_store_number or '—'} to Store {new_store_number}.",
        "success",
    )
    return redirect(url_for("registration.registration_requests"))


@registration_bp.route("/requests/<int:registration_id>/approve", methods=["POST"])
@login_required
@role_required("platform_admin", "admin", "supervisor", "general_manager")
def approve_registration_request(registration_id):
    registration = PendingRegistrationRequest.query.filter_by(
        id=registration_id,
        company_id=current_company_id(),
    ).first_or_404()

    if not can_review_registration_request(registration):
        abort(403)

    if registration.status != "pending":
        flash("This request has already been reviewed.", "error")
        return redirect(url_for("registration.registration_requests"))

    final_role = request.form.get("final_role", "").strip()
    allowed_roles = allowed_approval_roles()

    if final_role not in allowed_roles:
        abort(403)

    existing_user = User.query.filter_by(
        company_id=current_company_id(),
        username=registration.username,
    ).first()

    if existing_user:
        flash("A user with that username already exists.", "error")
        return redirect(url_for("registration.registration_requests"))

    store_number = (
        registration.store_number
        if final_role in ["tm", "manager", "general_manager"]
        else None
    )

    user = User(
        company_id=current_company_id(),
        name=registration.full_name,
        username=registration.username,
        password_hash=registration.password_hash,
        role=final_role,
        store_number=store_number,
        email=registration.email,
        notification_email=registration.email,
        email_enabled=True,
        is_active=True,
    )

    db.session.add(user)
    db.session.flush()

    registration.status = "approved"
    registration.approved_role = final_role
    registration.created_user_id = user.id
    registration.reviewed_by_user_id = session.get("user_id")
    registration.reviewed_at = datetime.utcnow()
    registration.review_notes = request.form.get("review_notes", "").strip() or None

    db.session.commit()

    flash(
        f"Approved {registration.full_name} as {final_role.replace('_', ' ').title()}.",
        "success",
    )
    return redirect(url_for("registration.registration_requests"))


@registration_bp.route("/requests/<int:registration_id>/reject", methods=["POST"])
@login_required
@role_required("platform_admin", "admin", "supervisor", "general_manager")
def reject_registration_request(registration_id):
    registration = PendingRegistrationRequest.query.filter_by(
        id=registration_id,
        company_id=current_company_id(),
    ).first_or_404()

    if not can_review_registration_request(registration):
        abort(403)

    if registration.status != "pending":
        flash("This request has already been reviewed.", "error")
        return redirect(url_for("registration.registration_requests"))

    registration.status = "rejected"
    registration.reviewed_by_user_id = session.get("user_id")
    registration.reviewed_at = datetime.utcnow()
    registration.review_notes = request.form.get("review_notes", "").strip() or None

    db.session.commit()

    flash(f"Rejected {registration.full_name}'s registration request.", "success")
    return redirect(url_for("registration.registration_requests"))
