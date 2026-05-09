# Divemap Repository Map

This map provides a high-level overview of the codebase to help agents navigate and understand the project structure.

## 🏗️ Core Architecture
- `docker-compose.yml`: Main service orchestration (Frontend, Backend, DB, Nginx).
- `Makefile`: Central task runner for deployment, testing, and maintenance.
- `GEMINI.md`: Project standards, testing guidelines, and workflow rules.
- `REPO_MAP.md`: This file (your starting point for navigation).

## 🌍 Infrastructure & Edge Services
- `divemap-llm-worker/`: Cloudflare Worker that serves `llms.txt` and markdown documentation from R2 storage.
- `divemap-presentations-worker/`: Cloudflare Worker that intercepts `/presentations/*` routes and serves content from R2.
- `logshippper/`: Fly.io log shipper application for centralized logging and observability.
- `terraform/`: Infrastructure as Code for AWS/Fly.io resources.

## 🔙 Backend (`backend/`)
FastAPI application handling business logic, API, and database.

### Core Application (`backend/app/`)
- `main.py`: Application entry point and middleware configuration.
- `models.py`: SQLAlchemy database models (Source of truth for DB schema).
- `schemas/`: Modularized Pydantic data models (API request/response contracts).
- `database.py`: Database connection and session management.
- `auth.py` & `google_auth.py`: Authentication logic and OAuth integration.
- `token_service.py`: JWT and session token lifecycle management.
- `limiter.py` & `turnstile_service.py`: Rate limiting and Cloudflare Turnstile bot protection.
- `geo_utils.py`: Geospatial helpers (Distance, bounds, and location info).
- `physics.py`: Scuba diving physics calculations (e.g., partial pressures).
- `utils.py`: **COMMON:** Search scoring, IP detection, and shared helpers.
- `monitoring/`: Specialized services for system and bot protection monitoring.

### Modules
- `routers/`: API route definitions.
  - `dives/`: Highly modularized dive management (CRUD, Media, Profiles, Import, Admin).
  - `admin/`: Site-wide administration tools and data management.
  - `dive_sites.py`: Site discovery and management.
  - `diving_centers.py`: Diving center discovery and profiles.
  - `chat.py` & `user_chat.py`: Secure, encrypted buddy-to-buddy messaging system.
  - `dive_routes.py`: GPS dive route tracking and analytics.
  - `leaderboard.py`: Competitive user ranking and activity metrics.
  - `notifications.py`: Push notification management and device subscriptions.
  - `newsletters.py`: Newsletter parsing and automated **dive trip** extraction.
  - `diving_organizations.py` & `user_certifications.py`: Management of **organizations and certifications**.
  - `user_friendships.py`: Buddy system and social graph management.
  - `search.py`: Comprehensive site and center fuzzy search logic.
  - `weather.py`: Forecasts and conditions for dive sites.
- `services/`: Specialized business logic:
  - `email_service.py` & `ses_service.py`: SES-based email handling and verification.
  - `r2_storage_service.py`: Cloudflare R2 (S3-compatible) file storage.
  - `chat/`: Specialized logic for message handling and encryption.
  - `notification_service.py`: Dispatching Web Push and Email notifications.
  - `openai_service.py`: Integration with OpenAI for newsletter extraction and AI features.
  - `dive_profile_parser.py`: Complex parsing of dive computer log files.
  - `dive_export_service.py`: Exporting dive profiles in Subsurface XML, Garmin FIT, and Suunto JSON formats.
  - `open_meteo_service.py`: Weather data integration.
  - `wind_recommendation_service.py`: Diving-specific wind impact logic.
  - `route_analytics_service.py`: Analysis of GPS dive routes.
  - `share_service.py`: Logic for generating social sharing assets and metadata.
  - `eventbridge_service.py` & `sqs_service.py`: AWS asynchronous event orchestration.
- `generate_static_content.py`: Generates LLM documentation and static site content for edge workers.
- `scripts/`: Maintenance and utility scripts (Chat cleanup, thumbnail generation, API benchmarking).
- `lambda/`: Serverless functions (e.g., `email_processor.py`) for off-loaded tasks.
- `migrations/`: Alembic database migration scripts.
- `tests/`: Pytest suite (Run via `./docker-test-github-actions.sh`).

