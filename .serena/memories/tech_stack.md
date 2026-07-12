# Tech Stack

## Backend
- **Framework**: FastAPI (Python 3.11+)
- **ORM**: SQLAlchemy
- **Migrations**: Alembic
- **Database**: MySQL 8.0/LTS
- **Authentication**: PyJWT (OAuth with Google Identity Services)
- **Task Queue**: Celery with Redis
- **Testing**: Pytest
- **Other**: `orjson` for JSON performance, `pydantic` for validation.

## Frontend
- **Framework**: React (Vite)
- **Styling**: Tailwind CSS
- **Maps**: OpenLayers
- **State Management**: React Query
- **Routing**: React Router DOM
- **Validation**: Zod
- **Testing**: Vitest, Playwright (implied by `test:e2e`)

## Infrastructure
- **Containerization**: Docker, Docker Compose
- **Reverse Proxy**: Nginx
- **Cloud Provider**: Fly.io
- **Storage**: Cloudflare R2 (S3-compatible)
