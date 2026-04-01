---
name: backend-testing
description: Mandatory standard operating procedure for running tests in the Divemap backend. Explicitly forbids direct pytest commands that cause data loss and explains SQLite incompatibility.
---

# 🚨 DANGER: Backend Testing Protocol 🚨

Divemap uses an isolated Docker MySQL test environment. **DO NOT run pytest directly inside the backend container or virtual environment.**

The test suite contains a teardown step (`Base.metadata.drop_all(bind=engine)`) that WILL **wipe out the entire development database** if it runs against the live connection string.

## The ONLY Permitted Testing Method: Isolated Docker MySQL
*   **How:** Executing `backend/docker-test-github-actions.sh [path/to/test.py]`
*   **What it does:** Completely tears down and rebuilds an isolated Docker network with a real MySQL 8.0 container and a fresh Python container. It runs Alembic migrations from scratch to build the schema safely.
*   **Pros:** Guarantees production parity. Protects the live development database from being dropped. Catches MySQL-specific syntax errors.
*   **Cons:** Slower than raw pytest (~10-20s startup), but strictly necessary for safety.

## Standard Operating Procedure

1.  **NEVER RUN `pytest` DIRECTLY:** 
    *   ❌ `docker-compose exec backend pytest` -> **FORBIDDEN. WILL WIPE DATABASE.**
    *   ❌ `cd backend && ./divemap_venv/bin/pytest` -> **FORBIDDEN. SQLite is incompatible and will crash.**
    *   ✅ `cd backend && ./docker-test-github-actions.sh` -> **SAFE AND REQUIRED.**
2.  **Why SQLite is Unsupported:** 
    Divemap uses native MySQL features like **Spatial Data Types (`POINT`)** and **`LONGTEXT`**. Because the test suite builds the schema from scratch using `Base.metadata.create_all`, any attempt to run `pytest` against SQLite will fail immediately with a `CompileError`.
3.  **Debugging `docker-test-github-actions.sh`:**
    *   By default, the script runs in "Silent Mode" and saves output to `backend/test-failures.txt`.
    *   If tests fail, **read the `test-failures.txt` file** rather than executing the script in verbose mode immediately.
    *   If you need live output to debug hanging tests, use the `-v` flag:
        ```bash
        cd backend && ./docker-test-github-actions.sh -v tests/test_your_file.py
        ```
4.  **Preventing Database Wipes:** A hard fail-safe has been added to `conftest.py` that will abort the test suite if it detects the live database URL. However, you must still adhere to this protocol.

## Quick Reference Commands

| Goal | Command |
| :--- | :--- |
| Run Specific Test (Safe) | `cd backend && ./docker-test-github-actions.sh tests/test_file.py` |
| Debug Full DB Test (Verbose) | `cd backend && ./docker-test-github-actions.sh -v tests/test_file.py` |
| View Test Output | `cat backend/test-failures.txt` |
