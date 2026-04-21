from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Puerto Rico Coastal Watch API"
    app_env: str = "development"
    database_url: str = f"sqlite:///{BACKEND_ROOT / 'coastal_watch.db'}"
    api_prefix: str = "/api"
    allowed_origins: list[str] = ["http://localhost:3000"]
    admin_api_token: str | None = None
    admin_rate_limit_window_seconds: int = 60
    admin_rate_limit_max_requests: int = 60
    admin_auth_rate_limit_window_seconds: int = 300
    admin_auth_rate_limit_max_attempts: int = 10

    @property
    def sqlalchemy_connect_args(self) -> dict[str, object]:
        if self.database_url.startswith("sqlite"):
            return {"check_same_thread": False}

        return {}


settings = Settings()
