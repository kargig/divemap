# Migration from pip to uv, Deterministic Dependency Pinning, and Pre-built Wheels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 
1. Build and host a pre-compiled Linux x86_64 wheel for `octo-deco==2.0.3` as a standalone GitHub Release asset on `kargig/divemap`.
2. Completely remove the C-compiler toolchain (`gcc`, `python3-dev`, `build-essential`, `pkg-config`) from Docker build stages.
3. Replace `pip` with `uv` across the Divemap backend (Dockerfiles, CI/CD workflows, local scripts, and testing harness).
4. Establish 100% deterministic dependency locking (`uv.lock` with SHA-256 hashes for all 111 direct and transitive dependencies).

**Architecture:** 
Package `octo-deco==2.0.3` as a Linux x86_64 wheel built in `python:3.11-slim` and attach it to a standalone GitHub Release (`deps-v1`). Configure `[tool.uv.sources]` in `backend/pyproject.toml` pointing to the release asset URL. Migrate all backend dependencies to PEP 621 in `backend/pyproject.toml` with `[tool.uv] package = false`, separating runtime from test/dev dependencies (`[dependency-groups] dev`), and generate `backend/uv.lock`. Streamline `backend/Dockerfile` by removing compiler dependencies and using standalone `uv` binaries (`ghcr.io/astral-sh/uv:0.10.2`) with BuildKit cache. Update CI workflows with `astral-sh/setup-uv@v5` and adjust test scripts (`docker-test-github-actions.sh`, `run_alembic_check.sh`, `Makefile`) while maintaining backward-compatible `requirements.txt` exports.

**Tech Stack:** 
- Python 3.11
- uv >= 0.10.2
- GitHub CLI (`gh`) & GitHub Releases
- Docker & Docker BuildKit
- GitHub Actions CI (`astral-sh/setup-uv@v5`)
- FastAPI, SQLAlchemy, Alembic, Pytest

---

## Global Constraints

- Never break the runtime Docker image interface: runtime must remain based on `python:3.11-slim` with virtualenv at `/opt/venv`.
- Never run tests directly against the development database; all test runs must use ephemeral test environments via `backend/docker-test-github-actions.sh`.
- Maintain strict backward compatibility: `backend/requirements.txt` must remain present and kept in sync via `uv export` for any legacy tooling or scripts.
- No direct commits or `git add` / `git restore` calls by the agent.
- All backend code must pass `backend/divemap_venv/bin/ruff check app` and `./docker-test-github-actions.sh`.

---

## File Structure & Impact Analysis

| File | Change Type | Responsibility |
| :--- | :--- | :--- |
| GitHub Release (`deps-v1`) | Create | Hosts `octo_deco-2.0.3-cp311-cp311-linux_x86_64.whl` on `kargig/divemap` CDN. |
| `backend/pyproject.toml` | Modify | Add `[project]` metadata, runtime `dependencies`, `[dependency-groups] dev`, `[tool.uv] package = false`, and `[tool.uv.sources] octo-deco`. |
| `backend/uv.lock` | Create | Exact lockfile for all 111 direct and transitive dependencies with platform markers and SHA-256 hashes. |
| `backend/requirements.txt` | Modify | Generated from `uv export --frozen --no-dev` for backward compatibility. |
| `backend/requirements-dev.txt` | Create | Generated from `uv export --frozen --all-groups` for test/dev environments if needed. |
| `backend/Dockerfile` | Modify | Remove `gcc/build-essential/python3-dev`; copy `uv`; use `uv sync --frozen --no-dev`. |
| `backend/docker-test-github-actions.sh` | Modify | Update base test image generation to remove compilers, install `uv`, and run `uv sync --frozen`. |
| `backend/run_alembic_check.sh` | Modify | Use `uv pip install` with cache for accelerated Alembic schema validation. |
| `.github/workflows/backend-tests.yml` | Modify | Replace `actions/cache@v3` + `pip install` with `astral-sh/setup-uv@v5` + `uv sync`. |
| `.github/workflows/backend-lint-format.yml` | Modify | Replace `pip install "ruff>=0.9.0"` with `astral-sh/setup-uv@v5` + `uv run ruff`. |
| `backend/docker-compose.test.yml` | Modify | Replace `pip install` with `uv pip install` or `uv sync`. |
| `Makefile` | Modify | Add `uv-lock`, `uv-sync`, and update `lint-backend` commands. |
| `docs/development/README.md` | Modify | Document `uv` commands and dependency management. |

---

## Implementation Tasks

### Task 1: Build & Publish `octo-deco` Wheel to GitHub Release

