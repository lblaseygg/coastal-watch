# Puerto Rico Coastal Watch

Puerto Rico Coastal Watch is a civic intelligence platform for tracking coastal access, development, and related public-interest issues across Puerto Rico.

The current repo includes:
- a public frontend in Next.js
- a backend API in FastAPI
- a PostgreSQL-backed Docker stack for local development
- seeded sample data for municipalities, cases, articles, and review items

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
- mapsvg.com 

### Backend
- FastAPI
- SQLAlchemy
- Alembic
- Pydantic

### Database
- PostgreSQL in Docker
- local SQLite/Alembic-friendly setup also exists for backend workflows

## How It Works

### Public app
1. The frontend loads municipalities and approved cases from the API
2. Users browse the Puerto Rico map
3. Clicking a municipality opens its related cases
4. Case detail pages show summaries and linked sources

### Backend
The API currently exposes public endpoints for:
- map municipality data
- case list data
- case detail data
- health checks

### Seed data
The repo includes seed files for:
- municipalities
- cases
- articles
- article extractions
- review queue items

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
- public backend API
- database models and migrations
- Docker local stack

Still to do:
- admin review and auth
- ingestion worker
- tests and observability
- AWS deployment

## Repo Structure

```text
coastal-watch/
├── frontend/
├── backend/
├── docker-compose.yml
└── README.md
```

## Notes

- The frontend currently uses a clean SVG map instead of Leaflet for the main public UI.
- The backend container automatically runs migrations and seeds data on startup through `backend/docker-entrypoint.sh`.
- Local docs and planning files may exist in the repo but are not required to start the environment.

## License

MIT License
