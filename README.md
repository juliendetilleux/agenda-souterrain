# Agenda Souterrain

Collaborative calendar application inspired by [Teamup](https://teamup.com) — Backend Python (FastAPI) + Frontend React (TypeScript).

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (must be running)
- [Node.js](https://nodejs.org/) v22+

### Setup

```bash
# Clone the repo
git clone https://github.com/juliendetilleux/agenda-souterrain.git
cd agenda-souterrain

# Switch to the development branch
git checkout develop

# Create your local environment file
cp .env.example .env
# Edit .env if needed (defaults work for local dev)

# Start backend + database + LibreTranslate
docker-compose up --build

# In a separate terminal — start frontend
cd frontend
npm install
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.12, FastAPI, SQLAlchemy (async), Alembic |
| Database | PostgreSQL 15 |
| Auth | JWT (python-jose), bcrypt |
| Frontend | React 18, TypeScript, Vite |
| Calendar UI | FullCalendar.io v6 |
| State | Zustand + TanStack Query |
| Styling | Tailwind CSS |
| i18n | i18next (FR, EN, NL, DE) |

## Features

- 5 calendar views (Month, Week, Day, Agenda, Year)
- Colored sub-calendars with filtering
- Event CRUD with drag-and-drop
- Recurrence (daily, weekly, monthly, yearly)
- 7-level permission system with sharing
- Shareable links (no account required)
- Email invitations
- iCal export (.ics) per event
- Event sign-ups
- Full-text search
- File attachments & comments
- Auto-translation (FR/EN/NL/DE)
- PWA support (mobile install)

## Git Workflow

We use **Git Flow** with two main branches:

| Branch | Purpose |
|--------|---------|
| `master` | Production — auto-deploys backend (Render) + frontend (Cloudflare Pages) |
| `develop` | Integration branch for the next release |
| `feature/*` | New features, branched from `develop` |
| `hotfix/*` | Urgent production fixes, branched from `master` |

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

## Running Tests

```bash
# Frontend unit tests
cd frontend && npx vitest run

# Backend unit tests (requires Docker running)
docker-compose exec backend python -m pytest tests/ -v
```

## Deployment

- **Backend**: Auto-deploys on push to `master` via Render
- **Frontend**: Auto-deploys on push to `master` via GitHub Actions + Cloudflare Pages

See [docs/deployment.md](docs/deployment.md) for full production setup and environment variables.

## License

Private project.