**Files:**
- Create: `/tmp/octo_deco-2.0.3-cp311-cp311-linux_x86_64.whl` (ephemeral artifact)
- Create: GitHub Release `deps-v1` on `kargig/divemap` with attached `.whl` asset

**Interfaces:**
- Consumes: PyPI `octo-deco==2.0.3` source tarball, `python:3.11-slim` container
- Produces: Permanent CDN release URL: `https://github.com/kargig/divemap/releases/download/deps-v1/octo_deco-2.0.3-cp311-cp311-linux_x86_64.whl`

- [ ] **Step 1: Build Linux x86_64 wheel matching `python:3.11-slim`**

Run:
```bash
docker run --rm -v /tmp:/out python:3.11-slim bash -c "
    apt-get update -qq && 
    apt-get install -y -qq gcc python3-dev > /dev/null && 
    pip wheel --no-deps octo-deco==2.0.3 -w /out
"
```
Verify:
```bash
ls -lh /tmp/octo_deco-2.0.3-cp311-cp311-linux_x86_64.whl
```
Expected: Wheel file exists with size ~769 KB.

- [ ] **Step 2: Create GitHub Release `deps-v1` and attach the wheel**

Run:
```bash
gh release create deps-v1 /tmp/octo_deco-2.0.3-cp311-cp311-linux_x86_64.whl 
    --repo kargig/divemap 
    --title "Binary Dependency Wheels" 
    --notes "Pre-compiled Linux x86_64 wheels for packages without official wheels on PyPI."
```
Expected: Release created and returns public release URL.

- [ ] **Step 3: Test direct wheel download and verification**

Run:
```bash
curl -sIL https://github.com/kargig/divemap/releases/download/deps-v1/octo_deco-2.0.3-cp311-cp311-linux_x86_64.whl | grep -E "HTTP/|location:"
```
Expected: Returns HTTP 302 redirecting to GitHub AWS/Fastly CDN with HTTP 200 OK.

---

### Task 2: Define Project Dependencies and Generate Deterministic Lockfile

**Files:**
- Modify: `backend/pyproject.toml`
- Create: `backend/uv.lock`
- Modify: `backend/requirements.txt`
- Create: `backend/requirements-dev.txt`

**Interfaces:**
- Consumes: GitHub Release wheel URL from Task 1, packages from `backend/requirements.txt`
- Produces: `backend/pyproject.toml` (PEP 621), `backend/uv.lock`, synchronized `requirements.txt` and `requirements-dev.txt`

- [ ] **Step 1: Update `backend/pyproject.toml` with PEP 621 dependencies, uv config, and wheel source**

Add `[project]` with runtime dependencies, `[dependency-groups] dev` with testing tooling (`pytest`, `pytest-cov`, `pytest-asyncio`, `freezegun`, `httpx`, `ruff`), `[tool.uv] package = false`, and configure `octo-deco` wheel URL:

```toml
[project]
name = "divemap-backend"
version = "0.1.0"
description = "Divemap Backend API"
requires-python = ">=3.11,<3.12"
dependencies = [
    "alembic==1.16.4",
    "anyio==3.6.2",
    "bcrypt==4.3.0",
    "boto3==1.35.0",
    "cachetools==5.5.2",
    "celery==5.3.4",
    "cryptography==45.0.5",
    "email-validator>=2.1.0",
    "fastapi==0.116.1",
    "fastapi-cache2==0.2.1",
    "fitdecode==0.11.0",
    "garmin-fit-sdk==21.158.0",
    "google-auth==2.40.3",
    "google-auth-oauthlib==1.2.2",
    "gunicorn==21.2.0",
    "jinja2==3.1.2",
    "nh3==0.2.20",
    "octo-deco==2.0.3",
    "openai==1.98.0",
    "orjson==3.9.10",
    "passlib[bcrypt]==1.7.4",
    "pillow==10.1.0",
    "psutil==6.1.0",
    "pyasn1==0.6.1",
    "pydantic[email]==2.9.2",
    "pyjwt[crypto]==2.10.1",
    "pymysql==1.1.1",
    "python-dotenv==1.0.0",
    "python-magic==0.4.27",
    "python-multipart==0.0.20",
    "rapidfuzz==3.14.3",
    "redis==5.0.1",
    "reportlab>=4.2.0",
    "slowapi==0.1.9",
    "starlette==0.47.2",
    "tenacity==8.2.3",
    "tiktoken>=0.7.0",
    "uvicorn[standard]==0.24.0",
]

[dependency-groups]
dev = [
    "freezegun==1.5.5",
    "httpx==0.25.2",
    "pytest==7.4.3",
    "pytest-asyncio==0.21.1",
    "pytest-cov==4.1.0",
    "ruff>=0.9.0",
]

[tool.uv]
package = false

[tool.uv.sources]
octo-deco = { url = "https://github.com/kargig/divemap/releases/download/deps-v1/octo_deco-2.0.3-cp311-cp311-linux_x86_64.whl" }
```

