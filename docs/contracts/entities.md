# Entity Contracts

All contracts below use `phase0-v1`.

## Municipality

| Field | Type | Visibility | Notes |
| --- | --- | --- | --- |
| `id` | `string` | public | Stable slug, for example `rincon`. |
| `name` | `string` | public | Display name. |
| `region` | `string` | public | Coarse region label used for filtering or analytics. |
| `coastal` | `boolean` | public | Should be `true` for municipalities represented on the coastal map. |
| `centroid` | `object` | public | `{ "lat": number, "lng": number }`. |
| `geojson_key` | `string` | public | Key used to join municipality data to GeoJSON features. |

## Case

| Field | Type | Visibility | Notes |
| --- | --- | --- | --- |
| `id` | `string` | public | Stable case ID. |
| `slug` | `string` | public | URL-safe identifier for frontend routes. |
| `title` | `string` | public | Neutral, source-backed title. |
| `municipality_id` | `string` | public | References `municipality.id`. |
| `status` | `enum` | public | One of `reported`, `monitoring`, `active`, `resolved`, `archived`. |
| `publication_status` | `enum` | admin-only | One of `draft`, `pending_review`, `approved`, `rejected`, `archived`. This is the public eligibility gate. |
| `review_state` | `enum` | admin-only | One of `draft`, `pending_review`, `needs_edit`, `approved`, `rejected`, `archived`. |
| `category` | `enum` | public | One of `access_restriction`, `development`, `environmental_concern`, `policy_or_permitting`. |
| `tags` | `string[]` | public | Short browsing labels. |
| `public_summary` | `string` | public | Public-safe summary shown in the UI. |
| `internal_summary` | `string` | admin-only | Reviewer or operator notes that should not be exposed publicly. |
| `location` | `object` | public | `{ "lat": number, "lng": number, "precision": "municipality" \| "approximate" \| "exact" }`. Avoid `exact` unless source-backed and safe. |
| `first_reported_at` | `string` | public | ISO 8601 UTC. |
| `last_updated_at` | `string` | public | ISO 8601 UTC. |
| `source_article_ids` | `string[]` | admin-only | Linked internal article IDs. Public APIs should expand approved source metadata instead of exposing internals blindly. |
| `review_reason_codes` | `string[]` | admin-only | Why review was required or reopened. |
| `confidence_score` | `number` | admin-only | `0.0` to `1.0`, used to prioritize review. |

## Article

| Field | Type | Visibility | Notes |
| --- | --- | --- | --- |
| `id` | `string` | public | Stable internal ID; may also be used in public source lists. |
| `url` | `string` | public | Canonical source URL. |
| `publisher` | `string` | public | Source publisher name. |
| `title` | `string` | public | Article title. |
| `published_at` | `string` | public | ISO 8601 UTC when available. |
| `accessed_at` | `string` | admin-only | When the worker fetched the article. |
| `language` | `string` | admin-only | Language code used for downstream handling. |
| `fetch_status` | `enum` | admin-only | One of `queued`, `fetched`, `cleaned`, `failed`. |
| `content_hash` | `string` | admin-only | Used for deduplication. |
| `cleaned_text` | `string` | admin-only | Worker-cleaned article text. |
| `linked_case_ids` | `string[]` | admin-only | Candidate or approved linked case IDs. |
| `created_at` | `string` | admin-only | ISO 8601 UTC. |

## ArticleExtraction

| Field | Type | Visibility | Notes |
| --- | --- | --- | --- |
| `id` | `string` | admin-only | Stable extraction ID. |
| `article_id` | `string` | admin-only | References `article.id`. |
| `schema_version` | `string` | admin-only | Contract version used during extraction. |
| `relevance` | `enum` | admin-only | One of `relevant`, `irrelevant`, `unclear`. |
| `confidence_score` | `number` | admin-only | `0.0` to `1.0`. |
| `extracted_case_title` | `string` | admin-only | Candidate case title from model output. |
| `extracted_summary` | `string` | admin-only | Candidate structured summary. |
| `category` | `enum` | admin-only | Same enum family as `case.category`. |
| `municipality_ids` | `string[]` | admin-only | Candidate municipality matches. |
| `claims` | `object[]` | admin-only | Each claim includes `text`, `evidence_snippet`, and `sensitive`. |
| `sensitive_flags` | `string[]` | admin-only | For example `legal_claim`, `named_individual`, `unclear_location`. |
| `needs_review` | `boolean` | admin-only | Fast gate for queue creation. |
| `model_name` | `string` | admin-only | Extraction model identifier. |
| `created_at` | `string` | admin-only | ISO 8601 UTC. |

## ReviewItem

| Field | Type | Visibility | Notes |
| --- | --- | --- | --- |
| `id` | `string` | admin-only | Stable review queue ID. |
| `entity_type` | `enum` | admin-only | One of `case`, `article`, `article_extraction`. |
| `entity_id` | `string` | admin-only | References the queued record. |
| `status` | `enum` | admin-only | One of `pending_review`, `needs_edit`, `approved`, `rejected`, `archived`. |
| `reason_codes` | `string[]` | admin-only | Why the item was queued. |
| `editable_fields` | `string[]` | admin-only | Fields the reviewer is allowed to adjust. |
| `assigned_to` | `string \| null` | admin-only | Reviewer identifier if assigned. |
| `decision_notes` | `string \| null` | admin-only | Human review notes. |
| `audit_events` | `object[]` | admin-only | Ordered list of review actions. Each event includes `action`, `actor_id`, `at`, and `note`. |
| `created_at` | `string` | admin-only | ISO 8601 UTC. |
| `updated_at` | `string` | admin-only | ISO 8601 UTC. |

## Derived Public Shapes

Public endpoints should derive smaller shapes from the canonical entities rather than serializing raw records directly.

- Public map responses derive from `municipality` plus approved case counts.
- Public case list responses derive from approved `case` records only.
- Public case detail responses derive from approved `case` records plus selected source metadata from linked `article` records.
