from __future__ import annotations

from datetime import datetime, timezone

from app.models import Article, ArticleExtraction, Case
from worker.routing import can_auto_publish


NOW = datetime.now(timezone.utc)


def make_article(*, title: str, publisher: str = "elnuevodia.com") -> Article:
    return Article(
        id="art-route",
        url="https://example.com/route",
        publisher=publisher,
        title=title,
        published_at=NOW,
        accessed_at=NOW,
        language="es",
        fetch_status="cleaned",
        content_hash="",
        cleaned_text="Texto de prueba",
        linked_case_ids=["case-route"],
        created_at=NOW,
    )


def make_extraction(
    *,
    relevance: str = "relevant",
    category: str = "development",
    confidence_score: float = 0.92,
    municipality_ids: list[str] | None = None,
    sensitive_flags: list[str] | None = None,
) -> ArticleExtraction:
    return ArticleExtraction(
        id="ext-route",
        article_id="art-route",
        schema_version="phase0-v1",
        relevance=relevance,
        confidence_score=confidence_score,
        extracted_case_title="Caso de prueba",
        extracted_summary="Resumen",
        category=category,
        municipality_ids=municipality_ids or ["cabo-rojo"],
        claims=[],
        sensitive_flags=sensitive_flags or [],
        needs_review=False,
        model_name="heuristic-v1",
        created_at=NOW,
    )


def make_case() -> Case:
    return Case(
        id="case-route",
        slug="case-route",
        title="Caso de prueba",
        municipality_id="cabo-rojo",
        status="reported",
        publication_status="pending_review",
        review_state="pending_review",
        category="development",
        tags=[],
        public_summary="",
        internal_summary="",
        location_lat=0.0,
        location_lng=0.0,
        location_precision="municipality",
        first_reported_at=NOW,
        last_updated_at=NOW,
        source_article_ids=[],
        review_reason_codes=[],
        confidence_score=0.0,
    )


def test_can_auto_publish_for_trusted_article() -> None:
    assert can_auto_publish(make_article(title="Proyecto controversia en Cabo Rojo"), make_extraction(), make_case())


def test_cannot_auto_publish_excluded_title() -> None:
    article = make_article(title="Opinión | Tergiversar la ciencia para privatizar la playa")

    assert not can_auto_publish(article, make_extraction(category="access_restriction"), make_case())


def test_cannot_auto_publish_sensitive_or_low_confidence_extraction() -> None:
    article = make_article(title="Proyecto controversia en Cabo Rojo")
    extraction = make_extraction(confidence_score=0.6, sensitive_flags=["legal_claim"])

    assert not can_auto_publish(article, extraction, make_case())
