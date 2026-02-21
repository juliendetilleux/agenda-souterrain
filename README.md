# Agenda Souterrain

Application de calendrier collaboratif inspirée de Teamup — Backend Python (FastAPI) + Frontend React (TypeScript).

## Démarrage rapide

### Avec Docker Compose (recommandé)

```bash
docker-compose up --build
```

- Frontend : http://localhost:5173
- Backend API : http://localhost:8000
- Docs API (Swagger) : http://localhost:8000/docs

### Développement local

**Backend**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Editer .env avec vos paramètres PostgreSQL
alembic upgrade head
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

## Stack

| Couche | Technologie |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy (async), Alembic |
| Base de données | PostgreSQL 15 |
| Auth | JWT (python-jose), bcrypt |
| Frontend | React 18, TypeScript, Vite |
| Calendrier UI | FullCalendar.io v6 |
| State | Zustand + TanStack Query |
| Styling | Tailwind CSS |

## Fonctionnalités

- 5 vues calendrier (Mois, Semaine, Jour, Agenda, Année)
- Sous-calendriers colorés avec filtrage
- CRUD événements avec drag & drop
- Récurrence (quotidien, hebdo, mensuel, annuel)
- Système de partage avec niveaux de droits (7 niveaux)
- Liens partageables sans compte
- Export iCal (.ics)
- Inscriptions aux événements
- Recherche plein texte
