# API Contract Notes

This file documents the initial response shapes the backend should implement.

## Common Envelope

Successful responses:

```json
{
  "data": {},
  "meta": {
    "schema_version": "phase0-v1",
    "request_id": "req_123",
    "generated_at": "2026-04-14T20:00:00Z"
  },
  "error": null
}
```

Failed responses:

```json
{
  "data": null,
  "meta": {
    "schema_version": "phase0-v1",
    "request_id": "req_123",
    "generated_at": "2026-04-14T20:00:00Z"
  },
  "error": {
    "code": "not_found",
    "message": "Case not found",
    "details": {
      "case_id": "case_missing"
    }
  }
}
```

## Public Endpoints

### GET /api/map

Purpose: return municipality-level map data using approved/public cases only.

```json
{
  "data": {
    "municipalities": [
      {
        "id": "rincon",
        "name": "Rincon",
        "geojson_key": "rincon",
        "centroid": {
          "lat": 18.3408,
          "lng": -67.2499
        },
        "case_counts": {
          "total": 1,
          "active": 1
        },
        "highlight_status": "active"
      }
    ]
  },
  "meta": {},
  "error": null
}
```

### GET /api/cases

Purpose: list approved/public cases for cards and search results.

Suggested query params:

- `municipality_id`
- `status`
- `category`
- `q`
- `page`
- `page_size`

```json
{
  "data": {
    "items": [
      {
        "id": "case_rincon_access_path",
        "slug": "rincon-access-path",
        "title": "Sample: Rincon access path concern",
        "municipality_id": "rincon",
        "status": "active",
        "category": "access_restriction",
        "tags": [
          "beach-access",
          "community-report"
        ],
        "public_summary": "Residents reported intermittent obstruction near a coastal access path. The platform tracks source-backed updates and agency responses.",
        "location": {
          "lat": 18.3414,
          "lng": -67.2491,
          "precision": "approximate"
        },
        "first_reported_at": "2026-03-02T00:00:00Z",
        "last_updated_at": "2026-04-10T15:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total_items": 1,
      "total_pages": 1
    }
  },
  "meta": {},
  "error": null
}
```

### GET /api/cases/{id}

Purpose: return one approved/public case plus public source metadata.

```json
{
  "data": {
    "case": {
      "id": "case_rincon_access_path",
      "slug": "rincon-access-path",
      "title": "Sample: Rincon access path concern",
      "municipality_id": "rincon",
      "status": "active",
      "category": "access_restriction",
      "tags": [
        "beach-access",
        "community-report"
      ],
      "public_summary": "Residents reported intermittent obstruction near a coastal access path. The platform tracks source-backed updates and agency responses.",
      "location": {
        "lat": 18.3414,
        "lng": -67.2491,
        "precision": "approximate"
      },
      "first_reported_at": "2026-03-02T00:00:00Z",
      "last_updated_at": "2026-04-10T15:30:00Z"
    },
    "sources": [
      {
        "id": "art_001",
        "url": "https://example.org/news/rincon-access-path",
        "publisher": "Example Coastal News",
        "title": "Sample: Community raises concern about access path near the coast",
        "published_at": "2026-03-02T12:00:00Z"
      }
    ]
  },
  "meta": {},
  "error": null
}
```

## Admin Endpoints

These are internal-only and should require authentication.

### GET /api/admin/review-items

Returns queued review items plus the minimal linked entity summary needed to review them.

### POST /api/admin/review-items/{id}/decision

Accepts:

```json
{
  "decision": "approved",
  "decision_notes": "Summary adjusted for neutrality.",
  "field_overrides": {
    "public_summary": "Revised summary"
  }
}
```

## Error Codes

Recommended initial set:

- `bad_request`
- `unauthorized`
- `forbidden`
- `not_found`
- `conflict`
- `validation_error`
- `rate_limited`
- `internal_error`
