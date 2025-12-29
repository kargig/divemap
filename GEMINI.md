# Divemap Project Context

## Project Overview
Divemap is a comprehensive web application designed for scuba diving enthusiasts to discover, rate, and review dive sites and centers. It features user management, dive logging, interactive maps, and social sharing capabilities.

### Tech Stack
- **Frontend:** React (Create React App), Tailwind CSS, OpenLayers, React Query, React Router DOM.
- **Backend:** Python (FastAPI), SQLAlchemy (ORM), Alembic (Migrations), PyJWT (Auth).
- **Database:** MySQL (Version 8.0/LTS).
- **Infrastructure:** Docker, Docker Compose, Nginx (Reverse Proxy), Fly.io (Production Deployment).
- **External Services:** Google Identity Services (OAuth), OpenAI API (Newsletter Parsing).

## Core Project Standards
- **Docker First:** Always use Docker to manage containers. Never start services directly on the host system.
- **Python Environment:** Always use the virtual environment at `backend/divemap_venv`.
- **Node.js Operations:** Use `docker exec` for frontend commands (e.g., `docker exec divemap_frontend npm install`).
- **Security:** Never install packages globally. Use `.env` files and never commit secrets.

## Git Workflow & Standards
- **Feature Branches:** ALWAYS create a feature branch for changes: `feature/[task-name-kebab-case]`.
- **No Direct Commits:** NEVER work directly on `main` or `master`.
- **Commit Messages:**
  - Limit subject to 50 characters, capitalize, no period.
  - Use imperative mood ("Add", "Fix", "Update").
  - Wrap body at 72 characters.
  - Separate subject from body with a blank line.

## Development Workflow

### Prerequisites
- Docker & Docker Compose
- Node.js (for local frontend dev/testing)
- Python 3.11+ (for local backend dev/testing)

### Running the Application (Local)
To start the entire stack in development mode:
```bash
docker-compose up -d
```
- **Frontend:** http://localhost
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

### Testing
⚠️ **CRITICAL:** NEVER run tests inside the `divemap_backend` container. It connects to the live MySQL database, and teardown may result in data loss.

**Backend Tests (Host Venv):**
```bash
cd backend
source divemap_venv/bin/activate
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"
export GOOGLE_CLIENT_ID="dummy-client-id-for-testing"
python -m pytest tests/ -v
```

**Backend Tests (Isolated Docker):**
```bash
cd backend
./docker-test-github-actions.sh
```

**Frontend Tests:**
```bash
# Manual (in frontend/ dir)
npm test
node tests/run_frontend_tests.js
```

### Database Management
Migrations are handled by Alembic.
```bash
# Create a new migration
docker-compose exec backend python create_migration.py "Description"

# Run migrations
docker-compose exec backend python run_migrations.py
```

## Key Directories & Files
- **`backend/`**: Contains the FastAPI application.
    - `app/`: Main application logic.
    - `divemap_venv/`: Required Python virtual environment.
- **`frontend/`**: Contains the React application.
- **`.cursor/rules/`**: Modularized project rules and standards.
- **`docs/`**: Extensive project documentation (deployment, API, testing).
- **`docker-compose.yml`**: Service definitions.

## Documentation
Documentation is consolidated in the `docs/` directory. Major changes should be reflected in the relevant documentation files to prevent information pollution.
