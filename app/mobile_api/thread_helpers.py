from app.extensions import db
from app.models import Store, TrueOpsThread, TrueOpsThreadMember, User


def normalize_key(value):
    value = (value or "").strip().lower()
    cleaned = []

    for char in value:
        if char.isalnum():
            cleaned.append(char)
        elif char in {" ", "-", "_", "/"}:
            cleaned.append("-")

    key = "".join(cleaned)

    while "--" in key:
        key = key.replace("--", "-")

    return key.strip("-") or "general"


def ensure_thread(
    company_id,
    thread_type,
    name,
    group_key,
    created_by_user_id=None,
    store_number=None,
    area_name=None,
    role_key=None,
):
    thread = TrueOpsThread.query.filter_by(
        company_id=company_id,
        group_key=group_key,
    ).first()

    if thread:
        thread.name = name
        thread.thread_type = thread_type
        thread.store_number = store_number
        thread.area_name = area_name
        thread.role_key = role_key
        thread.is_active = True
        return thread

    thread = TrueOpsThread(
        company_id=company_id,
        thread_type=thread_type,
        name=name,
        group_key=group_key,
        created_by_user_id=created_by_user_id,
        store_number=store_number,
        area_name=area_name,
        role_key=role_key,
        is_active=True,
    )

    db.session.add(thread)
    db.session.flush()

    return thread


def ensure_thread_member(thread, user, member_role="member"):
    if not thread or not user:
        return None

    membership = TrueOpsThreadMember.query.filter_by(
        thread_id=thread.id,
        user_id=user.id,
    ).first()

    if membership:
        membership.hidden_at = None
        return membership

    membership = TrueOpsThreadMember(
        thread_id=thread.id,
        user_id=user.id,
        member_role=member_role,
    )

    db.session.add(membership)

    return membership


def company_users(company_id):
    return User.query.filter_by(
        company_id=company_id,
        is_active=True,
    ).all()


def user_belongs_to_store(user, store_number):
    return bool(
        user
        and store_number
        and (user.store_number or "").strip() == str(store_number).strip()
    )


def user_belongs_to_area(user, area_name):
    return bool(
        user
        and area_name
        and (user.area_name or "").strip().lower() == str(area_name).strip().lower()
    )


def ensure_default_threads_for_company(company, created_by_user_id=None):
    if not company:
        return []

    company_id = company.id
    users = company_users(company_id)
    created_threads = []

    company_thread = ensure_thread(
        company_id=company_id,
        thread_type="company",
        name=f"{company.name} Company Chat",
        group_key=f"company:{company_id}:company",
        created_by_user_id=created_by_user_id,
    )
    created_threads.append(company_thread)

    for user in users:
        role = (user.role or "").strip().lower()
        if role in {"admin", "platform_admin", "hr", "coach"}:
            ensure_thread_member(company_thread, user, "owner" if user.id == created_by_user_id else "member")

    stores = (
        Store.query
        .filter_by(company_id=company_id, is_active=True)
        .order_by(Store.store_number.asc())
        .all()
    )

    area_names = sorted({
        (store.area_name or "").strip()
        for store in stores
        if (store.area_name or "").strip()
    })

    for area_name in area_names:
        area_key = normalize_key(area_name)
        area_thread = ensure_thread(
            company_id=company_id,
            thread_type="area",
            name=f"{area_name} Area Chat",
            group_key=f"company:{company_id}:area:{area_key}",
            created_by_user_id=created_by_user_id,
            area_name=area_name,
        )
        created_threads.append(area_thread)

        for user in users:
            role = (user.role or "").strip().lower()
            if role in {"admin", "platform_admin", "hr", "coach"} or user_belongs_to_area(user, area_name):
                ensure_thread_member(area_thread, user)

    for store in stores:
        store_thread = ensure_thread(
            company_id=company_id,
            thread_type="store",
            name=f"Store {store.store_number} Chat",
            group_key=f"company:{company_id}:store:{store.store_number}",
            created_by_user_id=created_by_user_id,
            store_number=store.store_number,
            area_name=store.area_name,
        )
        created_threads.append(store_thread)

        for user in users:
            role = (user.role or "").strip().lower()

            can_join_store_thread = (
                role in {"admin", "platform_admin", "hr", "coach", "maintenance"}
                or user_belongs_to_store(user, store.store_number)
                or (
                    role == "supervisor"
                    and user_belongs_to_area(user, store.area_name)
                )
            )

            if can_join_store_thread:
                ensure_thread_member(store_thread, user)

    role_labels = {
        "admin": "Admin",
        "supervisor": "Supervisor",
        "manager": "Manager",
        "maintenance": "Maintenance",
    }

    for role_key, role_label in role_labels.items():
        role_thread = ensure_thread(
            company_id=company_id,
            thread_type="role",
            name=f"{role_label} Chat",
            group_key=f"company:{company_id}:role:{role_key}",
            created_by_user_id=created_by_user_id,
            role_key=role_key,
        )
        created_threads.append(role_thread)

        for user in users:
            role = (user.role or "").strip().lower()
            if role in {"admin", "platform_admin", "hr", "coach", role_key}:
                ensure_thread_member(role_thread, user)

    db.session.commit()

    return created_threads
