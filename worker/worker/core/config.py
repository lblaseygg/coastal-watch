from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


REPO_ROOT = Path(__file__).resolve().parents[3]


class WorkerSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = f"sqlite:///{REPO_ROOT / 'backend' / 'coastal_watch.db'}"
    tavily_api_key: str | None = None
    worker_user_agent: str = "PuertoRicoCoastalWatchWorker/0.1"
    extraction_model_name: str = "heuristic-v1"
    discovery_queries: list[str] = [
        "Puerto Rico beach access dispute",
        "Puerto Rico coastal permit notice",
        "Puerto Rico maritime terrestrial zone dispute",
        "Puerto Rico dune construction coastal",
    ]
    discovery_domains: list[str] = []
    discovery_exclude_domains: list[str] = []
    discovery_languages: list[str] = ["en", "es"]
    discovery_coastal_keywords: list[str] = [
        "playa",
        "playas",
        "costa",
        "costero",
        "costera",
        "costeros",
        "costeras",
        "litoral",
        "maritimo",
        "maritimo terrestre",
        "maritimo-terrestre",
        "zona maritimo terrestre",
        "zmt",
        "duna",
        "dunas",
        "manglar",
        "manglares",
        "arrecife",
        "arrecifes",
        "humedal",
        "humedales",
    ]
    discovery_issue_keywords: list[str] = [
        "acceso",
        "acceso publico",
        "bloqueo",
        "cierre",
        "servidumbre",
        "permiso",
        "permisos",
        "ogpe",
        "drna",
        "construccion",
        "desarrollo",
        "deslinde",
        "dominio publico",
        "erosion",
        "erosion costera",
        "querella",
        "demanda",
        "proyecto",
        "ambiental",
        "proteccion",
        "conservacion",
        "privatizacion",
    ]
    search_topic: str = "news"
    search_depth: str = "basic"
    search_time_range: str = "month"
    discovery_include_raw_content: bool = False

    @property
    def sqlalchemy_connect_args(self) -> dict[str, object]:
        if self.database_url.startswith("sqlite"):
            return {"check_same_thread": False}

        return {}


settings = WorkerSettings()
