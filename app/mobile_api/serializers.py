from app.models import Store


def serialize_company(company):
    if not company:
        return None

    return {
        "id": company.id,
        "name": company.name,
        "slug": company.slug,
        "accent_color": company.accent_color,
        "logo_filename": company.logo_filename,
    }


def serialize_user(user):
    if not user:
        return None

    return {
        "id": user.id,
        "company_id": user.company_id,
        "name": user.name,
        "username": user.username,
        "role": user.role,
        "area_name": user.area_name,
        "store_number": user.store_number,
        "email": user.email,
        "is_active": bool(user.is_active),
        "is_platform_admin": bool(user.is_platform_admin()),
    }


def serialize_store(store):
    return {
        "id": store.id,
        "company_id": store.company_id,
        "store_number": store.store_number,
        "store_name": store.store_name,
        "area_name": store.area_name,
        "is_active": bool(store.is_active),
    }


def visible_stores_for_user(user):
    if not user or not user.company_id:
        return []

    query = Store.query.filter_by(
        company_id=user.company_id,
        is_active=True,
    )

    role = (user.role or "").strip().lower()

    if role in {"admin", "platform_admin", "maintenance"}:
        return query.order_by(Store.store_number.asc()).all()

    if role == "supervisor":
        if not user.area_name:
            return []
        return (
            query
            .filter_by(area_name=user.area_name)
            .order_by(Store.store_number.asc())
            .all()
        )

    if role == "manager":
        if not user.store_number:
            return []
        return (
            query
            .filter_by(store_number=user.store_number)
            .order_by(Store.store_number.asc())
            .all()
        )

    return []


def serialize_mobile_context(user):
    stores = visible_stores_for_user(user)

    return {
        "user": serialize_user(user),
        "company": serialize_company(user.company),
        "stores": [serialize_store(store) for store in stores],
        "modules": [
            {
                "key": "home",
                "label": "Home",
                "enabled": True,
            },
            {
                "key": "messages",
                "label": "Messages",
                "enabled": True,
            },
            {
                "key": "checklist",
                "label": "Daily Checklist",
                "enabled": True,
            },
            {
                "key": "svr",
                "label": "SVR",
                "enabled": True,
            },
            {
                "key": "maintenance",
                "label": "Maintenance",
                "enabled": True,
            },
        ],
    }
