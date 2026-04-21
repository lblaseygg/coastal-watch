from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.models import Article, ArticleExtraction, Case, Municipality
from worker.routing import find_linked_case


NOW = datetime.now(timezone.utc)


def session_factory() -> sessionmaker[Session]:
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def make_municipality() -> Municipality:
    return Municipality(
        id="cabo-rojo",
        name="Cabo Rojo",
        region="west",
        coastal=True,
        centroid_lat=0.0,
        centroid_lng=0.0,
        geojson_key="cabo-rojo",
    )


def make_rincon_municipality() -> Municipality:
    return Municipality(
        id="rincon",
        name="Rincón",
        region="west",
        coastal=True,
        centroid_lat=0.0,
        centroid_lng=0.0,
        geojson_key="rincon",
    )


def make_case(case_id: str, title: str, municipality_id: str = "cabo-rojo") -> Case:
    return Case(
        id=case_id,
        slug=case_id,
        title=title,
        municipality_id=municipality_id,
        status="reported",
        publication_status="approved",
        review_state="approved",
        category="development",
        tags=[],
        public_summary="summary",
        internal_summary="summary",
        location_lat=0.0,
        location_lng=0.0,
        location_precision="municipality",
        first_reported_at=NOW,
        last_updated_at=NOW,
        source_article_ids=[],
        review_reason_codes=[],
        confidence_score=0.8,
    )


def make_article(article_id: str, *, title: str, content_hash: str, linked_case_ids: list[str] | None = None) -> Article:
    return Article(
        id=article_id,
        url=f"https://example.com/{article_id}",
        publisher="elnuevodia.com",
        title=title,
        published_at=NOW,
        accessed_at=NOW,
        language="es",
        fetch_status="cleaned",
        content_hash=content_hash,
        cleaned_text="texto",
        linked_case_ids=linked_case_ids or [],
        created_at=NOW,
    )


def make_extraction(article_id: str, title: str) -> ArticleExtraction:
    return ArticleExtraction(
        id=f"ext-{article_id}",
        article_id=article_id,
        schema_version="phase0-v1",
        relevance="relevant",
        confidence_score=0.91,
        extracted_case_title=title,
        extracted_summary="summary",
        category="development",
        municipality_ids=["cabo-rojo"],
        claims=[],
        sensitive_flags=[],
        needs_review=False,
        model_name="heuristic-v1",
        created_at=NOW,
    )


def test_find_linked_case_reuses_duplicate_content_case() -> None:
    SessionLocal = session_factory()
    with SessionLocal() as session:
        session.add(make_municipality())
        case = make_case("case-esencia", "Esencia: controversia en Cabo Rojo")
        existing_article = make_article(
            "art-existing",
            title="Esencia: controversia en Cabo Rojo",
            content_hash="sha256:dup",
            linked_case_ids=[case.id],
        )
        new_article = make_article(
            "art-new",
            title="Proyecto Esencia genera nuevas protestas en Cabo Rojo",
            content_hash="sha256:dup",
        )
        extraction = make_extraction(new_article.id, new_article.title)
        session.add_all([case, existing_article, new_article, extraction])
        session.commit()

        linked = find_linked_case(session, new_article, extraction)

        assert linked is not None
        assert linked.id == case.id


def test_find_linked_case_uses_title_similarity_within_same_municipality_and_category() -> None:
    SessionLocal = session_factory()
    with SessionLocal() as session:
        session.add_all([make_municipality(), make_rincon_municipality()])
        case = make_case("case-sol-playa", "Condominio Sol y Playa en Rincón", municipality_id="rincon")
        article = make_article(
            "art-sol-playa",
            title="Regresa carey a anidar en la zona de construcción del condominio Sol y Playa en Rincón",
            content_hash="sha256:new",
        )
        extraction = make_extraction(article.id, article.title)
        extraction.municipality_ids = ["rincon"]
        session.add_all([case, article, extraction])
        session.commit()

        linked = find_linked_case(session, article, extraction)

        assert linked is not None
        assert linked.id == case.id
