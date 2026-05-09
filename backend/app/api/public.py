from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, Query

from app.db.session import get_db
from app.models import Article, Case, Municipality
from app.schemas import PublicCaseSummary, PublicNewsItem, PublicSource, success_payload


router = APIRouter(tags=["public"])


def case_municipality_ids(current_case: Case) -> list[str]:
    municipality_ids = list(current_case.municipality_ids or [])
    if not municipality_ids and current_case.municipality_id:
        municipality_ids = [current_case.municipality_id]
    return municipality_ids


def serialize_case(current_case: Case) -> dict:
    return PublicCaseSummary(
        id=current_case.id,
        slug=current_case.slug,
        title=current_case.title,
        municipality_id=current_case.municipality_id,
        municipality_ids=case_municipality_ids(current_case),
        status=current_case.status,
        category=current_case.category,
        tags=current_case.tags,
        public_summary=current_case.public_summary,
        location={
            "lat": current_case.location_lat,
            "lng": current_case.location_lng,
            "precision": current_case.location_precision,
        },
        first_reported_at=current_case.first_reported_at,
        last_updated_at=current_case.last_updated_at,
    ).model_dump(mode="json")


def serialize_news_item(article: Article, municipality_names_by_id: dict[str, str]) -> dict:
    approved_cases = sorted(
        [linked_case for linked_case in article.cases if linked_case.publication_status == "approved"],
        key=lambda linked_case: linked_case.last_updated_at,
        reverse=True,
    )
    excerpt = (article.cleaned_text or "").strip().replace("\n", " ")
    excerpt = " ".join(excerpt.split())[:280]

    municipality_ids: list[str] = []
    municipality_names: list[str] = []
    linked_case_ids: list[str] = []
    linked_case_slugs: list[str] = []
    linked_case_titles: list[str] = []
    category: str | None = None

    for linked_case in approved_cases:
        linked_case_ids.append(linked_case.id)
        linked_case_slugs.append(linked_case.slug)
        linked_case_titles.append(linked_case.title)
        for municipality_id in case_municipality_ids(linked_case):
            if municipality_id not in municipality_ids:
                municipality_ids.append(municipality_id)
                municipality_names.append(
                    municipality_names_by_id.get(
                        municipality_id,
                        linked_case.municipality.name
                        if linked_case.municipality and municipality_id == linked_case.municipality_id
                        else municipality_id,
                    )
                )
        if category is None:
            category = linked_case.category

    return PublicNewsItem(
        id=article.id,
        url=article.url,
        publisher=article.publisher,
        title=article.title,
        published_at=article.published_at,
        excerpt=excerpt or article.title,
        municipality_ids=municipality_ids,
        municipality_names=municipality_names,
        linked_case_ids=linked_case_ids,
        linked_case_slugs=linked_case_slugs,
        linked_case_titles=linked_case_titles,
        category=category,
    ).model_dump(mode="json")


@router.get("/map")
def get_map(db: Session = Depends(get_db)) -> dict:
    municipalities = db.scalars(select(Municipality).order_by(Municipality.name.asc())).all()
    approved_cases = db.scalars(select(Case).where(Case.publication_status == "approved")).all()
    case_counts: dict[str, dict[str, int]] = {}
    for current_case in approved_cases:
        for municipality_id in case_municipality_ids(current_case):
            counts = case_counts.setdefault(municipality_id, {"total": 0, "active": 0})
            counts["total"] += 1
            if current_case.status == "active":
                counts["active"] += 1

    items = []
    for municipality in municipalities:
        counts = case_counts.get(municipality.id, {"total": 0, "active": 0})
        total_cases = counts["total"]
        active_cases = counts["active"]
        highlight_status = "active" if active_cases > 0 else "monitoring" if total_cases > 0 else "none"
        items.append(
            {
                "id": municipality.id,
                "name": municipality.name,
                "geojson_key": municipality.geojson_key,
                "centroid": {"lat": municipality.centroid_lat, "lng": municipality.centroid_lng},
                "case_counts": {"total": total_cases, "active": active_cases},
                "highlight_status": highlight_status,
            }
        )

    return success_payload({"municipalities": items})


@router.get("/cases")
def list_cases(
    municipality_id: str | None = None,
    status: str | None = None,
    category: str | None = None,
    q: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict:
    query = select(Case).where(Case.publication_status == "approved").order_by(Case.last_updated_at.desc(), Case.title.asc())
    cases = db.scalars(query).all()

    def matches(current_case: Case) -> bool:
        if municipality_id and municipality_id not in case_municipality_ids(current_case):
            return False
        if status and current_case.status != status:
            return False
        if category and current_case.category != category:
            return False
        if q:
            haystack = " ".join(
                [
                    current_case.title,
                    current_case.public_summary,
                    current_case.category,
                    *current_case.tags,
                ]
            ).lower()
            if q.strip().lower() not in haystack:
                return False
        return True

    filtered_cases = [current_case for current_case in cases if matches(current_case)]
    total_items = len(filtered_cases)
    items = [serialize_case(current_case) for current_case in filtered_cases[(page - 1) * page_size : page * page_size]]
    total_pages = max(1, (total_items + page_size - 1) // page_size)

    return success_payload(
        {
            "items": items,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_items": total_items,
                "total_pages": total_pages,
            },
        }
    )


@router.get("/cases/{case_id}")
def get_case(case_id: str, db: Session = Depends(get_db)) -> dict:
    query = (
        select(Case)
        .options(selectinload(Case.articles))
        .where(
            or_(Case.id == case_id, Case.slug == case_id),
            Case.publication_status == "approved",
        )
    )
    current_case = db.scalar(query)

    if current_case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    sources = [
        PublicSource(
            id=article.id,
            url=article.url,
            publisher=article.publisher,
            title=article.title,
            published_at=article.published_at,
        ).model_dump(mode="json")
        for article in sorted(current_case.articles, key=lambda article: article.published_at)
    ]

    return success_payload({"case": serialize_case(current_case), "sources": sources})


@router.get("/news")
def list_news(
    municipality_id: str | None = None,
    limit: int = Query(default=12, ge=1, le=50),
    db: Session = Depends(get_db),
) -> dict:
    articles = db.scalars(
        select(Article)
        .options(selectinload(Article.cases).selectinload(Case.municipality))
        .where(
            or_(
                Article.publication_status == "approved",
                Article.cases.any(Case.publication_status == "approved"),
            )
        )
        .order_by(Article.published_at.desc(), Article.created_at.desc())
    ).all()
    filtered_articles = []
    municipality_names_by_id = {
        municipality.id: municipality.name
        for municipality in db.scalars(select(Municipality)).all()
    }
    for article in articles:
        if municipality_id and not any(
            municipality_id in case_municipality_ids(linked_case)
            for linked_case in article.cases
            if linked_case.publication_status == "approved"
        ):
            continue
        filtered_articles.append(article)

    items = [serialize_news_item(article, municipality_names_by_id) for article in filtered_articles[:limit]]

    return success_payload({"items": items})
