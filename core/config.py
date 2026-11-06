# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
import os

load_dotenv()

SECRET_KEY: str = os.getenv(
    "SECRET_KEY",
    "rxify_secure_production_secret_key_fallback_minimum_32_bytes_long_entropy",
)
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
DATABASE_URL: str = os.getenv("DATABASE_URL", "")