- [ ] **Step 2: Generate `uv.lock`**

Run: `cd backend && uv lock`
Expected: Resolves in milliseconds; `octo-deco` is linked to the GitHub release wheel; `backend/uv.lock` is written with SHA-256 hashes for all 111 packages.

- [ ] **Step 3: Export backward-compatible requirements files**

Run:
```bash
cd backend
uv export --frozen --no-dev --no-hashes -o requirements.txt
uv export --frozen --all-groups --no-hashes -o requirements-dev.txt
```
Expected: `backend/requirements.txt` contains pinned production dependencies; `requirements-dev.txt` contains all test/dev dependencies.

- [ ] **Step 4: Verify sync in a clean virtualenv**

Run:
```bash
uv venv /tmp/test_sync_venv --python python3.11
uv sync --directory backend --frozen --python /tmp/test_sync_venv/bin/python
/tmp/test_sync_venv/bin/python -c "import fastapi, sqlalchemy, alembic, octodeco; print('Sync Verified OK')"
rm -rf /tmp/test_sync_venv
```
Expected: Installs in under 1 second; prints `Sync Verified OK`.

---

### Task 3: Streamline Multi-Stage Dockerfile (Zero Compilers)

**Files:**
- Modify: `backend/Dockerfile`

**Interfaces:**
- Consumes: `backend/pyproject.toml`, `backend/uv.lock`
- Produces: Production Docker image built in **under 10 seconds** without `gcc` or `build-essential`.

- [ ] **Step 1: Update `backend/Dockerfile` builder stage**

Replace the builder stage with compiler-free `uv` sync:

```dockerfile
# Stage 1: Builder
# All dependencies have pre-built wheels (including octo-deco via GitHub Release).
# No C-compilers (gcc, build-essential, python3-dev) needed!
FROM python:3.11-slim AS builder

WORKDIR /app

# Install uv from official binary
COPY --from=ghcr.io/astral-sh/uv:0.10.2 /uv /uvx /bin/

# Configure uv environment
ENV UV_COMPILE_BYTECODE=1 
    UV_LINK_MODE=copy

# Create destination virtualenv
RUN uv venv /opt/venv --python python3.11
ENV VIRTUAL_ENV=/opt/venv 
    PATH="/opt/venv/bin:$PATH"

# Copy dependency specifications
COPY pyproject.toml uv.lock ./

# Install production dependencies only using BuildKit cache mount
RUN --mount=type=cache,target=/root/.cache/uv 
    uv sync --frozen --no-dev --no-install-project
```

The runtime stage (`Stage 2: Runtime`) remains unchanged:
```dockerfile
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
...
```

- [ ] **Step 2: Benchmark and verify clean Docker build**

Run:
```bash
time docker build --no-cache -t divemap-backend-uv-test -f backend/Dockerfile backend
docker run --rm divemap-backend-uv-test python -c "import fastapi, sqlalchemy, alembic, octodeco; print('Docker uv build OK')"
docker rmi divemap-backend-uv-test
```
Expected: Build completes in **~8–10 seconds** (down from 121 seconds); prints `Docker uv build OK`.

---

### Task 4: Update Test Harness & Scripts

**Files:**
- Modify: `backend/docker-test-github-actions.sh`
- Modify: `backend/run_alembic_check.sh`
- Modify: `backend/docker-compose.test.yml`

**Interfaces:**
- Consumes: `backend/pyproject.toml`, `backend/uv.lock`
- Produces: Ultra-fast ephemeral test builds for `cd backend && ./docker-test-github-actions.sh`

- [ ] **Step 1: Update `backend/docker-test-github-actions.sh`**

Remove `gcc`, `python3-dev`, and `build-essential` from the test base image, and install dependencies via `uv sync`:

```bash
# In backend/docker-test-github-actions.sh:
cat > Dockerfile.test << 'EOF'
FROM python:3.11-slim AS base
RUN apt-get update && apt-get install -y 
    pkg-config 
    netcat-openbsd 
    default-mysql-client 
    libmagic1 
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:0.10.2 /uv /uvx /bin/
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY pyproject.toml uv.lock ./
RUN uv venv /app/divemap_venv --python python3.11
ENV VIRTUAL_ENV=/app/divemap_venv PATH="/app/divemap_venv/bin:$PATH"
RUN --mount=type=cache,target=/root/.cache/uv 
    uv sync --frozen --no-install-project

FROM base AS final
COPY . .
RUN mkdir -p uploads && chmod +x /app/run_migrations.py /app/startup.sh
ENV GITHUB_ACTIONS=true 
    DATABASE_URL=mysql+pymysql://root:password@divemap-test-mysql:3306/divemap_test 
    SECRET_KEY=test-secret-key-for-ci 
    ENVIRONMENT=ci 
    GOOGLE_CLIENT_ID=dummy-client-id-for-testing
EXPOSE 8000
EOF
```

