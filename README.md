# Puerto Rico Coastal Watch

Puerto Rico Coastal Watch is a civic intelligence platform for tracking blocked beach access, development in protected coastal lands, and related public-interest issues across Puerto Rico.

The repo currently includes:
- a public frontend in Next.js
- a backend API in FastAPI
- a PostgreSQL-backed Docker stack for local development
- an admin workflow for manual case creation, review, editing, and publication
- a worker that discovers, extracts, and routes public reporting into the system
- full municipality seed data for Puerto Rico

## Quick Start

The fastest way to run the project is with Docker.

### 1. Create local env values

From the repo root:

```bash
cp .env.example .env.docker
```

Set at least:
- `POSTGRES_PASSWORD`
- `ADMIN_API_TOKEN`

Optional but recommended:
- `ADMIN_SESSION_SECRET`
- `OPENAI_API_KEY`

`POSTGRES_PASSWORD` and `ADMIN_API_TOKEN` can be any long random values. They do not need to match anyone's personal password; they only need to be consistent within the environment where the app runs.

### 2. Start the local stack

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

### 3. Optional: run the worker locally

The worker is not part of the default Docker stack. It is available behind the `worker` profile:

```bash
docker compose --env-file .env.docker --profile worker up --build worker
```

This is useful for local ingestion testing when `OPENAI_API_KEY` is set.

## Local Development Without Docker

You can also run the frontend and backend separately.

### Frontend

```bash
cd frontend
npm install
API_BASE_URL=http://localhost:8000 npm run dev
```

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

Set a local database URL and admin token in your shell or a local `.env`, then run:

```bash
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Useful backend URL:
- `http://localhost:8000`

### Worker

The worker uses OpenAI web search plus structured extraction, with a local fallback classifier if the model call fails.

Run the worker against the local Docker Postgres database:

```bash
cd /Users/blasey/Developer/coastal-watch
DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/coastal_watch PYTHONPATH=worker:backend backend/.venv/bin/python -m worker.cli run-once --max-results 8 --limit 20
```

Useful worker commands:

```bash
DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/coastal_watch PYTHONPATH=worker:backend backend/.venv/bin/python -m worker.cli discover --max-results 8
DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/coastal_watch PYTHONPATH=worker:backend backend/.venv/bin/python -m worker.cli reprocess --limit 500
```

Replace `YOUR_PASSWORD` with the same value used for `POSTGRES_PASSWORD` in your local environment.

## Admin Access

Admin access now uses a signed frontend session cookie instead of storing the raw backend admin bearer token in the browser.

Current behavior:
- public users do not see the `Admin` nav item
- `/admin` prompts for sign-in when no valid admin session exists
- the frontend verifies the submitted admin token server-side
- the browser receives a signed admin session cookie
- the frontend server uses its own `ADMIN_API_TOKEN` env var to call backend admin endpoints

If you set `ADMIN_SESSION_SECRET`, it is used to sign the admin session cookie explicitly. If you omit it locally, the app falls back to `ADMIN_API_TOKEN`, but a separate `ADMIN_SESSION_SECRET` is recommended.

Admin mutations are protected with:
- signed CSRF tokens
- same-origin `Origin` / `Referer` checks

## Manual Operations Mode

The project can currently run in a production-friendly manual mode without the worker.

That means:
- frontend, API, and database are live
- admin users can create, edit, review, and publish content manually
- worker scheduling can stay disabled until external API credits or automation needs return

This is the current recommended deployment mode.

## Current Architecture

### Frontend
- Next.js App Router
- TypeScript
- Tailwind CSS
- SVG municipality map

### Backend
- FastAPI
- SQLAlchemy
- Alembic
- Pydantic

### Worker
- OpenAI web search for discovery
- direct HTTP fetch for article content cleanup
- OpenAI structured extraction with heuristic fallback
- rule-based routing for auto-publish vs review

### Database
- PostgreSQL

## How It Works

### Public app
1. The frontend loads municipalities and approved cases from the API.
2. Users browse the Puerto Rico map and related case/news views.
3. Case detail pages show summaries and linked sources.

### Backend
The API exposes public endpoints for:
- municipality data
- case list and case detail data
- public news feed
- health checks

It also exposes admin-only endpoints used by the signed-session admin workflow.

### Automation flow
1. OpenAI web search discovers candidate reporting.
2. The worker fetches and cleans article content from discovered URLs.
3. OpenAI structured extraction classifies municipality, category, and summary.
4. Trusted, high-confidence items auto-publish.
5. Ambiguous or sensitive items go to admin review.
6. The API exposes only public or approved records to the map and news feed.

### Seed data
The repo includes seed files for:
- all Puerto Rico municipalities
- empty runtime seed datasets for cases, articles, extractions, and review items

These are loaded by:

```bash
python -m app.seed
```

## AWS Deployment Direction

The current AWS target is:
- frontend on AWS Amplify
- API on ECS Fargate behind an Application Load Balancer
- PostgreSQL on Amazon RDS
- admin and app secrets in AWS-managed secret storage
- one-off database init task for migrations and municipality seed
- worker omitted initially in manual-operations mode

See:
- [AWS Architecture](/Users/blasey/Developer/coastal-watch/docs/architecture/aws.md)
- [AWS Portfolio Diagram](/Users/blasey/Developer/coastal-watch/docs/architecture/aws-portfolio-diagram.md)

Production startup split:
- local Docker API startup: `backend/docker-dev-entrypoint.sh`
- production API startup: `backend/docker-entrypoint.sh`
- one-off production DB init: `backend/docker-init.sh`

## Project Status

Implemented:
- public frontend
- SVG municipality map
- municipality case and news views
- case detail pages
- public backend API
- database models and migrations
- Docker local stack
- admin review, manual editing, and manual case workflows
- signed admin session auth
- CSRF protection for admin mutations
- heuristic discovery/extraction/routing worker
- AWS-safe split between API startup and one-off database init

Still left:
- complete the AWS deployment rollout
- validate production manual-operations mode end-to-end
- add production monitoring, alerts, and backups
- reintroduce worker scheduling when external API credits return
- extend extraction/linking beyond the current heuristic worker

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

- Cloning the repo does not clone anyone's live database contents.
- A fresh local Docker run creates a new local Postgres volume and seeds municipalities from the committed seed files.
- The frontend currently uses a clean SVG municipality map instead of Leaflet for the main public UI.
- The worker is available locally, but it is not required for the current production rollout.

## License

MIT License
