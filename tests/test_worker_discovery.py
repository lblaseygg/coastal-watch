from __future__ import annotations

from worker.core.config import settings
from worker.discovery import SearchResult, build_discovery_queries, score_search_result


def test_build_discovery_queries_batches_priority_municipalities(monkeypatch) -> None:
    monkeypatch.setattr(settings, "discovery_queries", ["base query"])
    monkeypatch.setattr(settings, "discovery_priority_municipalities", ["Aguada", "Cabo Rojo", "Rincón"])
    monkeypatch.setattr(settings, "discovery_priority_batch_size", 2)
    monkeypatch.setattr(settings, "discovery_priority_batch_offset", 1)
    monkeypatch.setattr(settings, "discovery_access_query_templates", ["{municipality} acceso playa bloqueado"])
    monkeypatch.setattr(settings, "discovery_development_query_templates", ["{municipality} construccion costa"])

    queries = build_discovery_queries()

    assert queries == [
        "base query",
        "Cabo Rojo acceso playa bloqueado",
        "Cabo Rojo construccion costa",
        "Rincón acceso playa bloqueado",
        "Rincón construccion costa",
    ]


def test_score_search_result_rejects_incident_story() -> None:
    result = SearchResult(
        url="https://example.com/incident",
        title="Hombre de 76 años muere ahogado en playa de Luquillo",
        snippet="El agente y la division de homicidios investigan la muerte en la playa.",
        publisher="telemundopr.com",
    )

    match = score_search_result(result)

    assert not match.is_relevant
    assert "ahogado" in match.excluded_terms


def test_score_search_result_accepts_access_blocking_story() -> None:
    result = SearchResult(
        url="https://example.com/access",
        title="Vecinos denuncian portón que bloquea acceso público a playa en Cabo Rojo",
        snippet="La controversia se centra en el acceso publico, una verja y una servidumbre costera.",
        publisher="elnuevodia.com",
    )

    match = score_search_result(result)

    assert match.is_relevant
    assert "playa" in match.coastal_terms
    assert "acceso" in match.access_terms
    assert "porton" in match.blocking_terms


def test_score_search_result_accepts_protected_land_construction_story() -> None:
    result = SearchResult(
        url="https://example.com/development",
        title="Proyecto hotelero en zona marítimo terrestre de Cabo Rojo desata controversia",
        snippet="Vecinos denuncian construccion en un area protegida y posible impacto sobre manglares.",
        publisher="elnuevodia.com",
    )

    match = score_search_result(result)

    assert match.is_relevant
    assert "zona maritimo terrestre" in match.protected_terms
    assert "construccion" in match.development_terms
    assert "controversia" in match.conflict_terms


def test_score_search_result_rejects_general_policy_story() -> None:
    result = SearchResult(
        url="https://example.com/policy",
        title="Entidades alertan sobre riesgos de privatización con propuesta para redefinir la zona marítimo terrestre",
        snippet="La medida legislativa generó debate sobre acceso a las playas sin identificar obra concreta ni municipio puntual.",
        publisher="elnuevodia.com",
    )

    match = score_search_result(result)

    assert not match.is_relevant
    assert "acceso" in match.access_terms
    assert not match.blocking_terms
