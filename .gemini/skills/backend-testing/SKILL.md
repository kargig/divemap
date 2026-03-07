---
name: backend-testing
description: Standard operating procedure for running tests in the Divemap backend. Crucial for understanding when to use the lightweight SQLite test runner versus the heavy, isolated MySQL Docker test suite.
---

# Backend Testing Helper

Divemap uses two distinct testing environments. Knowing which one to use is critical for preventing false negatives, masking MySQL-specific syntax errors, and maintaining a fast development loop.

## The Two Testing Environments

### 1. Local SQLite Testing (Fast, Lightweight)
*   **How:** Executing `pytest` directly via the virtual environment (`backend/divemap_venv/bin/pytest`).
*   **What it does:** Spools up a local SQLite database in memory or file (`test.db`).
*   **Pros:** Blazing fast. Excellent for TDD on pure business logic, schemas, and simple CRUD operations.
*   **Cons:** **SQLite is NOT MySQL.** It does not support advanced MySQL features like:
    *   Spatial Data Types (`POINT`, `ST_Distance_Sphere`)
    *   Specific `sqlalchemy.dialects.mysql` types (e.g., `LONGTEXT`, `LargeBinary` sometimes behaves differently).
    *   Strict Enum constraints.
*   **When to use:** When you are making minor logic tweaks or testing code that does not touch database models or raw SQL queries.

### 2. Isolated Docker MySQL Testing (Robust, Production-Parity)
*   **How:** Executing `backend/docker-test-github-actions.sh [path/to/test.py]`
*   **What it does:** Completely tears down and rebuilds an isolated Docker network with a real MySQL 8.0 container and a fresh Python container. It runs Alembic migrations from scratch to build the schema exactly as it would in production.
*   **Pros:** Guarantees production parity. Catches MySQL-specific syntax errors (like the `CompileError` on `LONGTEXT`). Isolates tests completely from your host machine's state.
*   **Cons:** Slow. Takes ~10-20 seconds just to spin up the containers before tests even begin.
*   **When to use:** **ALWAYS use this when modifying `models.py`, adding new Alembic migrations, or writing tests that touch the database.**

## Standard Operating Procedure

1.  **Model/Migration Changes:** If your work involves altering `backend/app/models.py` or generating new Alembic migrations, you **MUST NOT** use the SQLite runner. You must use `docker-test-github-actions.sh`.
2.  **Debugging `docker-test-github-actions.sh`:**
    *   By default, the script runs in "Silent Mode" and saves output to `backend/test-failures.txt`.
    *   If tests fail, use the `-v` flag to see the live output and debug:
        ```bash
        cd backend && ./docker-test-github-actions.sh -v tests/test_your_file.py
        ```
3.  **Preventing SQLite False Positives:** If you see errors like `CompileError: ... can't render element of type LONGTEXT`, this means the code contains MySQL-specific syntax that SQLite cannot compile. This is a hard signal that you must switch to the Docker runner.

## Quick Reference Commands

| Goal | Command |
| :--- | :--- |
| Fast Logic Test (SQLite) | `cd backend && ./divemap_venv/bin/pytest tests/test_file.py -v` |
| Full DB Test (MySQL) | `cd backend && ./docker-test-github-actions.sh tests/test_file.py` |
| Debug Full DB Test (Verbose) | `cd backend && ./docker-test-github-actions.sh -v tests/test_file.py` |
