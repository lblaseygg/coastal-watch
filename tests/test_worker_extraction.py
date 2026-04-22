from __future__ import annotations

from datetime import datetime, timezone

from app.models import Article, Municipality
from worker.extraction import classify_article, detect_primary_municipalities


NOW = datetime.now(timezone.utc)


def make_article(*, title: str, cleaned_text: str, publisher: str = "elnuevodia.com") -> Article:
    return Article(
        id="art-test",
        url="https://example.com/article",
        publisher=publisher,
        title=title,
        published_at=NOW,
        accessed_at=NOW,
        language="es",
        fetch_status="cleaned",
        content_hash="",
        cleaned_text=cleaned_text,
        linked_case_ids=[],
        created_at=NOW,
    )


def make_municipality(municipality_id: str, name: str) -> Municipality:
    return Municipality(
        id=municipality_id,
        name=name,
        region="coast",
        coastal=True,
        centroid_lat=0.0,
        centroid_lng=0.0,
        geojson_key=municipality_id,
    )


def sample_municipalities() -> list[Municipality]:
    return [
        make_municipality("cabo-rojo", "Cabo Rojo"),
        make_municipality("rincon", "Rincón"),
        make_municipality("lajas", "Lajas"),
        make_municipality("ponce", "Ponce"),
        make_municipality("san-juan", "San Juan"),
    ]


def test_cabo_rojo_alias_story_stays_relevant() -> None:
    article = make_article(
        title="Esencia: la controversia por playa virgen en Cabo Rojo",
        cleaned_text=(
            "Vecinos denuncian que el proyecto Esencia amenaza una playa virgen, "
            "podria limitar el acceso publico y afectaria un area costera sensible en Cabo Rojo."
        ),
    )

    draft = classify_article(article, sample_municipalities())

    assert draft.relevance == "relevant"
    assert draft.category == "access_restriction"
    assert draft.municipality_ids == ["cabo-rojo"]
    assert draft.sensitive_flags == []


def test_rincon_alias_story_detects_municipality_from_place_name() -> None:
    article = make_article(
        title="Regresa carey a anidar en la zona de construcción del condominio Sol y Playa en Rincón",
        cleaned_text=(
            "La construccion del condominio Sol y Playa continua bajo controversia "
            "por su impacto en la costa y la zona de anidaje."
        ),
    )

    municipality_ids = detect_primary_municipalities(article, sample_municipalities())
    draft = classify_article(article, sample_municipalities())

    assert municipality_ids == ["rincon"]
    assert draft.relevance == "relevant"
    assert draft.municipality_ids == ["rincon"]


def test_generic_policy_story_is_not_treated_as_tracker_scope() -> None:
    article = make_article(
        title="Más de 50 organizaciones se manifiestan en rechazo a medida que redefine la zona marítimo terrestre",
        cleaned_text=(
            "Las organizaciones criticaron la medida legislativa y advirtieron sobre sus "
            "efectos generales en el acceso publico a las playas, sin describir una obra "
            "concreta, un municipio especifico o un lugar costero puntual."
        ),
    )

    draft = classify_article(article, sample_municipalities())

    assert draft.relevance == "irrelevant"
    assert "outside_tracker_scope" in draft.sensitive_flags


def test_access_guide_story_is_irrelevant_without_blocking_or_dispute() -> None:
    article = make_article(
        title="DRNA | Acceso público a la costa",
        cleaned_text=(
            "La guia orienta a la ciudadania sobre el acceso publico a la costa y resume "
            "reglas generales sin describir bloqueo, verja, cobro o controversia concreta."
        ),
        publisher="drna.pr.gov",
    )

    draft = classify_article(article, sample_municipalities())

    assert draft.relevance == "irrelevant"
    assert "general_access_context" in draft.sensitive_flags


def test_aguada_blocked_access_story_is_relevant() -> None:
    article = make_article(
        title="Municipio de Aguada va contra empresario que bloqueó acceso a playa",
        cleaned_text=(
            "El municipio denuncio un porton que bloquea el acceso publico a la playa "
            "y la servidumbre costera en Aguada."
        ),
        publisher="primerahora.com",
    )

    municipalities = sample_municipalities() + [make_municipality("aguada", "Aguada")]
    draft = classify_article(article, municipalities)

    assert draft.relevance == "relevant"
    assert draft.category == "access_restriction"
    assert draft.municipality_ids == ["aguada"]


def test_unrelated_development_story_is_irrelevant() -> None:
    article = make_article(
        title="Costará $22 millones: construcción aumentará capacidad militar del Fuerte Buchanan",
        cleaned_text=(
            "La construccion aumentara la capacidad militar del fuerte sin mencionar playas, "
            "areas protegidas, acceso costero o destruccion ambiental."
        ),
    )

    draft = classify_article(article, sample_municipalities())

    assert draft.relevance == "irrelevant"
    assert draft.municipality_ids == []
    assert "outside_tracker_scope" in draft.sensitive_flags


def test_conservation_story_without_project_or_blockade_is_irrelevant() -> None:
    article = make_article(
        title="Bosque del Pueblo cumple 30 años: instan a continuar la lucha de protección de terrenos en Puerto Rico",
        cleaned_text=(
            "La nota destaca esfuerzos de conservacion y educacion ambiental sin describir "
            "construccion, destruccion, acceso bloqueado o proyecto especifico en un lugar costero."
        ),
    )

    draft = classify_article(article, sample_municipalities())

    assert draft.relevance == "irrelevant"
    assert "outside_tracker_scope" in draft.sensitive_flags
