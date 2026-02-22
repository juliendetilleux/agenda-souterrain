# Contributing to Agenda Souterrain

## Git Workflow

We use a simplified **Git Flow**:

```
master ─────●────────────●──────────────●──── (production)
            │            ↑              ↑
develop ────●──●──●──●───●──●──●───●────●──── (integration)
               │     ↑      │     ↑
feature/xxx    ●──●──●      │     │
                        hotfix/xxx ●
```

### Starting a new feature

```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-feature

# ... work, commit ...

git push -u origin feature/my-feature
# Open a PR: feature/my-feature → develop
```

### Releasing to production

```bash
# On GitHub: create a PR from develop → master
# After review and CI passes, merge the PR
# Render auto-deploys the backend
# GitHub Actions deploys the frontend
```

### Hotfix (urgent production fix)

```bash
git checkout master
git pull origin master
git checkout -b hotfix/fix-description

# ... fix the bug, commit ...

git push -u origin hotfix/fix-description
# Open a PR: hotfix/fix-description → master
# After merge to master, also merge to develop:
git checkout develop
git merge hotfix/fix-description
git push origin develop
```

## Commit Message Convention

Use descriptive prefixes:

```
feat: add event recurrence support
fix: resolve timezone bug in date picker
docs: update deployment guide
refactor: extract permission logic to utility
test: add unit tests for calendar schemas
chore: update dependencies
```

## Local Development Setup

### Prerequisites

- Docker Desktop (must be running)
- Node.js v22+
- Git

### Quick Start

```bash
# 1. Clone and setup
git clone https://github.com/juliendetilleux/agenda-souterrain.git
cd agenda-souterrain
git checkout develop
cp .env.example .env
# Edit .env with your values (defaults work for local dev)

# 2. Start backend (Docker)
docker-compose up --build

# 3. Start frontend (separate terminal)
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Running Tests

```bash
# Frontend unit tests
cd frontend
npm test              # watch mode
npx vitest run        # single run

# Frontend e2e tests (requires running app)
npm run test:e2e

# Backend unit tests (in Docker)
docker-compose exec backend python -m pytest tests/ -v

# Backend specific test file
docker-compose exec backend python -m pytest tests/test_unit.py -v
```

## Code Style

- **Backend**: Python 3.12, PEP 8, type hints, Pydantic schemas
- **Frontend**: TypeScript strict mode, React functional components + hooks
- **CSS**: Tailwind CSS utility classes
- **i18n**: All user-facing strings in `frontend/src/i18n/locales/` (FR, EN, NL, DE)

## Project Structure

```
agenda-souterrain/
├── backend/
│   ├── app/
│   │   ├── config.py          # Environment settings (pydantic-settings)
│   │   ├── database.py        # SQLAlchemy async engine
│   │   ├── main.py            # FastAPI app entrypoint
│   │   ├── models/            # SQLAlchemy ORM models
│   │   ├── routers/           # API route handlers
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── services/          # Business logic (storage, etc.)
│   │   └── utils/             # Helpers (permissions, ical, etc.)
│   ├── alembic/               # Database migrations
│   ├── tests/                 # Backend tests (pytest)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/               # API client (Axios)
│   │   ├── components/        # React components
│   │   ├── hooks/             # Custom hooks
│   │   ├── pages/             # Page components
│   │   ├── store/             # Zustand state management
│   │   ├── i18n/              # Translations (FR, EN, NL, DE)
│   │   └── types/             # TypeScript types
│   ├── tests/                 # E2E tests (Playwright)
│   ├── public/                # Static assets (PWA icons, manifest)
│   ├── package.json
│   └── vite.config.ts
├── docs/
│   └── deployment.md          # Production env vars & deploy guide
├── scripts/
│   └── deploy-frontend.sh     # Manual frontend deploy
├── .github/workflows/
│   ├── ci.yml                 # CI checks on develop/PRs
│   └── deploy-frontend.yml    # Auto-deploy frontend on master push
├── docker-compose.yml         # Local dev stack
├── render.yaml                # Render backend config
├── .env.example               # Environment template
└── CONTRIBUTING.md            # This file
```
