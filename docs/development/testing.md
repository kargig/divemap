# Testing Guide

This document provides essential testing information for the Divemap application. For comprehensive testing strategy and detailed procedures, see [TESTING_STRATEGY.md](../TESTING_STRATEGY.md).

## Table of Contents

1. Quick Start
2. Approved Testing Methods
3. DO NOT: Running tests inside divemap_backend
4. Running Tests (Host vs Containers)
5. Frontend Testing (Host and Docker)
6. Docker-Based Testing (Backend CI-like)
7. Troubleshooting

## Quick Start

- Quick host-based backend tests (fast, local venv, acceptable for quick checks):
```bash
cd backend
source divemap_venv/bin/activate
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"
# Required for OAuth tests to avoid 500 errors
export GOOGLE_CLIENT_ID="dummy-client-id-for-testing"
python -m pytest tests/ -v
```

- Thorough containerized backend tests (CI-like, isolated, REQUIRED before committing significant changes):
```bash
cd backend
./docker-test-github-actions.sh
```

- Frontend quick tests (host):
```bash
cd frontend
npm test
```

## Approved Testing Methods

- Host-based (Quick):
  - Run pytest from the host in a Python virtual environment.
  - Uses SQLite by default unless `DATABASE_URL` is explicitly set.
  - Frontend tests run via Node.js on host.
  - Purpose: fast feedback during development.

- Containerized (Thorough):
  - Use `backend/docker-test-github-actions.sh` for backend.
  - For frontend, use the development Dockerfile to build and run tests if needed.
  - Mirrors CI environment; REQUIRED before merges or major refactors.

## DO NOT: Run tests inside `divemap_backend`

- Tests MUST NEVER be run inside the `divemap_backend` service/container.
- Reason: `divemap_backend` uses `DATABASE_URL=mysql+pymysql://...@db:3306/divemap`. Tests would connect to the live MySQL container and the test session will drop all tables at teardown, wiping dev data.
- Forbidden examples (do NOT run):
```bash
# ❌ Do not run inside the container
docker exec -it divemap_backend bash
pytest
python -m pytest
```

## Running Tests (Backend)

### Backend Testing (Host)
```bash
# Run all backend tests
cd backend
source divemap_venv/bin/activate
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"
# Required for OAuth tests
export GOOGLE_CLIENT_ID="dummy-client-id-for-testing"
python -m pytest tests/ -v

# Run specific file
python -m pytest tests/test_diving_centers.py -v

# With coverage
python -m pytest tests/ --cov=app --cov-report=html
```

### Backend Testing (Containers - CI-like)
```bash
cd backend
./docker-test-github-actions.sh
```
- What this does:
  - Starts an isolated MySQL test container (port 3307, no volumes)
  - Builds a test image
  - Runs migrations and executes pytest in isolation
  - Cleans up test containers/networks/images

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

## Docker-Based Testing (Backend CI-like)

- Development (frontend) containers are for building/running the app, not for backend tests.
- Use the host venv or the CI-like script for backend tests.

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
