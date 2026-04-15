from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import delete, select

from app.db.session import SessionLocal
from app.models import Article, ArticleExtraction, Case, Municipality, ReviewQueueItem, case_article_links


SEEDS_DIR = Path(__file__).resolve().parents[1] / "seeds"


def load_items(filename: str) -> list[dict]:
    with (SEEDS_DIR / filename).open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    return payload["items"]


def parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def seed_municipalities(session) -> None:
    for item in load_items("municipalities.json"):
        session.merge(
            Municipality(
                id=item["id"],
                name=item["name"],
                region=item["region"],
                coastal=item["coastal"],
                centroid_lat=item["centroid"]["lat"],
                centroid_lng=item["centroid"]["lng"],
                geojson_key=item["geojson_key"],
            )
        )


def seed_articles(session) -> None:
    for item in load_items("articles.json"):
        session.merge(
            Article(
                id=item["id"],
                url=item["url"],
                publisher=item["publisher"],
                title=item["title"],
                published_at=parse_timestamp(item["published_at"]),
                accessed_at=parse_timestamp(item["accessed_at"]),
                language=item["language"],
                fetch_status=item["fetch_status"],
                content_hash=item["content_hash"],
                cleaned_text=item["cleaned_text"],
                linked_case_ids=item["linked_case_ids"],
                created_at=parse_timestamp(item["created_at"]),
            )
        )


def seed_cases(session) -> None:
    for item in load_items("cases.json"):
        session.merge(
            Case(
                id=item["id"],
                slug=item["slug"],
                title=item["title"],
                municipality_id=item["municipality_id"],
                status=item["status"],
                publication_status=item["publication_status"],
                review_state=item["review_state"],
                category=item["category"],
                tags=item["tags"],
                public_summary=item["public_summary"],
                internal_summary=item["internal_summary"],
                location_lat=item["location"]["lat"],
                location_lng=item["location"]["lng"],
                location_precision=item["location"]["precision"],
                first_reported_at=parse_timestamp(item["first_reported_at"]),
                last_updated_at=parse_timestamp(item["last_updated_at"]),
                source_article_ids=item["source_article_ids"],
                review_reason_codes=item["review_reason_codes"],
                confidence_score=item["confidence_score"],
            )
        )


def seed_article_extractions(session) -> None:
    for item in load_items("article_extractions.json"):
        session.merge(
            ArticleExtraction(
                id=item["id"],
                article_id=item["article_id"],
                schema_version=item["schema_version"],
                relevance=item["relevance"],
                confidence_score=item["confidence_score"],
                extracted_case_title=item["extracted_case_title"],
                extracted_summary=item["extracted_summary"],
                category=item["category"],
                municipality_ids=item["municipality_ids"],
                claims=item["claims"],
                sensitive_flags=item["sensitive_flags"],
                needs_review=item["needs_review"],
                model_name=item["model_name"],
                created_at=parse_timestamp(item["created_at"]),
            )
        )


def seed_review_queue(session) -> None:
    for item in load_items("review_queue.json"):
        session.merge(
            ReviewQueueItem(
                id=item["id"],
                entity_type=item["entity_type"],
                entity_id=item["entity_id"],
                status=item["status"],
                reason_codes=item["reason_codes"],
                editable_fields=item["editable_fields"],
                assigned_to=item["assigned_to"],
                decision_notes=item["decision_notes"],
                audit_events=item["audit_events"],
                created_at=parse_timestamp(item["created_at"]),
                updated_at=parse_timestamp(item["updated_at"]),
            )
        )


def seed_case_article_links(session) -> None:
    session.execute(delete(case_article_links))
    session.flush()

    cases = session.scalars(select(Case)).all()
    for current_case in cases:
        for article_id in current_case.source_article_ids:
            session.execute(
                case_article_links.insert().values(case_id=current_case.id, article_id=article_id)
            )


def main() -> None:
    with SessionLocal() as session:
        seed_municipalities(session)
        seed_articles(session)
        seed_cases(session)
        seed_article_extractions(session)
        seed_review_queue(session)
        seed_case_article_links(session)
        session.commit()


if __name__ == "__main__":
    main()
