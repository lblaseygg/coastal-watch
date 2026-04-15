# Components Architecture

This document describes how the Coastal Watch system is structured across logical layers and how different parts of the system interact.

---

## What this diagram shows

The system is divided into layers that separate concerns between user interaction, application logic, domain logic, infrastructure, and external services.

---

## Components Diagram

```mermaid
flowchart TB
    actor1[Public User]
    actor2[Admin Reviewer]

    subgraph Client["Client Layer"]
        FE[Next.js Frontend]
    end

    subgraph App["Application Layer"]
        API[FastAPI API]
        Worker[Ingestion Worker]
        Scheduler[EventBridge Scheduler]
    end

    subgraph Domain["Domain Layer"]
        Cases[Case Management]
        Reviews[Review Queue]
        Sources[Source Registry]
        Extraction[Extraction Pipeline]
        Linking[Case Linking]
        Validation[Validation & Deduplication]
    end

    subgraph Data["Infrastructure Layer"]
        PG[(PostgreSQL)]
        Redis[(Redis Cache/Queue)]
    end

    subgraph External["External Services"]
        Search[Perplexity Search API]
        AI[LLM Service]
    end

    actor1 --> FE
    actor2 --> FE

    FE --> API

    API --> Cases
    API --> Reviews
    API --> Sources

    Cases --> PG
    Reviews --> PG
    Sources --> PG
    API --> Redis

    Scheduler --> Worker
    Worker --> Extraction
    Worker --> Validation
    Worker --> Linking

    Extraction --> Search
    Extraction --> AI
    Validation --> PG
    Linking --> PG
    Worker --> Redis
```

---

## Architecture Layers

### Client Layer
- Next.js Frontend
- Public User
- Admin Reviewer

Handles all user interaction including map rendering, navigation, and admin review UI.

---

### Application Layer
- FastAPI API
- Ingestion Worker
- EventBridge Scheduler

Coordinates system behavior:
- API handles requests and responses
- Worker processes ingestion and AI extraction
- Scheduler triggers background jobs

---

### Domain Layer
- Case Management
- Review Queue
- Extraction Pipeline
- Case Linking
- Validation and Deduplication
- Source Registry

Contains the core business logic:
- Defines how cases are created and updated
- Controls review workflows
- Ensures data quality and consistency

---

### Infrastructure Layer
- PostgreSQL
- Redis (future use)

Responsible for data storage and system performance:
- PostgreSQL stores all structured data
- Redis supports caching or background queues

---

### External Services
- Perplexity Search API
- LLM API for Extraction

Provides external capabilities:
- Search API finds relevant articles
- LLM extracts structured data from text

---

## Key Interactions

- Users interact only with the frontend
- Frontend communicates with the API
- API reads and writes to domain services and database
- Worker handles ingestion and AI processing separately from user requests
- External APIs are used only by the worker