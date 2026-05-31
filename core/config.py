from dotenv import load_dotenv
import os

load_dotenv()

SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkey")  # Override via .env in production
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
