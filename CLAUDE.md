# Agenda Souterrain

Application de calendrier collaboratif fullstack (FastAPI + React/TypeScript).

## Stack

- **Backend**: FastAPI (Python), SQLAlchemy, PostgreSQL
- **Frontend**: React 18, TypeScript, Vite, TanStack Query
- **Auth**: JWT via HTTP-only cookies (access 15min, refresh 7d/30d)
- **Deploy**: Render (backend, auto-deploy on master), Cloudflare Pages (frontend, GitHub Actions on master)

## Git Flow

- Branches: `feature/*` ou `fix/*` → `develop` → `master` (prod)
- **Ne jamais coder directement sur `master` ou `develop`.**
- Toujours créer une feature branch depuis `develop` AVANT d'écrire du code.
- Bump de version dans `frontend/package.json` dans la même branche que le code (patch pour fix/perf, minor pour feature, major pour breaking).
- Workflow de deploy : feature branch → PR vers develop → merge → PR develop vers master → merge

## Tests

Lancer les tests complets après chaque modification :

```bash
# Frontend : tests unitaires
cd frontend && npx vitest run

# Frontend : build de production
cd frontend && npm run build

# Backend : vérification syntaxe
cd backend && python -m py_compile main.py
```

## Architecture

- **Permissions** : système à 7 niveaux, superadmin déterminé par `ADMIN_EMAIL` (env var, calculé, pas stocké en DB)
- **Token refresh** : proactif toutes les 13 min dans `App.tsx`
- **React Query** : staleTime 5 min (global), keepPreviousData sur la query events
- **`get_optional_user`** (`deps.py`) : retourne None si aucun credential, propage 401 si token expiré

## Wiki

Mettre à jour le wiki GitHub après chaque merge sur master. Ne modifier que les sections impactées.

## Langue

Toujours répondre en français.
