# Divemap

Divemap is an open-source web platform for scuba divers. Divers can log dives, explore dive sites, visualize dive computer profiles, analyze gas physics, monitor marine weather, and connect with dive buddies.

## Key Features

### Dive Logs and Computer Profiles
- **File Imports**: Import dive logs from Garmin (`.fit`), Subsurface (`.xml`), Suunto (`.json`), and CSV files.
- **Interactive Profile Charts**: Inspect depth, rolling average depth, water temperature, decompression ceilings, CNS oxygen toxicity, and gas switches.
- **Bühlmann Decompression Analysis**: Simulate inert gas loading with a native Bühlmann ZH-L16 model. Inspect all 16 tissue compartments on a dynamic heatmap and view surfacing tissue saturation charts.
- **Advanced Diver Analytics**: Analyze diver habits with 2D depth density histograms (maximum depth compared to average depth), gas consumption trends, and time-series progress charts.

### Dive Sites and Interactive Maps
- **Interactive Maps**: Browse dive sites and diving centers on Leaflet maps with marker clustering.
- **Site Details**: View entry types, maximum depths, hazards, marine life, and 1-to-5 star community ratings.
- **Custom Lists**: Create and share dive site collections with other divers.

### Marine Weather and Route Planning
- **Wind and Swell Forecasts**: View marine weather forecasts from Open-Meteo with live wind direction overlays.
- **Site Suitability**: Automatically identify protected dive sites based on wind exposure and coastline geometry.
- **Underwater Routes**: Draw dive paths with compass bearings, measure distances, and export GPX or KML files.

### Scuba Physics Calculators
- **Gas Planning**: Calculate Maximum Operating Depth (MOD), Best Nitrox Mix, and Minimum Gas reserves.
- **Advanced Decompression**: Analyze Surface Air Consumption (SAC) rates, Isobaric Counterdiffusion (ICD), and buoyancy weights.

### Community and Buddy Messaging
- **Buddy Network**: Add buddies, track joint dives, and view public diver profiles with certification histories.
- **Direct Messaging**: Chat with dive buddies using encrypted messaging and Web Push notifications.
- **Leaderboards**: Track diver milestones on all-time and monthly leaderboards.

### AI Assistant and Trip Discovery
- **Natural Language Discovery**: Find dive sites and trips with conversational AI queries.
- **Newsletter Parsing**: Automatically extract dive trips and shop events from newsletter emails.

### Mobile and Accessibility
- **Progressive Web App**: Install Divemap on mobile and desktop devices with offline caching.
- **Android Support**: Native Android wrapper through Trusted Web Activities (TWA) and Capacitor.
- **Full Dark Mode**: Switch between light and dark themes across all pages and maps.

## Tech Stack

| Component | Technologies |
|---|---|
| **Frontend** | React 18, Vite 8, Tailwind CSS, Leaflet, React Query, React Hook Form, Zod, Recharts |
| **Backend** | Python 3.13, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, orjson, PyJWT |
| **Database** | MySQL 8.0 (Spatial Extensions) |
| **Edge & Cloud** | Cloudflare (Turnstile bot defense, R2 storage, edge Workers), Fly.io |
| **Integrations** | Open-Meteo API, OpenAI API, Web Push (VAPID), Google OAuth |

## Quick Start

Run Divemap locally with Docker Compose.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/kargig/divemap.git
   cd divemap
   ```

2. Copy the sample environment file:
   ```bash
   cp env.example .env
   ```

3. Start the containers:
   ```bash
   docker-compose up -d
   ```

4. Open the application:
   - Frontend: [http://localhost](http://localhost)
   - Backend API documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

## Development and Testing

### Backend Tests

CAUTION: Do not run pytest inside the live backend container. That command deletes the development database.

To run backend tests in an isolated test database:
```bash
cd backend
./docker-test-github-actions.sh
```

To run a specific test file:
```bash
cd backend
./docker-test-github-actions.sh tests/test_dive_sites.py
```

### Frontend Tests

To run frontend tests:
```bash
cd frontend
npm test
```

### Code Quality and Linting

Before you submit code, run the linters:

```bash
# Check backend code with Ruff
make lint-backend

# Check frontend code with ESLint
make lint-frontend
```

### Database Migrations

Apply schema updates with Alembic:

```bash
docker-compose exec backend python run_migrations.py
```

## Documentation

For detailed architecture guides and deployment workflows, see the `docs/` directory:

- [Getting Started Guide](docs/getting-started/README.md) - User guides and setup notes.
- [Development Workflow](docs/development/README.md) - Development environment and coding standards.
- [Architecture Overview](docs/development/architecture.md) - System architecture and service components.
- [API Documentation](docs/development/api.md) - REST endpoints, payloads, and authentication.
- [Database Guide](docs/development/database.md) - Schema design, spatial indexes, and migration rules.
- [Testing Strategy](docs/TESTING_STRATEGY.md) - Test architecture and CI test commands.
- [Importing Dive Logs](docs/development/importing-data.md) - Instructions for Subsurface, Garmin, and CSV imports.
- [Deployment Guide](docs/deployment/README.md) - Fly.io, Cloudflare, and Nginx configurations.
- [Security Overview](docs/security/README.md) - Authentication, rate limits, and security headers.
- [Maintenance Guide](docs/maintenance/README.md) - Operational procedures and troubleshooting.

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.
