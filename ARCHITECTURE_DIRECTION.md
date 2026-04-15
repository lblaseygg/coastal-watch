# Architecture Direction

## Frontend responsibilities
- Render Puerto Rico municipality map
- Show case cards and case detail pages
- Handle filters and search
- Show approved/public data only
- Provide admin review UI

## Backend responsibilities
- Serve public API endpoints
- Serve admin/review endpoints
- Read/write PostgreSQL data
- Manage case linking and review logic

## Worker responsibilities
- Search for new articles every 24 hours
- Fetch and clean article text
- Send article text to AI
- Validate structured output
- Store article and extraction results
- Route unclear/sensitive items to review

# Architecture Direction

This document defines the high-level system responsibilities and boundaries across the three core components of the Coastal Watch platform.

The system is intentionally split into:
- Frontend (presentation + interaction)
- Backend (API + domain logic)
- Worker (data ingestion + AI extraction pipeline)

---

## System Overview

Coastal Watch is a civic intelligence platform that:
- Ingests public information (news, reports)
- Extracts structured coastal-related cases using AI
- Routes uncertain or sensitive data through human review
- Publishes verified cases on an interactive Puerto Rico map

Key principles:
- Source-backed data only
- Human-in-the-loop verification
- Clear separation between public and internal data
- Auditability of all decisions

---

## Frontend Responsibilities

The frontend is a Next.js application focused on user experience and data visualization.

### Core responsibilities
- Render Puerto Rico municipality map (Leaflet)
- Display case markers and municipality-level aggregation
- Show case list and detailed case pages
- Handle filtering (category, status, region, tags)
- Implement search and navigation

### Data constraints
- ONLY consume approved/public data
- NEVER expose internal fields (review state, confidence, internal summaries)

### Admin capabilities
- Provide review UI for moderators
- Allow editing of permitted fields
- Trigger approve / reject / needs_edit actions

---

## Backend Responsibilities

The backend is a FastAPI service that acts as the system’s source of truth.

### Core responsibilities
- Serve public API endpoints
- Serve admin/review endpoints (authenticated)
- Enforce visibility rules (public vs admin-only)
- Manage domain entities (Case, Article, Extraction, ReviewItem)

### Domain logic
- Case lifecycle management (reported → monitoring → active → resolved → archived)
- Publication gating (draft → pending_review → approved → rejected)
- Linking articles to cases
- Aggregating municipality-level data for map responses

### Data layer
- PostgreSQL as primary database
- SQLAlchemy for ORM
- Alembic for migrations

### API design principles
- Never expose raw database entities directly
- Use derived public shapes for responses
- Ensure idempotent writes where applicable

---

## Worker Responsibilities

The worker is a scheduled ingestion and AI processing pipeline.

### Execution model
- Runs every 24 hours (EventBridge / scheduler)
- Stateless execution per run

### Pipeline steps
1. Search for new articles (Perplexity API or similar)
2. Fetch article content
3. Clean and normalize text (trafilatura / BeautifulSoup)
4. Send content to AI model for extraction
5. Validate structured output against schema
6. Store Article and ArticleExtraction records

### Extraction outputs
- Relevance classification
- Structured summary
- Municipality detection
- Category classification
- Claims with evidence snippets
- Sensitivity flags

### Review routing
Items are sent to review when:
- Confidence is low
- Sensitive claims are detected
- Location precision is unclear
- Model output is inconsistent

### Guarantees
- Deduplication using content_hash
- Idempotent processing of articles
- No automatic public publication

---

## Review System (Critical Layer)

The review system ensures data integrity and prevents misinformation.

### Responsibilities
- Queue items requiring human validation
- Track decisions and audit events
- Restrict editable fields
- Maintain reviewer accountability

### Workflow
- pending_review → needs_edit → approved / rejected

### Auditability
- Every action is recorded with:
  - actor_id
  - timestamp
  - decision notes

---

## Data Visibility Model

The system enforces strict separation:

| Layer | Access |
|------|--------|
| Public API | Approved cases only |
| Admin API | Full dataset |
| Worker | Internal only |

Sensitive/internal fields include:
- internal_summary
- confidence_score
- review_reason_codes
- extraction raw outputs

---

## Key Architectural Decisions

- AI is assistive, not authoritative
- Human review is mandatory before publication
- Public API is a filtered projection, not the source of truth
- System is designed for transparency and civic trust

---

## Future Considerations

- Entity normalization (people, companies, agencies)
- Case timeline/history tracking
- Multi-article case merging
- Notifications for new cases
- Public submissions pipeline
- Advanced deduplication and clustering