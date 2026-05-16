import os
from pathlib import Path

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

    database_url = os.getenv("DATABASE_URL", "").strip()

    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    SQLALCHEMY_DATABASE_URI = (
        database_url
        if database_url
        else f"sqlite:///{INSTANCE_DIR / 'trueops.db'}"
    )

    SQLALCHEMY_TRACK_MODIFICATIONS = False