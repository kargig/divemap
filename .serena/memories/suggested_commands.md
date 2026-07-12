# Suggested Commands

## General
- `docker-compose up -d`: Start all services.
- `docker-compose down`: Stop services.
- `make deploy`: Full deployment.

## Backend
- **Testing**: `./docker-test-github-actions.sh` (Safe, recommended).
- **Migrations**: `docker-compose exec backend alembic revision --autogenerate -m "desc"`.
- **Note**: Rename migrations to `00XX_...py`.

## Frontend
- **Install**: `docker exec divemap_frontend npm install <package>`.
- **Lint**: `make lint-frontend`.
- **Test**: `make test-frontend`.

## Verification
- Mandatory browser/console checks: `mem:task_completion`.
