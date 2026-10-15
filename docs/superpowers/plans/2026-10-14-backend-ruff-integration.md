# Backend Ruff Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Ruff as the primary Python linter, import sorter, and code formatter for Divemap's FastAPI backend, with Alembic hooks, Makefile targets, and GitHub Actions CI verification.

**Architecture:** Configure Ruff via `backend/pyproject.toml` targeting Python 3.11 with exclusions for virtual environments, test caches, and relaxed rules for Alembic migrations. Add automated post-write hooks to `backend/alembic.ini`. Expose standard developer targets in `Makefile` and automate CI checking in GitHub Actions.

**Tech Stack:** Python 3.11, Ruff (>=0.9.0 / 0.17.0), FastAPI, SQLAlchemy 2, Alembic, GitHub Actions, Make.

## Global Constraints

- Never use `git add` or `git commit -m`. Prepare commit messages in `commit-message.txt`.
- Python virtual environment is strictly at `backend/divemap_venv`.
- FastAPI `Depends()` and `Query()` defaults must not trigger `B008`.
- Backend tests must be verified using `./docker-test-github-actions.sh`.
- Avoid mass unintended refactors; maintain existing style and runtime stability.

---

### Task 1: Add Ruff Dependency & Pyproject Configuration

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/pyproject.toml`

**Interfaces:**
- Produces: `backend/pyproject.toml` tool configuration recognized by `ruff check` and `ruff format`.

- [ ] **Step 1: Add Ruff to `backend/requirements.txt`**
Add `ruff>=0.9.0` to `backend/requirements.txt`.

- [ ] **Step 2: Create `backend/pyproject.toml`**
Write configuration with:
```toml
[tool.ruff]
target-version = "py311"
line-length = 88
extend-exclude = [
    "divemap_venv",
    ".pytest_cache",
    "htmlcov",
]

[tool.ruff.lint]
select = [
    "E",      # pycodestyle errors
    "W",      # pycodestyle warnings
    "F",      # Pyflakes (unused imports, undefined variables)
    "I",      # isort
    "B",      # flake8-bugbear
    "UP",     # pyupgrade (Python 3.11 idioms)
]
ignore = [
    "B008",   # Do not perform function calls in argument defaults (FastAPI Depends/Query)
    "E501",   # Line too long (handled by ruff format)
]

[tool.ruff.lint.per-file-ignores]
"migrations/versions/*" = ["E501", "F401", "I001"]
"tests/*" = ["B018", "F401", "F811"]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
line-ending = "auto"
```

- [ ] **Step 3: Verify Ruff recognizes the configuration**
Run: `backend/divemap_venv/bin/ruff check backend/app --select F`
Expected: Successfully parses configuration and outputs findings.

---

### Task 2: Configure Alembic Post-Write Hooks

**Files:**
- Modify: `backend/alembic.ini`

- [ ] **Step 1: Enable Ruff post-write hooks in `backend/alembic.ini`**
Update the post-write hooks section in `backend/alembic.ini`:
```ini
hooks = ruff_check, ruff_format

[post_write_hook.ruff_check]
type = exec
executable = %(here)s/divemap_venv/bin/ruff
options = check --fix REVISION_SCRIPT_FILENAME

[post_write_hook.ruff_format]
type = exec
executable = %(here)s/divemap_venv/bin/ruff
options = format REVISION_SCRIPT_FILENAME
```

- [ ] **Step 2: Verify `backend/alembic.ini` configuration syntax**
Run `backend/divemap_venv/bin/alembic check` or verify syntax validity.

---

### Task 3: Add Makefile Targets for Backend Linting & Formatting

**Files:**
- Modify: `Makefile`

- [ ] **Step 1: Add `lint-backend` and `lint-backend-fix` targets**
Add targets in `Makefile`:
```makefile
# Run backend linting and formatting check
lint-backend:
	@echo "🧹 Checking backend formatting and linting with Ruff..."
	@cd backend && ./divemap_venv/bin/ruff check . && ./divemap_venv/bin/ruff format --check .

# Fix backend linting issues and format code
lint-backend-fix:
	@echo "🛠️ Fixing backend lint errors and formatting with Ruff..."
	@cd backend && ./divemap_venv/bin/ruff check --fix . && ./divemap_venv/bin/ruff format .
```
Update `.PHONY` and `help` section to list the new targets alongside `lint-frontend`.

- [ ] **Step 2: Test Makefile targets**
Run: `make help | grep lint-backend`
Expected: Shows available targets.

---

### Task 4: Configure GitHub Actions CI Workflow for Backend Lint & Format

**Files:**
- Create: `.github/workflows/backend-lint-format.yml`

- [ ] **Step 1: Create `.github/workflows/backend-lint-format.yml`**
Mirror `frontend-lint-format.yml` pattern:
```yaml
name: Backend Lint & Format

on:
  push:
    branches: [main, master]
    paths:
      - 'backend/**'
      - '.github/workflows/backend-lint-format.yml'
  pull_request:
    paths:
      - 'backend/**'
      - '.github/workflows/backend-lint-format.yml'
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-format:
    name: Ruff Lint and Format
    runs-on: ubuntu-latest

    defaults:
      run:
        working-directory: backend

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install Ruff
        run: pip install "ruff>=0.9.0"

      - name: Check Formatting
        run: ruff format --check .

      - name: Check Linting
        run: ruff check .
