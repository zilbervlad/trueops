from flask import Blueprint, render_template


public_site_bp = Blueprint("public_site", __name__)


@public_site_bp.get("/public")
def public_home():
    return render_template("public_site/index.html")


@public_site_bp.get("/privacy")
def privacy():
    return render_template("public_site/privacy.html")


@public_site_bp.get("/support")
def support():
    return render_template("public_site/support.html")


@public_site_bp.get("/terms")
def terms():
    return render_template("public_site/terms.html")


@public_site_bp.get("/delete-account")
def delete_account():
    return render_template("public_site/delete_account.html")
