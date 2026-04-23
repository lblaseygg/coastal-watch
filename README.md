# Puerto Rico Coastal Watch

Puerto Rico Coastal Watch is a civic intelligence platform for tracking coastal access, development, and related public-interest issues across Puerto Rico.

The current repo includes:
- a public frontend in Next.js
- a backend API in FastAPI
- a PostgreSQL-backed Docker stack for local development
- a worker that discovers, extracts, and routes public reporting into the system
- full municipality seed data for Puerto Rico
- manual admin workflows for creating, editing, and publishing cases when automation is paused

## Quick Start

The fastest way to run the project is with Docker.

### Start everything with Docker

From the repo root:

```bash
docker compose --env-file .env.docker up --build
```

This starts:
- frontend on `http://localhost:3000`
- API on `http://localhost:8000`
- PostgreSQL on `localhost:5432`

Useful URLs:
- frontend: `http://localhost:3000`
- API health: `http://localhost:8000/health`

Required local secrets live in `.env.docker`:
- `POSTGRES_PASSWORD`
- `ADMIN_API_TOKEN`
- optionally `ADMIN_SESSION_SECRET` if you want a session secret distinct from the admin token

Run in the background:

```bash
docker compose --env-file .env.docker up --build -d
```

Stop the stack:

```bash
docker compose --env-file .env.docker down
```

Rebuild after changes:

```bash
docker compose --env-file .env.docker up --build -d
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

If you are operating in manual mode because Tavily credits are unavailable, you can skip the worker entirely and use the admin UI to create and edit public cases directly.

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

### Admin access
- `/admin` is hidden from public navigation unless a valid admin session exists
- admin sign-in uses the shared `ADMIN_API_TOKEN`
- the browser stores a signed admin session cookie, not the raw bearer token
- admin mutations are protected with signed CSRF tokens and same-origin checks

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

## Manual Operations Mode

The app can run without the worker.

In manual mode:
- the public site still serves approved cases and linked source articles
- admins use `/admin` to review, edit, and publish records
- manual case creation can be used when Tavily credits are paused or automation is intentionally disabled

This is the current recommended deployment mode until worker scheduling and Tavily usage are re-enabled in production.

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
- admin review, signed session auth, and CSRF protection
- automated discovery/extraction/routing worker
- trusted-source auto-publish pipeline
- AWS-ready split between API startup and one-off database init tasks

Still to do:
- production deployment rollout
- model-based extraction beyond the current heuristic worker
- worker reintroduction in production when credits and scheduling are ready

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
- In local Docker, the backend service runs migrations and municipality seed data through `backend/docker-dev-entrypoint.sh`.
- In production, the API container should start with `backend/docker-entrypoint.sh` only, and migrations/seed should run as a one-off init step via `backend/docker-init.sh`.
- The worker currently uses rule-based extraction and summarization; it is automated, but not yet model-based.
- The current AWS deployment direction is: Amplify frontend, ECS Fargate API, RDS PostgreSQL, and a separate one-off init task. The worker can be omitted temporarily in manual-operations mode.
- Local docs and planning files may exist in the repo but are not required to start the environment.

## License

MIT License
