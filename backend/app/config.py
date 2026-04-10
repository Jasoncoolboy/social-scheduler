from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    APP_NAME: str = "SocialScheduler"
    SECRET_KEY: str = "change-this-secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    DATABASE_URL: str = "sqlite:///./social_scheduler.db"
    MEDIA_DIR: str = "media_storage"
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# Ensure media directory exists
Path(settings.MEDIA_DIR).mkdir(parents=True, exist_ok=True)