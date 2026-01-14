# Divemap Repository Map

This map provides a high-level overview of the codebase to help agents navigate and understand the project structure.

## 🏗️ Core Architecture
- `docker-compose.yml`: Main service orchestration (Frontend, Backend, DB, Nginx).
- `GEMINI.md`: Project standards, testing guidelines, and workflow rules.
- `REPO_MAP.md`: This file (your starting point for navigation).

## 🔙 Backend (`backend/`)
FastAPI application handling business logic, API, and database.

### Core Application (`backend/app/`)
- `main.py`: Application entry point and middleware configuration.
- `models.py`: SQLAlchemy database models (Source of truth for DB schema).
- `schemas.py`: Pydantic data models (API request/response contracts).
- `database.py`: Database connection and session management.
- `auth.py` & `google_auth.py`: Authentication logic and OAuth integration.
- `limiter.py` & `turnstile_service.py`: Rate limiting and Cloudflare Turnstile bot protection.
- `physics.py`: Scuba diving physics calculations (e.g., partial pressures).
- `utils.py`: **COMMON:** Search scoring, IP detection, and shared helpers.

### Modules
- `routers/`: API route definitions.
  - `dives/`: Highly modularized dive management (CRUD, Media, Profiles, Import, Admin).
  - `dive_sites.py`: Site discovery and management.
  - `dive_routes.py`: GPS dive route tracking and analytics.
  - `newsletters.py`: Newsletter parsing and automated **dive trip** extraction.
  - `diving_organizations.py` & `user_certifications.py`: Management of **organizations and certifications**.
  - `weather.py`: Forecasts and conditions for dive sites.
- `services/`: Specialized business logic:
  - `email_service.py` & `ses_service.py`: SES-based email handling and verification.
  - `r2_storage_service.py`: Cloudflare R2 (S3-compatible) file storage.
  - `dive_profile_parser.py`: Complex parsing of dive computer log files.
  - `open_meteo_service.py`: Weather data integration.
  - `wind_recommendation_service.py`: Diving-specific wind impact logic.
  - `route_analytics_service.py`: Analysis of GPS dive routes.
  - `eventbridge_service.py` & `sqs_service.py`: AWS asynchronous event orchestration.
- `lambda/`: Serverless functions (e.g., `email_processor.py`) for off-loaded tasks.
- `migrations/`: Alembic database migration scripts.
- `tests/`: Pytest suite (Run via `./docker-test-github-actions.sh`).

## 🎨 Frontend (`frontend/`)
React application built with Vite, Tailwind CSS, and OpenLayers.

### Source Code (`frontend/src/`)
- `App.js`: Main router and layout configuration.
- `api.js`: **CRITICAL:** Central Axios client, interceptors (refresh/retry), and API service functions.
- `pages/`: Full-page components (e.g., `Home.js`, `DiveSiteDetail.js`, `Admin.js`).
- `components/`: Reusable UI elements:
    - `ui/`: Basic design tokens (Buttons, Inputs, Modals).
    - `forms/`: Form-specific logic and components.
    - `tables/`: Data display components.
    - `map/`: OpenLayers map integration and overlays.
- `hooks/`: Custom React hooks:
  - `useSettings.js`: User preferences management.
  - `useViewportData.js`: **CRITICAL:** Optimized data fetching based on map extent.
  - `useResponsive.js`: Device-specific layout detection.
  - `usePageTitle.js`: **COMMON:** Dynamic page title management.
- `utils/`: Helpers and validation:
  - `formHelpers.js`: **CRITICAL:** Zod schemas for all forms.
  - `physics.js`: Frontend parity for dive physics calculations.
  - `windSuitabilityHelpers.js`: Real-time wind impact visualization logic.
  - `routeCompression.js`: Optimizing GPS tracks for storage/display.
  - `routeUtils.js`: GPS route processing and visualization logic.
  - `tripHelpers.js`: Formatting and helpers for dive trips.
- `context/`: React Context providers (Auth, Theme, etc.).

## 🛠️ DevOps & Scripts
- `nginx/`: Reverse proxy configuration (Dev/Prod).
- `database/`: Custom Dockerfile and initialization SQL for MySQL.
- `scripts/`: Maintenance and build utilities (Backup, Warmup).
- `utils/`: Data migration and maintenance scripts (KML import, cleanup).
- `terraform/`: Infrastructure as Code for AWS/Fly.io resources.

## 📖 Documentation (`docs/`)
- `getting-started/`: Local development setup.
- `development/`: Coding standards and architecture.
- `testing/`: Comprehensive testing strategies.
- `security/`: Security policies and audit findings.
