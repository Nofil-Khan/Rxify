# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
import os

load_dotenv()

SECRET_KEY: str = os.getenv(
    "SECRET_KEY"

    # "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",  # 64-char hex fallback (≥32 bytes)
)
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
DATABASE_URL: str = os.getenv("DATABASE_URL", "")