- [ ] **Step 2: Update `backend/run_alembic_check.sh`**

```bash
docker run --rm --network divemap-alembic-network -v "$(pwd):/app" -w /app python:3.11-slim bash -c "
    apt-get update && apt-get install -y default-mysql-client pkg-config default-libmysqlclient-dev && 
    pip install uv && 
    uv pip install --system -r requirements.txt && 
    export DATABASE_URL=mysql+pymysql://root:password@divemap-alembic-mysql:3306/divemap_test && 
    alembic upgrade head && 
    echo '---- RUNNING ALEMBIC CHECK ----' && 
    alembic check
"
```

- [ ] **Step 3: Run the test suite using `docker-test-github-actions.sh`**

Run:
```bash
cd backend && ./docker-test-github-actions.sh --force-rebuild tests/test_simple.py
```
Expected: Test container builds in seconds and tests pass with `All tests passed!`.

---

### Task 5: Accelerate GitHub Actions CI Workflows

**Files:**
- Modify: `.github/workflows/backend-tests.yml`
- Modify: `.github/workflows/backend-lint-format.yml`

**Interfaces:**
- Consumes: `backend/uv.lock`, `backend/pyproject.toml`
- Produces: GitHub Actions CI with sub-15s dependency setup

- [ ] **Step 1: Update `.github/workflows/backend-tests.yml`**

Replace Python setup and pip steps with `astral-sh/setup-uv@v5`:

```yaml
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Install uv and Set up Python
      uses: astral-sh/setup-uv@v5
      with:
        version: "0.10.2"
        enable-cache: true
        cache-dependency-glob: "backend/uv.lock"

    - name: Install dependencies
      run: |
        cd backend
        uv venv divemap_venv --python 3.11
        uv sync --frozen
```

- [ ] **Step 2: Update `.github/workflows/backend-lint-format.yml`**

```yaml
      - name: Install uv
        uses: astral-sh/setup-uv@v5
        with:
          version: "0.10.2"
          enable-cache: true

      - name: Install Ruff
        run: uv tool install "ruff>=0.9.0"
```

---

### Task 6: Update Makefile, Local Virtualenv, and Developer Docs

**Files:**
- Modify: `Makefile`
- Modify: `docs/development/README.md`

**Interfaces:**
- Consumes: `uv` CLI
- Produces: Convenient developer targets and clear documentation

- [ ] **Step 1: Add helper targets to `Makefile`**

```makefile
# Sync backend virtualenv with uv
backend-sync:
	@echo "📦 Syncing backend dependencies with uv..."
	@cd backend && uv sync
	@echo "✅ Backend dependencies synced."

# Lock backend dependencies with uv
backend-lock:
	@echo "🔒 Updating uv.lock and exporting requirements.txt..."
	@cd backend && uv lock && uv export --frozen --no-dev --no-hashes -o requirements.txt && uv export --frozen --all-groups --no-hashes -o requirements-dev.txt
	@echo "✅ Lockfile and requirements updated."
```

- [ ] **Step 2: Update `backend/divemap_venv` on host**

Run:
```bash
cd backend && uv sync --python divemap_venv/bin/python
```
Verify Ruff runs cleanly:
```bash
make lint-backend
```
Expected: `Backend linting complete.`

- [ ] **Step 3: Update documentation in `docs/development/README.md`**

Add instructions on using `uv` for local setup, installing dependencies with `uv sync`, adding packages with `uv add`, and locking with `uv lock`.

---

## Verification & Expected Final Benchmarks

1. **Benchmark Comparison**:
   - Docker builder stage cold: drops from **121.4s** down to **~8-10s** (~12x faster).
   - Docker builder step (`uv sync`): drops from **83.1s** down to **~1-2s** (~40x faster).
   - CI environment setup: drops from **~90s** down to **~10-15s**.
2. **Deterministic Locking Verification**:
   - `backend/uv.lock` contains all direct and transitive dependencies with cryptographic SHA-256 hashes.
   - `uv lock --check` in `backend/` passes.
3. **Full Test Execution**:
   - `cd backend && ./docker-test-github-actions.sh` passes 100%.
4. **Code Quality**:
   - `make lint-backend` passes with zero violations.
