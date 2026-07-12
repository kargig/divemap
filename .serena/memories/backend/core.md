# Backend Core

The backend is a FastAPI application using SQLAlchemy and MySQL.

## Navigation
- Performance: `mem:sqlalchemy_performance_standards`

## Key Locations
- `backend/app/main.py`: Application entry point.
- `backend/app/models.py`: SQLAlchemy models.
- `backend/app/schemas.py`: Pydantic validation schemas.
- `backend/app/routers/`: API route handlers.
- `backend/migrations/`: Alembic database migrations.

## Invariants
- **Testing**: Use `./docker-test-github-actions.sh` for safe testing.
- **Migrations**: Sequential naming `00XX_...py` is mandatory.
- **Auth**: PyJWT with Google OAuth.
