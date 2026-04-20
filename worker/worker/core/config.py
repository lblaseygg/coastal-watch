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
        "construccion en playas Puerto Rico",
        "proyecto de construccion en la costa Puerto Rico",
        "construccion en dunas o manglares Puerto Rico",
        "construccion en areas protegidas Puerto Rico",
        "proyecto en reserva natural Puerto Rico",
        "desarrollo en bosque protegido o corredor ecologico Puerto Rico",
        "destruccion de humedales o manglares por construccion Puerto Rico",
        "cobran entrada a la playa Puerto Rico",
        "cobro por acceso a la playa Puerto Rico",
        "privatizacion de playas Puerto Rico",
        "zona maritimo terrestre acceso playa Puerto Rico",
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
        "area protegida",
        "areas protegidas",
        "reserva natural",
        "reserva",
        "bosque",
        "bosque protegido",
        "corredor ecologico",
        "corredor ecológico",
        "estuario",
        "estuarios",
        "karso",
        "carso",
        "cueva",
        "cuevas",
        "terreno protegido",
        "zona protegida",
    ]
    discovery_issue_keywords: list[str] = [
        "acceso",
        "acceso publico",
        "bloqueo",
        "cierre",
        "servidumbre",
        "cobro",
        "cobran",
        "cobrando",
        "cargo",
        "tarifa",
        "pagar",
        "entrada",
        "parking",
        "estacionamiento",
        "peaje",
        "permiso",
        "permisos",
        "ogpe",
        "drna",
        "construccion",
        "urbanizacion",
        "urbanización",
        "desarrollo",
        "destruir",
        "destruccion",
        "destrucción",
        "impacto ambiental",
        "relleno",
        "excavacion",
        "excavación",
        "tala",
        "remocion",
        "remoción",
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
    tavily_extract_depth: str = "basic"
    tavily_extract_format: str = "text"
    tavily_extract_timeout: float | None = 20.0
    auto_publish_trusted_publishers: list[str] = [
        "elnuevodia.com",
        "endi.com",
        "primerahora.com",
        "noticel.com",
        "periodismoinvestigativo.com",
        "dialogo.upr.edu",
        "metro.pr",
        "telemundopr.com",
        "wapa.tv",
        "drna.pr.gov",
        "jp.pr.gov",
        "ogpe.pr.gov",
    ]
    auto_publish_min_confidence: float = 0.72
    auto_publish_allowed_categories: list[str] = [
        "access_restriction",
        "development",
        "environmental_concern",
        "policy_or_permitting",
    ]
    auto_publish_excluded_title_keywords: list[str] = ["opinion", "opinión", "editorial", "columna"]

    @property
    def sqlalchemy_connect_args(self) -> dict[str, object]:
        if self.database_url.startswith("sqlite"):
            return {"check_same_thread": False}

        return {}


settings = WorkerSettings()
