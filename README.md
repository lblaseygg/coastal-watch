# Puerto Rico Coastal Watch
**Tracking coastal access and development across Puerto Rico**

---

## Overview

Puerto Rico Coastal Watch is a civic intelligence platform that maps and tracks reported issues related to coastal access, land use, and development across Puerto Rico.

The goal of this project is to transform scattered news and reports into a structured, accessible system that helps users understand what is happening along the coast-by municipality, project, and timeline.

This includes:
- Reported restrictions to public beach access
- Coastal development projects (residential, commercial, tourism)
- Disputes related to the maritime-terrestrial zone
- Environmental and community concerns linked to coastal land use

---

## Purpose

Access to Puerto Rico's coast is a public concern, but information about development and access issues is often fragmented across news articles, social media, and public records.

This project aims to:
- Provide a **centralized, map-based view** of coastal issues
- Increase **transparency and awareness**
- Offer a **data-driven perspective** on coastal development
- Preserve **source attribution and context** for every reported case

The platform does **not make legal claims**. It aggregates and organizes publicly available information for informational purposes.

---

## How It Works

The system is composed of three main parts:

### 1. Frontend
An interactive web interface that allows users to:
- Explore municipalities across Puerto Rico
- View active or reported coastal cases
- Access summaries and source articles

### 2. Backend API
Handles:
- Case data retrieval
- Municipality data
- Admin moderation workflows

### 3. Ingestion Pipeline
A scheduled process that:
- Searches for new articles related to coastal access and development
- Extracts structured information using AI
- Stores and links data to existing or new cases
- Routes sensitive or unclear data for human review

---

## Tech Stack

### Frontend
- Next.js
- TypeScript
- Tailwind CSS
- Leaflet (map rendering)

### Backend
- FastAPI (Python)
- PostgreSQL

### Infrastructure
- AWS (Amplify, ECS Fargate, EventBridge Scheduler, RDS)

### AI Pipeline
- Search API (for article discovery)
- LLM-based extraction (structured data from articles)

---

## Disclaimer

This project aggregates information from publicly available sources such as news outlets and reports.

- All content belongs to its respective authors and publishers
- Information presented is based on available sources and may evolve over time
- The platform does not assert legal conclusions or accusations
- Users are encouraged to review original sources for full context

---

## Status

This project is currently a **work in progress (WIP)**.

Planned features include:
- Full interactive map with real-time data
- Automated ingestion and updating of new cases
- Admin review system for data validation
- Filtering, search, and timeline views

---

## Future Goals

- Improve data accuracy and validation workflows
- Expand coverage of municipalities and cases
- Provide historical timelines of coastal developments
- Enhance user experience and accessibility

---

## Contributing

This project is currently under active development. Contributions, feedback, and suggestions are welcome in the future.

---

## License

MIT License