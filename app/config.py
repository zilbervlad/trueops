import os
from pathlib import Path
from datetime import timedelta

from dotenv import load_dotenv


load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
INSTANCE_DIR = BASE_DIR / "instance"

INSTANCE_DIR.mkdir(exist_ok=True)


class Config:
    SECRET_KEY = (
        os.getenv("SECRET_KEY")
        or os.getenv("FLASK_SECRET_KEY")
        or "dev-secret-key"
    )

    # -------------------------
    # SESSION / LOGIN SETTINGS
    # -------------------------
    PERMANENT_SESSION_LIFETIME = timedelta(days=30)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_REFRESH_EACH_REQUEST = True

    database_url = os.getenv("DATABASE_URL", "").strip()

    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    SQLALCHEMY_DATABASE_URI = (
        database_url
        if database_url
        else f"sqlite:///{INSTANCE_DIR / 'trueops.db'}"
    )

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # -------------------------
    # EMAIL SETTINGS
    # -------------------------
    MAIL_SERVER = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.getenv("MAIL_PORT", "587"))
    MAIL_USE_TLS = os.getenv("MAIL_USE_TLS", "true").lower() == "true"
    MAIL_USE_SSL = os.getenv("MAIL_USE_SSL", "false").lower() == "true"
    MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
    MAIL_DEFAULT_SENDER = os.getenv(
        "MAIL_DEFAULT_SENDER",
        MAIL_USERNAME or "noreplytrueops@gmail.com",
    )