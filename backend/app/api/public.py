from __future__ import annotations

from sqlalchemy import String, case as sql_case, cast, func, or_, select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, Query

from app.db.session import get_db
from app.models import Case, Municipality
from app.schemas import PublicCaseSummary, PublicSource, success_payload


router = APIRouter(tags=["public"])


def serialize_case(current_case: Case) -> dict:
    return PublicCaseSummary(
        id=current_case.id,
        slug=current_case.slug,
        title=current_case.title,
        municipality_id=current_case.municipality_id,
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


@router.get("/map")
def get_map(db: Session = Depends(get_db)) -> dict:
    query = (
        select(
            Municipality.id,
            Municipality.name,
            Municipality.geojson_key,
            Municipality.centroid_lat,
            Municipality.centroid_lng,
            func.count(Case.id).label("total_cases"),
            func.coalesce(
                func.sum(sql_case((Case.status == "active", 1), else_=0)),
                0,
            ).label("active_cases"),
        )
        .outerjoin(
            Case,
            (Case.municipality_id == Municipality.id) & (Case.publication_status == "approved"),
        )
        .group_by(
            Municipality.id,
            Municipality.name,
            Municipality.geojson_key,
            Municipality.centroid_lat,
            Municipality.centroid_lng,
        )
        .order_by(Municipality.name.asc())
    )

    municipalities = []
    for row in db.execute(query):
        total_cases = int(row.total_cases or 0)
        active_cases = int(row.active_cases or 0)
        highlight_status = "active" if active_cases > 0 else "monitoring" if total_cases > 0 else "none"
        municipalities.append(
            {
                "id": row.id,
                "name": row.name,
                "geojson_key": row.geojson_key,
                "centroid": {"lat": row.centroid_lat, "lng": row.centroid_lng},
                "case_counts": {"total": total_cases, "active": active_cases},
                "highlight_status": highlight_status,
            }
        )

    return success_payload({"municipalities": municipalities})


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
    filters = [Case.publication_status == "approved"]

    if municipality_id:
        filters.append(Case.municipality_id == municipality_id)

    if status:
        filters.append(Case.status == status)

    if category:
        filters.append(Case.category == category)

    if q:
        pattern = f"%{q.strip()}%"
        filters.append(
            or_(
                Case.title.ilike(pattern),
                Case.public_summary.ilike(pattern),
                Case.category.ilike(pattern),
                cast(Case.tags, String).ilike(pattern),
            )
        )

    total_items = db.scalar(select(func.count()).select_from(Case).where(*filters)) or 0

    query = (
        select(Case)
        .where(*filters)
        .order_by(Case.last_updated_at.desc(), Case.title.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [serialize_case(current_case) for current_case in db.scalars(query).all()]
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
        .where(Case.id == case_id, Case.publication_status == "approved")
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
