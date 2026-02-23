# Deployment Guide — Agenda Souterrain

## Production Architecture

```
         agenda-souterrain.com        api.agenda-souterrain.com
                    │                             │
                    ▼                             ▼
          ┌──────────────────┐          ┌──────────────────┐
          │  Cloudflare      │          │  Render          │
          │  Pages           │          │  (Backend)       │
          │  (Frontend)      │          │  FastAPI Docker  │
          │  React SPA       │          └────────┬─────────┘
          └──────────────────┘                   │
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
| `FRONTEND_URL` | `https://agenda-souterrain.com` | Yes | CORS allowed origin |
| `ADMIN_EMAIL` | `admin@example.com` | Yes | Superadmin email address |
| `RESEND_API_KEY` | `re_xxxxxxxxx` | Yes | Resend API key for email sending |
| `EMAIL_FROM` | `Agenda Souterrain <noreply@agenda-souterrain.com>` | No | Sender address (default: onboarding@resend.dev) |
| `STORAGE_BACKEND` | `r2` | Yes | File storage backend |
| `R2_ENDPOINT` | `https://xxx.r2.cloudflarestorage.com` | Yes | Cloudflare R2 endpoint |
| `R2_ACCESS_KEY` | *(secret)* | Yes | R2 access key |
| `R2_SECRET_KEY` | *(secret)* | Yes | R2 secret key |
| `R2_BUCKET` | `agenda-souterrain` | Yes | R2 bucket name |
| `R2_PUBLIC_URL` | `https://files.agenda-souterrain.com` | Yes | Public URL for uploads |
| `COOKIE_DOMAIN` | `.agenda-souterrain.com` | Yes | Cookie domain (empty for local dev) |
| `COOKIE_SECURE` | `true` | Yes | Secure cookies (HTTPS only) — `false` for local dev |
| `SELF_PING_URL` | `https://api.agenda-souterrain.com/health` | No | Prevents free-tier sleep |
| `LIBRETRANSLATE_URL` | `https://libretranslate.com` | No | Translation API URL |
| `TRANSLATION_BACKEND` | `mymemory` | No | Translation service |

### Cloudflare Pages (Frontend)

Set in: Cloudflare Dashboard > Pages > agenda-souterrain > Settings > Environment variables

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_API_URL` | `https://api.agenda-souterrain.com/v1` | Backend API base URL |

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

### 6. Custom Domain (`agenda-souterrain.com`)

**DNS Records** (Cloudflare DNS):

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| `CNAME` | `@` | `agenda-souterrain.pages.dev` | Proxied |
| `CNAME` | `www` | `agenda-souterrain.pages.dev` | Proxied |
| `CNAME` | `api` | `as-api-9f3k2.onrender.com` | DNS only |

**Custom domains**:
- Cloudflare Pages → add `agenda-souterrain.com` + `www.agenda-souterrain.com`
- Render → add `api.agenda-souterrain.com`

**Update env vars**:
- Render: `FRONTEND_URL` = `https://agenda-souterrain.com`
- GitHub Secret: `VITE_API_URL` = `https://api.agenda-souterrain.com/v1`

### 7. Authentication Cookies & CSRF

Authentication uses **HTTP-only cookies** instead of localStorage tokens:

| Cookie | HttpOnly | Path | Max-Age | Purpose |
|--------|----------|------|---------|---------|
| `access_token` | Yes | `/` | 15 min | JWT access token |
| `refresh_token` | Yes | `/v1/auth` | 7 days | JWT refresh token |
| `csrf_token` | No | `/` | 7 days | CSRF double-submit cookie |

**CSRF Protection**: The backend uses the double-submit cookie pattern. All mutating requests (POST, PUT, PATCH, DELETE) must include an `X-CSRF-Token` header matching the `csrf_token` cookie value. Exempt routes: login, register, forgot-password, reset-password, verify-email.

**Cross-domain setup**:
- Frontend (`agenda-souterrain.com`) and API (`api.agenda-souterrain.com`) share the `.agenda-souterrain.com` cookie domain
- `COOKIE_DOMAIN=.agenda-souterrain.com` and `COOKIE_SECURE=true` must be set on Render
- In local dev, leave `COOKIE_DOMAIN` empty and `COOKIE_SECURE=false`

### 8. Resend (Email)

1. Add domain `agenda-souterrain.com` on [resend.com/domains](https://resend.com/domains)
2. Add the DNS records Resend gives you (SPF, DKIM, DMARC) in Cloudflare DNS
3. Verify the domain on Resend
4. Set `EMAIL_FROM` on Render to `Agenda Souterrain <noreply@agenda-souterrain.com>`
