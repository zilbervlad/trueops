from datetime import datetime

import cloudinary
import cloudinary.uploader
import cloudinary.utils

from flask import Blueprint, g, jsonify, request

from app.extensions import db
from app.models import Company, Store, SVRReport, SVRReportValue, SVRTemplateField, UploadedPhoto
from app.mobile_api.permissions import mobile_error, mobile_login_required, scoped_store_query_for_user, user_can_access_store_number
from app.svr.routes import (
    MAX_SVR_PHOTO_BYTES,
    MAX_SVR_PHOTOS_TOTAL,
    allowed_photo_file,
    configure_cloudinary,
    get_file_size,
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


SVR_CREATOR_ROLES = {
    "platform_admin",
    "admin",
    "hr",
    "coach",
    "supervisor",
}


def user_can_create_svr_for_store(user, store_number):
    role = normalize_role(user)

    if role not in SVR_CREATOR_ROLES:
        return False

    store_number = str(store_number or "").strip()

    if not store_number:
        return False

    return user_can_access_store_number(user, Store, store_number)


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



def serialize_svr_photo(photo):
    return {
        "id": photo.id,
        "field_key": photo.field_key or "",
        "caption": photo.caption or "",
        "image_url": photo.image_url,
        "thumbnail_url": photo.thumbnail_url or photo.image_url,
        "original_filename": photo.original_filename or "",
        "created_at": photo.created_at.isoformat() if photo.created_at else None,
    }


def serialize_report(report):
    values = sorted(report.values, key=lambda value: (value.sort_order, value.id))

    photos = (
        UploadedPhoto.query
        .filter_by(
            module="svr",
            parent_type="svr_report",
            parent_id=report.id,
        )
        .filter(
            (UploadedPhoto.company_id == report.company_id)
            | (UploadedPhoto.company_id.is_(None))
        )
        .order_by(
            UploadedPhoto.created_at.asc(),
            UploadedPhoto.id.asc(),
        )
        .all()
    )

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
        "photos": [serialize_svr_photo(photo) for photo in photos],
        "photo_count": len(photos),
    }


@mobile_svr_bp.get("/stores")
@mobile_login_required
def svr_stores():
    user = g.mobile_user
    stores = visible_store_query(user).order_by(Store.store_number.asc()).all()

    return jsonify({
        "success": True,
        "stores": [serialize_store(store) for store in stores],
        "can_create_svr": normalize_role(user) in SVR_CREATOR_ROLES,
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
        "can_create_svr": user_can_create_svr_for_store(user, store.store_number),
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


@mobile_svr_bp.post("/reports/<int:report_id>/photos")
@mobile_login_required
def upload_mobile_svr_photos(report_id):
    user = g.mobile_user

    report = SVRReport.query.filter_by(
        id=report_id,
        company_id=user.company_id,
    ).first()

    if not report:
        return mobile_error("SVR report not found.", 404)

    if not user_can_access_store_number(user, Store, report.store_number):
        return mobile_error("You do not have access to this SVR.", 403)

    if not user_can_create_svr_for_store(user, report.store_number):
        return mobile_error("Only supervisors and above can upload SVR photos.", 403)

    if not configure_cloudinary():
        return mobile_error("SVR photo storage is not configured.", 503)

    existing_count = UploadedPhoto.query.filter_by(
        module="svr",
        parent_type="svr_report",
        parent_id=report.id,
    ).count()

    files = request.files.getlist("photos")
    field_key = (request.form.get("field_key") or "general_photos").strip()
    caption = (request.form.get("caption") or "").strip()[:255]

    if not files:
        return mobile_error("No photos were provided.", 400)

    remaining_slots = max(0, MAX_SVR_PHOTOS_TOTAL - existing_count)

    if remaining_slots <= 0:
        return mobile_error(
            f"This SVR already has the maximum of {MAX_SVR_PHOTOS_TOTAL} photos.",
            400,
        )

    uploaded = []
    skipped = []

    for file_storage in files[:remaining_slots]:
        if not file_storage or not file_storage.filename:
            continue

        if not allowed_photo_file(file_storage):
            skipped.append({
                "filename": file_storage.filename,
                "reason": "Unsupported photo type.",
            })
            continue

        file_size = get_file_size(file_storage)

        if file_size and file_size > MAX_SVR_PHOTO_BYTES:
            skipped.append({
                "filename": file_storage.filename,
                "reason": "Photo exceeds the 5 MB limit.",
            })
            continue

        folder = (
            f"trueops/svr/company_{report.company_id or 'none'}"
            f"/store_{report.store_number}/report_{report.id}"
        )

        try:
            result = cloudinary.uploader.upload(
                file_storage,
                folder=folder,
                resource_type="image",
                overwrite=False,
                transformation=[
                    {
                        "width": 1600,
                        "height": 1600,
                        "crop": "limit",
                        "quality": "auto",
                        "fetch_format": "auto",
                    }
                ],
            )
        except Exception as exc:
            print(
                f"Mobile SVR photo upload failed for report "
                f"{report.id}: {exc}"
            )
            skipped.append({
                "filename": file_storage.filename,
                "reason": "Upload failed.",
            })
            continue

        image_url = result.get("secure_url")
        public_id = result.get("public_id")

        if not image_url:
            skipped.append({
                "filename": file_storage.filename,
                "reason": "Cloud storage returned no image URL.",
            })
            continue

        thumbnail_url = image_url

        if public_id:
            thumbnail_url = cloudinary.utils.cloudinary_url(
                public_id,
                width=320,
                height=240,
                crop="fill",
                quality="auto",
                fetch_format="auto",
                secure=True,
            )[0]

        photo = UploadedPhoto(
            company_id=report.company_id,
            store_number=report.store_number,
            uploaded_by_user_id=user.id,
            module="svr",
            parent_type="svr_report",
            parent_id=report.id,
            field_key=field_key,
            caption=caption,
            image_url=image_url,
            thumbnail_url=thumbnail_url,
            storage_key=public_id,
            original_filename=file_storage.filename,
            content_type=file_storage.mimetype,
            file_size=file_size,
        )

        db.session.add(photo)
        db.session.flush()

        uploaded.append(serialize_svr_photo(photo))

    db.session.commit()

    if len(files) > remaining_slots:
        skipped.append({
            "filename": "",
            "reason": (
                f"Only {remaining_slots} additional photo"
                f"{'' if remaining_slots == 1 else 's'} could be added."
            ),
        })

    return jsonify({
        "success": True,
        "uploaded": uploaded,
        "uploaded_count": len(uploaded),
        "skipped": skipped,
        "report": serialize_report(report),
    })



@mobile_svr_bp.post("/reports")
@mobile_login_required
def create_svr_report():
    user = g.mobile_user
    data = request.get_json(silent=True) or {}

    store = resolve_store_for_user(user, data.get("store_number"))

    if not store:
        return mobile_error("Store not found.", 404)

    if not user_can_create_svr_for_store(user, store.store_number):
        return mobile_error("Only supervisors and above can create SVRs.", 403)

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
