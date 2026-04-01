# Testing Guide

This document provides essential testing information for the Divemap application. For comprehensive testing strategy and detailed procedures, see [TESTING_STRATEGY.md](../TESTING_STRATEGY.md).

## Table of Contents

1. Quick Start
2. The ONLY Approved Backend Testing Method
3. Why SQLite is Not Supported
4. DO NOT: Running pytest directly
5. Frontend Testing (Host and Docker)
6. Troubleshooting

## Quick Start

- **Backend tests (MANDATORY, safe, isolated):**
```bash
cd backend
./docker-test-github-actions.sh
```

- **Frontend quick tests (host):**
```bash
cd frontend
npm test
```

## The ONLY Approved Backend Testing Method

**You MUST use `backend/docker-test-github-actions.sh` for all backend testing.**

This script:
  - Starts an isolated MySQL 8.0 test container.
  - Builds a dedicated test image.
  - Runs all Alembic migrations and executes pytest in complete isolation.
  - Safely cleans up the environment without touching your development database.

## Why SQLite is Not Supported

Unlike many Python projects, Divemap is **not compatible with SQLite**. The application relies heavily on native MySQL features that SQLite cannot replicate, including:
- **Spatial Data Types:** Uses `POINT` columns and `ST_Distance_Sphere` for geographic searches.
- **MySQL-Specific Types:** Uses `LONGTEXT` for large content fields (e.g., newsletters).
- **Strict Constraints:** Uses specific MySQL Enum behaviors.

Because the test suite initializes the entire schema at the start of every session (`Base.metadata.create_all`), attempting to run `pytest` against an SQLite database will result in a fatal `CompileError`. **Do not attempt to use SQLite for backend testing.**

## DO NOT: Running pytest directly

- ❌ **DO NOT run tests inside the `divemap_backend` container.**
- ❌ **DO NOT run tests using the local `divemap_venv` on your host machine.**

Forbidden examples that will cause errors or fatal data loss:
```bash
# ❌ FATAL: Wipes live database
docker-compose exec backend pytest

# ❌ FORBIDDEN: SQLite incompatibility (will crash)
cd backend && source divemap_venv/bin/activate && pytest
```

## Frontend Testing (Host and Docker)

### Frontend Testing (Host)
```bash
# React unit tests (Jest)
cd frontend
npm test

# Validation tests (accessibility, navigation, basic UI flows)
node tests/validate_frontend.js

# Full frontend test suite runner (aggregates)
node tests/run_frontend_tests.js

# Regression/API-focused tests (no browser required)
node tests/test_regressions.js
```

- Notes:
  - Prefer host-based frontend tests for iteration speed.
  - Ensure dependencies are installed: `npm install`.
  - Some browser-driven tests may require Google Chrome to be installed on the host.

### Frontend Testing (Docker)

Development container (use when you need an isolated Node environment):
```bash
cd frontend
# Build development image with full test tooling
docker build -f Dockerfile.dev -t divemap_frontend_dev .

# Run frontend tests in dev container
docker run --rm divemap_frontend_dev npm run test:frontend
docker run --rm divemap_frontend_dev npm run test:validation
docker run --rm divemap_frontend_dev npm run test:e2e

# Optionally run the development server from the container
docker run --rm -p 3000:3000 divemap_frontend_dev
```

Production image (no test tooling; for runtime checks only):
```bash
cd frontend
docker build -t divemap_frontend_prod .
# Run production server
docker run --rm -p 8080:8080 divemap_frontend_prod
```

## Troubleshooting

### Backend
- ModuleNotFoundError:
```bash
source backend/divemap_venv/bin/activate
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"
```

- Database Connection Errors:
```bash
docker-compose up -d db
```

### Frontend
- Puppeteer or headless browser issues:
  - Ensure Chrome is available on host, or run tests in the `divemap_frontend_dev` container.
  - Replace deprecated `waitForTimeout` with `await new Promise(resolve => setTimeout(resolve, ...))` if needed.

- Dependency issues:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```