```

- [ ] **Step 2: Validate YAML syntax**
Ensure workflow schema and path triggers match repository conventions.

---

### Task 5: Baseline Verification & Testing

**Files:**
- Verification only

- [x] **Step 1: Test `make lint-backend`**
Run `make lint-backend` to inspect current output and verify the tooling runs cleanly.

- [x] **Step 2: Run isolated backend tests**
Run: `cd backend && ./docker-test-github-actions.sh tests/test_simple.py`
Expected: `All tests passed!` ensuring zero environmental or runtime degradation.

---

## Ignore List Classification & Future Removal Roadmap

The current `backend/pyproject.toml` ignore list is split into **Permanent Project Standards** (which should stay ignored) and **Temporary Phased Ignores** (which can be removed in future focused PRs).

```toml
ignore = [
    # --- Permanent Project Standards (DO NOT REMOVE) ---
    "B008",   # FastAPI Depends() and Query() defaults
    "B904",   # FastAPI route handlers raise HTTPException without exception chaining
    "E402",   # Startup setup (logging, warnings filters) before local imports
    "E712",   # SQLAlchemy boolean column filters (e.g., Model.is_active == True)
    "E501",   # Line length limit (delegated to ruff format)
    "E701",   # Single-line statement colon splits (delegated to ruff format)
    "W291",   # Trailing whitespace (delegated to ruff format)
    "W292",   # Missing EOF newline (delegated to ruff format)
    "W293",   # Whitespace on blank lines (delegated to ruff format)

    # --- Temporary Ignores (Gradual Adoption Roadmap) ---
    "UP042",  # Inherit from enum.StrEnum instead of (str, enum.Enum) (7 occurrences)
    "UP006",  # Use built-in generic types: list[T] instead of List[T] (~440 occurrences)
    "UP035",  # Deprecated typing imports: typing.List, typing.Dict (~123 occurrences)
    "UP045",  # Use pipe syntax: T | None instead of Optional[T] (~1,360 occurrences)
]
```

### 1. Permanent Project Standards (Rationale)

- **`B008` (Function call in argument defaults)**:
  - *Why permanent:* FastAPI relies on default parameter injection for `Depends()`, `Query()`, `Path()`, `Header()`, and `Body()`. Disabling `B008` is standard in all FastAPI projects.
- **`B904` (Exception chaining with `from e`)**:
  - *Why permanent for web routes:* In route handlers, `raise HTTPException(...)` converts caught errors into JSON responses for clients. Enforcing `raise ... from e` exposes noisy internal tracebacks in API logs for expected client errors.
- **`E712` (Comparison to `True`/`False`)**:
  - *Why permanent:* SQLAlchemy SQL expressions (e.g. `query.filter(User.is_active == True)`) construct SQL clauses (`= 1` / `= 0`), which differ semantically from Python boolean tests (`if user.is_active:`).
- **`E402` (Module import not at top of file)**:
  - *Why permanent:* `app/main.py` requires running `warnings.filterwarnings()` and logging setup before third-party libraries (e.g. `passlib`) are imported.
- **Formatting Rules (`E501`, `E701`, `W291`, `W292`, `W293`)**:
  - *Why permanent:* Ruff's official documentation explicitly recommends disabling whitespace and formatting-related linter rules when using `ruff format` to prevent conflicting or redundant errors.

---

### 2. Next Steps: Phased Rule Removal Roadmap

The following rules can be systematically removed in future PRs:

#### Phase 1: `UP042` — StrEnum Adoption (Low Effort, 7 occurrences)
- **Target Files**:
  - `backend/app/models.py` (`BusinessChatStatus`, `EditRequestStatus`, `EditRequestType`)
  - `backend/app/schemas/__init__.py` (`AvatarType`, `RouteType`)
  - `backend/app/schemas/chat.py` (`ChatMessageRole`, `IntentType`)
- **Action**:
  1. Change `class Foo(str, enum.Enum)` to `class Foo(enum.StrEnum)`.
  2. Verify that SQLAlchemy `Column(Enum(Foo))` and Pydantic schema validation serialize correctly without breaking database compatibility.
  3. Remove `"UP042"` from `backend/pyproject.toml`.

#### Phase 2: `UP006` & `UP035` — PEP 585 Built-in Generics (~440 occurrences)
- **What it does**: Replaces `List[T]` $\to$ `list[T]`, `Dict[K, V]` $\to$ `dict[K, V]`, `Set[T]` $\to$ `set[T]`, `Tuple[...]` $\to$ `tuple[...]` (native in Python 3.9+).
- **Recommended Strategy**: Can be executed safely in 2 focused PRs:
  - PR 1: `backend/app/services/` and `backend/app/schemas/`
  - PR 2: `backend/app/routers/`
- **Execution Command**:
  ```bash
  ruff check backend/app --select UP006,UP035 --fix
  ```
- **Completion**: Remove `"UP006"` and `"UP035"` from `backend/pyproject.toml`.

#### Phase 3: `UP045` — PEP 604 Optional Syntax (`T | None`) (~1,360 occurrences)
- **What it does**: Replaces `Optional[T]` with `T | None` (native in Python 3.10+).
- **Recommended Strategy**: Because this touches almost every file in `backend/app`, run it in a dedicated standalone PR:
  ```bash
  ruff check backend/app --select UP045 --fix
  ```
- **Completion**: Remove `"UP045"` from `backend/pyproject.toml`.

#### Phase 4: Full Codebase Formatting & `.git-blame-ignore-revs`
- **What it does**: Formats all backend files with `ruff format` to achieve 100% style consistency.
- **Action**:
  1. Run `ruff format backend/app`.
  2. Create a dedicated standalone commit: `Format backend codebase with ruff format`.
  3. Append the commit SHA to `.git-blame-ignore-revs` so Git and GitHub blame attribution remains clean.
  4. In `.github/workflows/backend-lint-format.yml`, promote `ruff format --check` from an informative warning to a blocking check (`ruff format --check backend/app`).

