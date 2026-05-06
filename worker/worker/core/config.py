from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


REPO_ROOT = Path(__file__).resolve().parents[3]


class WorkerSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = f"sqlite:///{REPO_ROOT / 'backend' / 'coastal_watch.db'}"
    openai_api_key: str | None = None
    worker_user_agent: str = "PuertoRicoCoastalWatchWorker/0.1"
    worker_log_level: str = "INFO"
    search_model_name: str = "gpt-5.4"
    extraction_model_name: str = "gpt-5.4-mini"
    openai_search_retry_attempts: int = 3
    openai_extraction_retry_attempts: int = 3
    fetch_retry_attempts: int = 3
    case_link_candidate_limit: int = 8
    case_link_min_similarity: float = 0.34
    discovery_queries: list[str] = [
        "bloquean acceso a la playa Puerto Rico",
        "porton o verja bloquea acceso a la playa Puerto Rico",
        "servidumbre de acceso a la playa bloqueada Puerto Rico",
        "cobran entrada para acceso a la playa Puerto Rico",
        "privatizacion de acceso a la playa Puerto Rico",
        "construccion ilegal en area protegida Puerto Rico",
        "proyecto de construccion en reserva natural Puerto Rico",
        "condominio o hotel en zona costera protegida Puerto Rico",
        "relleno de humedal por construccion Puerto Rico",
        "tala de manglar por construccion Puerto Rico",
        "construccion en dunas o manglares Puerto Rico",
        "proyecto en zona maritimo terrestre Puerto Rico acceso publico",
        "querella por construccion en area protegida Puerto Rico",
        "desarrollo turistico en playa virgen Puerto Rico",
    ]
    discovery_priority_municipalities: list[str] = [
        "Aguada",
        "Aguadilla",
        "Añasco",
        "Arecibo",
        "Arroyo",
        "Barceloneta",
        "Cabo Rojo",
        "Camuy",
        "Carolina",
        "Ceiba",
        "Culebra",
        "Dorado",
        "Fajardo",
        "Guánica",
        "Guayama",
        "Guayanilla",
        "Hatillo",
        "Humacao",
        "Isabela",
        "Juana Díaz",
        "Lajas",
        "Loíza",
        "Luquillo",
        "Manatí",
        "Maunabo",
        "Mayagüez",
        "Naguabo",
        "Patillas",
        "Peñuelas",
        "Ponce",
        "Quebradillas",
        "Rincón",
        "Río Grande",
        "Salinas",
        "San Juan",
        "Santa Isabel",
        "Toa Baja",
        "Vega Alta",
        "Vega Baja",
        "Vieques",
        "Yabucoa",
    ]
    discovery_priority_batch_size: int = 5
    discovery_priority_batch_offset: int = 0
    discovery_access_query_templates: list[str] = [
        "{municipality} bloquean acceso playa",
        "{municipality} acceso playa bloqueado",
        "{municipality} servidumbre acceso playa bloqueada",
        "{municipality} cobran entrada acceso playa",
        "{municipality} porton acceso playa",
        "{municipality} verja acceso playa",
        "{municipality} camino acceso playa cerrado",
        "{municipality} privatizacion acceso playa",
    ]
    discovery_development_query_templates: list[str] = [
        "{municipality} construccion ilegal area protegida",
        "{municipality} proyecto construccion playa protegida",
        "{municipality} proyecto reserva natural construccion",
        "{municipality} hotel condominio costa protegida",
        "{municipality} manglar construccion",
        "{municipality} humedal relleno",
        "{municipality} dunas construccion",
        "{municipality} zona maritimo terrestre construccion",
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
        "acceso público",
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
        "privatizacion",
    ]
    discovery_excluded_keywords: list[str] = [
        "asesinado",
        "asesinato",
        "ahogado",
        "ahogamiento",
        "muere ahogado",
        "homicidio",
        "cadaver",
        "cadáver",
        "fiscal de turno",
        "division de homicidios",
        "división de homicidios",
        "cic de",
        "agente",
        "policia",
        "policía",
        "oleaje",
        "rescatado",
        "rescate",
        "bañista",
        "banista",
        "fin de semana en la playa",
        "guia",
        "guía",
        "que son",
        "qué son",
        "opinion",
        "opinión",
        "editorial",
        "columna",
        "arrestan",
        "arrestado",
        "turista",
        "vacaciones",
        "reapertura",
        "aniversario",
        "educacion ambiental",
        "educación ambiental",
    ]
    search_topic: str = "news"
    search_time_range: str = "year"
    discovery_include_raw_content: bool = False
    fetch_timeout: float | None = 20.0
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
    ]
    auto_publish_excluded_title_keywords: list[str] = ["opinion", "opinión", "editorial", "columna"]

    @property
    def sqlalchemy_connect_args(self) -> dict[str, object]:
        if self.database_url.startswith("sqlite"):
            return {"check_same_thread": False}

        return {}


settings = WorkerSettings()
