# Deployment Guide — Agenda Souterrain

## Production Architecture

```
                    ┌──────────────────┐
                    │  Cloudflare      │
                    │  Pages           │
                    │  (Frontend)      │
                    │  React SPA       │
                    └────────┬─────────┘
                             │ HTTPS /v1/*
                             ▼
                    ┌──────────────────┐
                    │  Render          │
                    │  (Backend)       │
                    │  FastAPI Docker  │
                    └────────┬─────────┘
                             │
                     ┌───────┴───────┐
                     ▼               ▼
              ┌────────────┐  ┌────────────┐
              │ Neon       │  │ Cloudflare │
              │ PostgreSQL │  │ R2         │
              │ (Database) │  │ (Files)    │
              └────────────┘  └────────────┘
```

## Deployment Flow

```
Push to master
     │
     ├──→ Render detects push → Rebuilds Docker → Backend live
     │
     └──→ GitHub Actions → Builds frontend → Deploys to Cloudflare Pages
```

---

## Environment Variables by Platform

### Render (Backend API)

Set in the Render dashboard: https://dashboard.render.com

| Variable | Example | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://...@ep-xxx.neon.tech/agenda_db?sslmode=require` | Yes | Neon PostgreSQL connection string |
| `SECRET_KEY` | *(auto-generated)* | Yes | JWT signing key |
| `FRONTEND_URL` | `https://agenda-souterrain.pages.dev` | Yes | CORS allowed origin |
| `ADMIN_EMAIL` | `admin@example.com` | Yes | Superadmin email address |
| `SMTP_HOST` | `smtp.gmail.com` | Yes | SMTP server for email sending |
| `SMTP_PORT` | `587` | Yes | SMTP port |
| `SMTP_USER` | `your@gmail.com` | Yes | SMTP username |
| `SMTP_PASSWORD` | *(app password)* | Yes | SMTP app password |
| `STORAGE_BACKEND` | `r2` | Yes | File storage backend |
| `R2_ENDPOINT` | `https://xxx.r2.cloudflarestorage.com` | Yes | Cloudflare R2 endpoint |
| `R2_ACCESS_KEY` | *(secret)* | Yes | R2 access key |
| `R2_SECRET_KEY` | *(secret)* | Yes | R2 secret key |
| `R2_BUCKET` | `agenda-souterrain` | Yes | R2 bucket name |
| `R2_PUBLIC_URL` | `https://files.yourdomain.com` | Yes | Public URL for uploads |
| `SELF_PING_URL` | `https://agenda-souterrain-api.onrender.com/health` | No | Prevents free-tier sleep |
| `LIBRETRANSLATE_URL` | `https://libretranslate.com` | No | Translation API URL |
| `TRANSLATION_BACKEND` | `mymemory` | No | Translation service |

### Cloudflare Pages (Frontend)

Set in: Cloudflare Dashboard > Pages > agenda-souterrain > Settings > Environment variables

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_API_URL` | `https://agenda-souterrain-api.onrender.com/v1` | Backend API base URL |

> **Note**: Vite inlines env vars at build time. Variables must be prefixed with `VITE_`.

### GitHub Actions Secrets

Set in: GitHub repo > Settings > Secrets and variables > Actions

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Pages edit permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `VITE_API_URL` | Production API URL for frontend build |

---

## How to Deploy

### Automatic (recommended)

1. Merge a PR into `master`
2. Render auto-rebuilds the backend Docker image
3. GitHub Actions builds and deploys the frontend to Cloudflare Pages

### Manual — Frontend only

```bash
# Using the deploy script
./scripts/deploy-frontend.sh

# Or manually
cd frontend
npm ci
npm run build
npx wrangler pages deploy dist --project-name=agenda-souterrain
```

### Manual — Backend only

Push to `master` triggers auto-deploy on Render. No manual action needed.

To force a redeploy without code changes, use the Render dashboard "Manual Deploy" button.

---

## Setting Up From Scratch

### 1. GitHub Repository

1. Create a repo on GitHub
2. Push your code
3. Add secrets (see table above)
4. Set `develop` as default branch
5. Add branch protection rules:
   - `master`: require PR + CI passing
   - `develop`: require CI passing

### 2. Neon (Database)

1. Create a project on [neon.tech](https://neon.tech)
2. Copy the connection string
3. Replace `postgresql://` with `postgresql+asyncpg://`
4. Append `?sslmode=require`
5. Set as `DATABASE_URL` on Render

### 3. Render (Backend)

1. Create a new **Web Service** on [render.com](https://render.com)
2. Connect to GitHub repo
3. Configure:
   - **Docker context**: `./backend`
   - **Dockerfile path**: `./backend/Dockerfile`
   - **Branch**: `master`
4. Add all environment variables from the table above
5. First deploy runs `alembic upgrade head` automatically

### 4. Cloudflare Pages (Frontend)

1. Go to Cloudflare Dashboard > Pages
2. Create project named `agenda-souterrain`
3. Set `VITE_API_URL` environment variable
4. Deploy via GitHub Actions or manually with `wrangler`

### 5. Cloudflare R2 (File Storage)

1. Create an R2 bucket in Cloudflare Dashboard
2. Create an API token with R2 read/write permissions
3. Set `R2_*` variables on Render
