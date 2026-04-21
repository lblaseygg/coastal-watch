# Puerto Rico Coastal Watch

Puerto Rico Coastal Watch is a civic intelligence platform for tracking coastal access, development, and related public-interest issues across Puerto Rico.

The current repo includes:
- a public frontend in Next.js
- a backend API in FastAPI
- a PostgreSQL-backed Docker stack for local development
- a worker that discovers, extracts, and routes public reporting into the system
- full municipality seed data for Puerto Rico

## Quick Start

The fastest way to run the project is with Docker.

### Start everything with Docker

From the repo root:

```bash
docker compose up --build
```

This starts:
- frontend on `http://localhost:3000`
- API on `http://localhost:8000`
- PostgreSQL on `localhost:5432`

Useful URLs:
- frontend: `http://localhost:3000`
- API health: `http://localhost:8000/health`

Run in the background:

```bash
docker compose up --build -d
```

Stop the stack:

```bash
docker compose down
```

Rebuild after changes:

```bash
docker compose up --build -d
```

## Local Development Without Docker

You can also run the frontend and backend separately.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend dev server:
- `http://localhost:3000`

Useful frontend commands:

```bash
npm run typecheck
npm run build
```

### Backend

Create and activate a virtual environment, then install dependencies:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run migrations:

```bash
alembic upgrade head
```

Seed the local database:

```bash
python -m app.seed
```

Start the API:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend URL:
- `http://localhost:8000`

Health check:
- `http://localhost:8000/health`

### Worker

The worker uses Tavily for discovery and page extraction, then applies Coastal Watch's
local extraction and routing rules.

Run the worker against the Docker Postgres database:

```bash
cd /Users/blasey/Developer/coastal-watch
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/coastal_watch PYTHONPATH=worker:backend backend/.venv/bin/python -m worker.cli run-once --max-results 8 --limit 20
```

Useful worker commands:

```bash
# discovery only
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/coastal_watch PYTHONPATH=worker:backend backend/.venv/bin/python -m worker.cli discover --max-results 8

# rebuild extracted/routed state from already-cleaned articles
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/coastal_watch PYTHONPATH=worker:backend backend/.venv/bin/python -m worker.cli reprocess --limit 500
```

### Frontend talking to local backend

If you run both services locally outside Docker, start the frontend with:

```bash
cd frontend
API_BASE_URL=http://localhost:8000 npm run dev
```

## Current Architecture

### Frontend
- Next.js App Router
- TypeScript
- Tailwind CSS
- MapSVG municipality SVG map

### Backend
- FastAPI
- SQLAlchemy
- Alembic
- Pydantic

### Worker
- Tavily Search for discovery
- Tavily Extract for article content
- heuristic classification and summarization
- rule-based routing for auto-publish vs review

### Database
- PostgreSQL in Docker
- local SQLite/Alembic-friendly setup also exists for backend workflows

## How It Works

### Public app
1. The frontend loads municipalities and approved cases from the API
2. Users browse the Puerto Rico map
3. Clicking a municipality opens its related cases
4. `/news` and municipality hover cards show public reporting linked to municipalities
5. Case detail pages show summaries and linked sources

### Backend
The API currently exposes public endpoints for:
- map municipality data
- case list data
- case detail data
- public news feed
- health checks

### Automation flow
1. Tavily Search discovers candidate public reporting
2. Tavily Extract retrieves article content
3. The worker classifies municipality, category, and summary
4. Trusted, high-confidence items auto-publish
5. Ambiguous or sensitive items go to admin review
6. The API exposes only public/approved records to the map and news feed

### Seed data
The repo includes seed files for:
- all Puerto Rico municipalities
- empty runtime seed datasets for cases, articles, extractions, and review items

These are loaded by:

```bash
python -m app.seed
```

## Project Status

Implemented:
- public frontend
- SVG municipality map
- municipality case drawer
- case detail pages
- public news page and municipality hover news
- public backend API
- database models and migrations
- Docker local stack
- admin review and auth
- automated discovery/extraction/routing worker
- trusted-source auto-publish pipeline

Still to do:
- tests and observability
- AWS deployment
- model-based extraction beyond the current heuristic worker

## Repo Structure

```text
coastal-watch/
├── docs/
├── frontend/
├── backend/
├── worker/
├── docker-compose.yml
└── README.md
```

## Notes

- The frontend currently uses a clean SVG map instead of Leaflet for the main public UI.
- The backend container automatically runs migrations and seeds data on startup through `backend/docker-entrypoint.sh`.
- The worker currently uses rule-based extraction and summarization; it is automated, but not yet model-based.
- Local docs and planning files may exist in the repo but are not required to start the environment.

## License

MIT License
