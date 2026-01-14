# Divemap Project Context

## Project Overview
Divemap is a comprehensive web application designed for scuba diving enthusiasts to discover, rate, and review dive sites and centers. It features user management, dive logging, interactive maps, and social sharing capabilities.

### Tech Stack
- **Frontend:** React (Create React App), Tailwind CSS, OpenLayers, React Query, React Router DOM.
- **Backend:** Python (FastAPI), SQLAlchemy (ORM), Alembic (Migrations), PyJWT (Auth).
- **Database:** MySQL (Version 8.0/LTS).
- **Infrastructure:** Docker, Docker Compose, Nginx (Reverse Proxy), Fly.io (Production Deployment).
- **External Services:** Google Identity Services (OAuth), OpenAI API (Newsletter Parsing).

## Core Project Standards
- **Docker First:** Always use Docker to manage containers. Never start services directly on the host system.
- **Python Environment:** Always use the virtual environment at `backend/divemap_venv`.
- **Node.js Operations:** Use `docker exec` for frontend commands (e.g., `docker exec divemap_frontend npm install`).
- **Security:** Never install packages globally. Use `.env` files and never commit secrets.

### Frontend Verification Standards
- **Browser Verification:** Every frontend modification MUST be verified by visiting the affected page(s) using the browser MCP tools (`navigate_page`, `take_snapshot`).
- **Console Errors:** You MUST check the browser console for errors after every navigation or interaction using `list_console_messages` or `get_console_message`. Zero console errors are the target.
- **Routing & Navigation:** When modifying routes (e.g., adding slugs):
  - Verify the **New URL** loads correctly.
  - Verify the **Old URL** redirects correctly (backward compatibility).
  - Verify **Links** pointing to these routes are updated and working.
- **Global Styles:** Changes to global CSS or HTML (e.g., `index.html`, `App.js` layout) MUST be verified across multiple diverse pages (e.g., Home, List Views, Detail Views) to ensure no unintended layout regressions.

## Git Workflow & Standards
- **Feature Branches:** ALWAYS create a feature branch for changes: `feature/[task-name-kebab-case]`.
- **No Direct Commits:** NEVER work directly on `main` or `master`.
- **Git Restrictions:** NEVER attempt to use `git add` or `git commit -m`. These actions are forbidden. All commits should be prepared via `commit-message.txt` for the user to execute manually.
- **Commit Messages:**
  - Limit subject to 50 characters, capitalize, no period.
  - Use imperative mood ("Add", "Fix", "Update").
  - Wrap body at 72 characters.
  - Separate subject from body with a blank line.

## Development Workflow

### Prerequisites
- Docker & Docker Compose
- Node.js (for local frontend dev/testing)
- Python 3.11+ (for local backend dev/testing)

### Running the Application (Local)
To start the entire stack in development mode:
```bash
docker-compose up -d
```
- **Frontend:** http://localhost
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

### Testing
⚠️ **CRITICAL SAFETY WARNING:** NEVER run tests inside the `divemap_backend` container (e.g., `docker-compose exec backend pytest`). It connects to the live development database, and the test suite's teardown process WILL WIPE THE DATABASE.

**Correct Testing Methods:**
1.  **Isolated Docker (Recommended - Token Efficient):**
    This script sets up a separate, ephemeral test environment. By default, it runs in **silent mode**, suppressing build and setup logs to save context tokens.
    ```bash
    cd backend
    ./docker-test-github-actions.sh [tests/test_file.py]
    ```
    - **Success:** Returns `All tests passed!`.
    - **Failure:** Returns `Tests failed!` and saves the error log to `test-failures.txt`.
    - **Debugging:** Agents should inspect `backend/test-failures.txt` to identify issues without reading thousands of lines of build output.
    - **Verbose Mode:** Use `-v` (e.g., `./docker-test-github-actions.sh -v`) for full output (not recommended for agents).

2.  **Host Venv (Alternative):**
    ```bash
    cd backend
    source divemap_venv/bin/activate
    export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"
    export GOOGLE_CLIENT_ID="dummy-client-id-for-testing"
    python -m pytest tests/ -v
    ```

**Disaster Recovery:**
If the database is accidentally wiped, check `database_backups/` for recent SQL dumps and restore using:
```bash
cat database_backups/<backup_file> | docker-compose exec -T db mysql -u divemap_user -pdivemap_password divemap
```

**Frontend Tests:**
```bash
# Manual (in frontend/ dir)
npm test
node tests/run_frontend_tests.js
```

