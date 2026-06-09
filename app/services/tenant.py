from functools import wraps

from flask import abort, session

from app.models import Store, User


def current_company_id():
    return session.get("current_company_id")


def is_platform_admin():
    return bool(session.get("is_platform_admin"))


def current_user_role():
    return session.get("user_role")


def require_company_context():
    """
    Normal users must always have a selected company.
    Platform admins may temporarily have no selected company on company-admin screens.
    """
    company_id = current_company_id()

    if not company_id and not is_platform_admin():
        abort(403)

    return company_id


def scoped_query(model):
    """
    Returns model.query filtered to the active company when the model has company_id.
    Platform admins are still scoped when they have selected a company.
    """
    query = model.query
    company_id = current_company_id()

    if hasattr(model, "company_id") and company_id:
        query = query.filter(model.company_id == company_id)

    if hasattr(model, "company_id") and not company_id and not is_platform_admin():
        abort(403)

    return query


def scoped_get_or_404(model, object_id):
    """
    Safer replacement for Model.query.get_or_404(id).
    Applies company_id filtering first.
    """
    return scoped_query(model).filter(model.id == object_id).first_or_404()


def scoped_store_query(active_only=True):
    query = Store.query

    company_id = current_company_id()
    if company_id:
        query = query.filter(Store.company_id == company_id)
    elif not is_platform_admin():
        abort(403)

    if active_only:
        query = query.filter(Store.is_active == True)

    return query


def scoped_store_by_number(store_number, active_only=True):
    return scoped_store_query(active_only=active_only).filter(
        Store.store_number == str(store_number)
    ).first()


def scoped_user_query(active_only=True):
    query = User.query

    company_id = current_company_id()
    if company_id:
        query = query.filter(User.company_id == company_id)
    elif not is_platform_admin():
        abort(403)

    if active_only:
        query = query.filter(User.is_active == True)

    return query
