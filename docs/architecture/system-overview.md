# System Overview

Coastal Watch is a civic intelligence platform that monitors coastal access and development in Puerto Rico.

## What this system does

The platform collects information from public sources, extracts structured data using AI, and routes uncertain or sensitive information through a human review process before publishing it to users.

---

## System Flow

```mermaid
sequenceDiagram
    autonumber

    actor User
    participant Frontend
    participant API
    participant DB
    participant Worker
    participant Search
    participant AI
    participant Admin

    User->>Frontend: Open app
    Frontend->>API: Request map/case data
    API->>DB: Read approved data
    DB-->>API: Return data
    API-->>Frontend: Response

    Worker->>Search: Find new articles
    Search-->>Worker: Return articles
    Worker->>AI: Extract structured data
    AI-->>Worker: Extraction result
    Worker->>DB: Save/update cases

    Admin->>API: Review pending items
    API->>DB: Read/write review data
    DB-->>API: Updated records
```

---

## How the system works

1. User opens the app and requests map data
2. Frontend calls the API
3. API returns only approved cases from the database
4. Worker runs every 24 hours to ingest new data
5. Articles are fetched and cleaned
6. AI extracts structured data
7. Data is validated and stored
8. Uncertain data goes to the review queue
9. Admin reviews and approves or rejects items
10. Approved data becomes public

---

## Key Principles

- Source-backed data only
- Human review before publication
- Strict separation of public vs internal data
- Full auditability