## 🎨 Frontend (`frontend/`)
React application built with Vite, Tailwind CSS, and OpenLayers.
### Source Code (`frontend/src/`)
- `index.jsx`: React application entry point.
- `App.jsx`: Main router and layout configuration.
- `index.css`: Global Tailwind CSS and project styles.
- `api.js`: **CRITICAL:** Central Axios client, interceptors (refresh/retry), and API service functions.
- `sw.js`: Service Worker for PWA functionality and Web Push notifications.
- `pages/`: Full-page React components.
  - **Core:** `Home.jsx`, `DiveSites.jsx`, `DivingCenters.jsx`, `Dives.jsx`, `DiveTrips.jsx`, `Profile.jsx`.
  - **Details:** `DiveSiteDetail.jsx`, `DivingCenterDetail.jsx`, `DiveDetail.jsx`, `TripDetail.jsx`, `UserProfile.jsx`, `RouteDetail.jsx`.
  - **Creation:** `CreateDiveSite.jsx`, `CreateDive.jsx`, `CreateTrip.jsx`, `CreateDivingCenter.jsx`.
  - **Social:** `Messages.jsx` (Chat Inbox), `Buddies.jsx`, `LeaderboardPage.jsx`.
  - **Admin:** `Admin.jsx` (Dashboard), `AdminUsers.jsx`, `AdminDiveSites.jsx`, `AdminDivesDesktop.jsx`, `AdminNewsletters.jsx`, `AdminAuditLogs.jsx`.
- `components/`: Reusable UI components.
    - **Navigation & Search:** `Navbar.jsx`, `GlobalSearchBar.jsx`, `DesktopSearchBar.jsx`, `FuzzySearchInput.jsx`, `Breadcrumbs.jsx`.
    - **Map Components:** `LeafletMapView.jsx` (Primary Map), `DiveSitesMap.jsx`, `DivesMap.jsx`, `DivingCentersMap.jsx`, `WindOverlay.jsx`, `MapLayersPanel.jsx`.
    - **Dive & Site Displays:** `DiveSiteCard.jsx`, `TripCard.jsx`, `DiveInfoGrid.jsx`, `AdvancedDiveProfileChart.jsx`, `MarineConditionsCard.jsx`, `GasTanksDisplay.jsx`.
    - **AI Chat (`Chat/`):** `ChatWidget.jsx`, `ChatWindow.jsx`, `MessageBubble.jsx`, `SuggestionChips.jsx`.
    - **Buddy Messaging (`UserChat/`):** `ChatInbox.jsx`, `ChatRoom.jsx`, `MessageBubble.jsx`, `NewChatModal.jsx`.
    - **Forms (`forms/`):** `FormField.jsx`, `GasMixInput.jsx`, `GasTanksInput.jsx`.
    - **Tables (`tables/`):** `LeaderboardTable.jsx`, and modular `Admin...Table.jsx` components.
    - **Calculators (`calculators/`):** Scuba physics tools (`BestMix`, `GasPlanning`, `MinGas`, `Mod`, `SacRate`, `Weight`).
    - **UI Primitives (`ui/`):** `Button.jsx`, `Modal.jsx`, `Select.jsx`, `Tabs.jsx`, `Combobox.jsx`, `ShellRating.jsx`, `Pagination.jsx`.
    - **System/Infrastructure:** `SessionManager.jsx`, `PWAUpdater.jsx`, `SEO.jsx`, `Turnstile.jsx`, `NotificationBell.jsx`.
- `hooks/`: Custom React hooks (Settings, Viewport Data, Responsive Layout).
- `services/`: Frontend-specific service logic (Notification permissions, PWA lifecycle).
- `utils/`: Helpers and validation:
  - `formHelpers.js`: **CRITICAL:** Zod schemas for all forms.
  - `physics.js`: Frontend parity for dive physics calculations.
  - `windSuitabilityHelpers.js`: Real-time wind impact visualization logic.
  - `routeCompression.js`: Optimizing GPS tracks for storage/display.
  - `routeUtils.js`: GPS route processing and visualization logic.
  - `tripHelpers.js`: Formatting and helpers for dive trips.
- `contexts/`: React Context providers (Auth, Theme, Buddy Requests, Chat).

## 🛠️ DevOps & Scripts
- `nginx/`: Reverse proxy configuration (Dev/Prod).
- `divemap-android/`: Android Bubblewrap TWA (Trusted Web Activity) application structure and build artifacts.
- `database/`: Custom Dockerfile and initialization SQL for MySQL.
- `scripts/`: Maintenance and build utilities (Backup, Warmup).
- `utils/`: Data migration and maintenance scripts (KML import, cleanup).
- `terraform/`: Infrastructure as Code for AWS/Fly.io resources.

## 📖 Documentation (`docs/`)
- `getting-started/`: Local development setup.
- `development/`: Coding standards and architecture.
- `testing/`: Comprehensive testing strategies.
- `security/`: Security policies and audit findings.
