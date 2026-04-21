from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.models import Article, ArticleExtraction, Case, Municipality, ReviewQueueItem
from worker.discovery import SearchResult, discover_articles
from worker.extraction import extract_articles
from worker.fetching import ExtractResult, fetch_queued_articles
from worker.routing import reset_extraction_state, route_extractions


NOW = datetime.now(timezone.utc)


def session_factory() -> sessionmaker[Session]:
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def seed_municipalities(session: Session) -> None:
    session.add_all(
        [
            Municipality(
                id="cabo-rojo",
                name="Cabo Rojo",
                region="west",
                coastal=True,
                centroid_lat=0.0,
                centroid_lng=0.0,
                geojson_key="cabo-rojo",
            ),
            Municipality(
                id="rincon",
                name="Rincón",
                region="west",
                coastal=True,
                centroid_lat=0.0,
                centroid_lng=0.0,
                geojson_key="rincon",
            ),
        ]
    )
    session.commit()


def mock_search_result() -> SearchResult:
    return SearchResult(
        url="https://www.elnuevodia.com/negocios/bienes-raices/notas/esencia-la-controversia-por-playa-virgen-en-cabo-rojo",
        title="Esencia: la controversia por playa virgen en Cabo Rojo",
        snippet="El proyecto genera controversia por acceso a la playa y por desarrollo en una zona costera sensible.",
        publisher="elnuevodia.com",
        published_at=NOW.isoformat(),
    )


def mock_extract_result() -> ExtractResult:
    return ExtractResult(
        url=mock_search_result().url,
        title=mock_search_result().title,
        raw_content=(
            "Vecinos denuncian que el proyecto Esencia en Cabo Rojo amenaza una playa virgen, "
            "podria limitar el acceso publico y representa un desarrollo costero controversial."
        ),
    )


def test_run_once_flow_discovers_fetches_extracts_and_auto_publishes(monkeypatch) -> None:
    SessionLocal = session_factory()

    monkeypatch.setattr(
        "worker.discovery.TavilySearchClient.search",
        lambda self, query, max_results=5: [mock_search_result()],
    )
    monkeypatch.setattr(
        "worker.fetching.TavilyExtractClient.extract",
        lambda self, urls: ([mock_extract_result()], set()),
    )

    with SessionLocal() as session:
        seed_municipalities(session)

        discovered = discover_articles(session, max_results=2)
        fetched = fetch_queued_articles(session, limit=10)
        extracted = extract_articles(session, limit=10)
        routed = route_extractions(session, limit=20)

        assert discovered["discovered"] == 1
        assert fetched == {"cleaned": 1, "failed": 0}
        assert extracted == {"extractions": 1}
        assert routed["auto_published"] == 1

        article = session.scalar(select(Article))
        extraction = session.scalar(select(ArticleExtraction))
        case = session.scalar(select(Case))
        review_item = session.scalar(select(ReviewQueueItem))

        assert article is not None
        assert extraction is not None
        assert case is not None
        assert review_item is not None

        assert article.fetch_status == "cleaned"
        assert extraction.relevance == "relevant"
        assert extraction.municipality_ids == ["cabo-rojo"]
        assert case.publication_status == "approved"
        assert case.municipality_id == "cabo-rojo"
        assert review_item.status == "approved"
        assert review_item.reason_codes == ["auto_published", "trusted_source"]


def test_reprocess_flow_rebuilds_state_without_duplicate_cases(monkeypatch) -> None:
    SessionLocal = session_factory()

    monkeypatch.setattr(
        "worker.discovery.TavilySearchClient.search",
        lambda self, query, max_results=5: [mock_search_result()],
    )
    monkeypatch.setattr(
        "worker.fetching.TavilyExtractClient.extract",
        lambda self, urls: ([mock_extract_result()], set()),
    )

    with SessionLocal() as session:
        seed_municipalities(session)

        discover_articles(session, max_results=2)
        fetch_queued_articles(session, limit=10)
        extract_articles(session, limit=10)
        route_extractions(session, limit=20)

        initial_case_ids = [case.id for case in session.scalars(select(Case)).all()]
        assert len(initial_case_ids) == 1

        cleared = reset_extraction_state(session)
        extracted = extract_articles(session, limit=10)
        routed = route_extractions(session, limit=20)

        cases = session.scalars(select(Case)).all()
        extractions = session.scalars(select(ArticleExtraction)).all()
        review_items = session.scalars(select(ReviewQueueItem)).all()
        articles = session.scalars(select(Article)).all()

        assert cleared["cases_cleared"] == 1
        assert extracted == {"extractions": 1}
        assert routed["auto_published"] == 1
        assert len(cases) == 1
        assert len(extractions) == 1
        assert len(review_items) == 1
        assert len(articles) == 1
        assert articles[0].linked_case_ids == [cases[0].id]