### Database Management
Migrations are handled by Alembic.

**Creating Migrations:**
⚠️ **Naming Convention:** Migration files MUST be named sequentially, e.g., `0053_description_of_change.py`.
⚠️ **Creation Method:** ALWAYS create migrations inside the backend container to ensure correct environment and dependencies. Do NOT use the host's `alembic` command directly if possible, or ensure correct environment variables. The `create_migration.py` helper script is deprecated or should be used with caution regarding file naming.

**Recommended Workflow:**
1.  **Generate Migration:**
    ```bash
    docker-compose exec backend alembic revision --autogenerate -m "description_of_change"
    ```
2.  **Rename File:** Locate the generated file in `backend/migrations/versions/` (it will have a random hash) and rename it to follow the sequential pattern (e.g., `0053_...`).
3.  **Review:** Open the file and verify it ONLY contains the changes you intended. Remove unrelated auto-generated changes if any.
4.  **Fix Permissions:** If created via Docker, the file might be owned by root. Change ownership to your user:
    ```bash
    sudo chown $USER:$USER backend/migrations/versions/0053_...
    ```
5.  **Validation:** After creating and renaming the migration, verify that it (and all previous migrations) can run successfully from scratch against a temporary database:
    ```bash
    cd backend
    ./docker-test-github-actions.sh
    ```
    This prevents broken migrations from reaching production.
6.  **Debugging:** Agents should inspect `backend/test-failures.txt` to identify issues without reading thousands of lines of build output.

**Running Migrations (Local Dev):**
```bash
docker-compose exec backend python run_migrations.py
```

## Key Directories & Files
- **`REPO_MAP.md`**: **START HERE** for an overview of the codebase structure and module purposes.
- **`backend/`**: Contains the FastAPI application.
    - `app/`: Main application logic.
    - `divemap_venv/`: Required Python virtual environment.
- **`frontend/`**: Contains the React application.
- **`.cursor/rules/`**: Modularized project rules and standards.
- **`docs/`**: Extensive project documentation (deployment, API, testing).
- **`docker-compose.yml`**: Service definitions.

## Documentation
Documentation is consolidated in the `docs/` directory. Major changes should be reflected in the relevant documentation files to prevent information pollution.

## Form Validation & Schemas
- **Frontend Validation:** ALWAYS use Zod schemas defined in `frontend/src/utils/formHelpers.js` for form validation.
  - Avoid inline validation in components.
  - Ensure schemas match backend constraints to prevent 422 errors.
  - Use `FormField` components to consistently display validation errors.
- **Backend Validation:** Use Pydantic schemas in `backend/app/schemas.py`.
  - Enforce strict validation (e.g., HTTPS for URLs, specific domains for platforms).
  - Use validators to sanitize and check complex logic (e.g., preventing phone numbers in social links).

## Performance Tuning Guidelines
- **JSON Processing:**
  - Prefer `orjson` over the standard `json` library for serialization (`dumps`) and deserialization (`loads`) in performance-critical paths (e.g., large API responses, data processing).
  - `orjson.dumps` returns `bytes`. Use `.decode('utf-8')` if a string is strictly required (e.g., headers).
  - **Dictionary Keys:** `orjson` requires string keys by default. To serialize dictionaries with non-string keys (e.g., integers), use the `option=orjson.OPT_NON_STR_KEYS` parameter.
  - Use `orjson.OPT_INDENT_2` for pretty printing in debug logs.
  - **Benchmark Results (Local):** `orjson` showed ~11x speedup for serialization and ~1.5x speedup for deserialization compared to standard `json` on sample data.
- **Data Structures & Validation:**
  - **Avoid Re-allocation:** In Pydantic validators (`@validator`) and frequently called functions, define constant data structures (lists, dicts, sets) at the module level (e.g., `ALLOWED_PLATFORMS`) instead of re-creating them inside the function.
  - **Membership Checks:** Use `set` or `dict` for checking existence (`item in collection`) instead of `list` when the collection is static or large, to achieve O(1) lookup performance.
- **Memory Management:**
  - Be mindful of object creation overhead. Use `__slots__` for classes that will have many instances (thousands+) to reduce memory footprint, though this is less relevant for standard Pydantic/SQLAlchemy models which handle this internally or differently.

## Testing & Linting
-  Always run `make lint-frontend` instead of `docker exec divemap_frontend npm run lint` for frontend linting. Then check the contents of `frontend-lint-errors.log` for errors
