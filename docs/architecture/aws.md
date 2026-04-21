# AWS Architecture

This document describes how Coastal Watch will be deployed in AWS and why specific services were chosen.

---

## Deployment Overview

The system uses managed AWS services to minimize operational overhead, support scalability, and simplify deployment.

---

## Architecture Diagram

```mermaid
flowchart LR
    User[Public User] --> Amplify[Amplify<br/>Next.js Frontend]
    Admin[Admin Reviewer] --> Amplify

    Amplify --> API[ECS Fargate<br/>FastAPI API]
    API --> RDS[(RDS PostgreSQL)]

    EventBridge[EventBridge Scheduler] --> Worker[ECS Fargate<br/>Ingestion Worker]

    Worker --> Search[Tavily Search API]
    Worker --> Extract[Tavily Extract API]
    Worker --> RDS
```

---

## Components

- Frontend → AWS Amplify
- API → ECS Fargate
- Worker → ECS Fargate
- Database → Amazon RDS (PostgreSQL)
- Scheduler → EventBridge
- External APIs → Tavily Search + Tavily Extract

---

## How it works

- Users access the frontend through Amplify
- The frontend communicates with the API hosted on ECS Fargate
- The API reads and writes data to RDS
- EventBridge triggers the ingestion worker every 24 hours
- The worker discovers reporting, extracts article content, and either auto-publishes trusted records or queues them for review

---

## Key Decisions

- Fargate → no server management and easy scaling
- Amplify → simple and fast frontend deployment
- RDS → reliable relational database for structured data
- EventBridge → native scheduling without managing cron servers
