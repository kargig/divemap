# Database Schema Alignment Plan & Implementation Record

## Overview
This document outlines the plan and the subsequent implementation to resolve the significant "Schema Drift" identified between the SQLAlchemy models and the physical database state.

## Identified Issues

### 1. Column Type Mismatch (Year 2038 Risk)
*   **Problem:** Multiple columns (e.g., `users.created_at`, `dive_sites.updated_at`) used the MySQL `TIMESTAMP` type.
*   **Risk:** `TIMESTAMP` has a maximum limit of January 19, 2038.
*   **Resolution:** Converted all `TIMESTAMP` columns to `DATETIME(6)` to match the SQLAlchemy `DateTime` model definition.
*   **Implementation Note:** Manual alterations were added for tables like `available_tags` and `center_comments` which were initially missed by autogenerate.

### 2. Index Naming Convention Drift
*   **Problem:** Inconsistent naming between `idx_` (manual) and `ix_` (Alembic default).
*   **Resolution:** Standardized all indexes to use the `ix_` prefix to align with SQLAlchemy/Alembic autogeneration defaults.

## Implementation Details (Completed)

### Migration 0057: Robust Execution
The migration `0057_align_schema_conventions.py` was implemented with a high focus on safety and idempotency:

1.  **Operation Reordering:** To prevent foreign key constraint violations during index changes, the migration follows this strict order:
    *   **Drop Foreign Keys** (all tables involved).
    *   **Drop Old Indexes** (`idx_` naming).
    *   **Alter Columns** (`TIMESTAMP` -> `DATETIME`).
    *   **Create New Indexes** (`ix_` naming).
    *   **Recreate Foreign Keys**.
2.  **Idempotency Helpers:** 
    *   `safe_drop_index`: Wraps `op.drop_index` in try-except to handle cases where an index might have been manually removed or differently named.
    *   `safe_create_index`: Wraps `op.create_index` to prevent "Duplicate key name" errors if an index already exists.
3.  **Timezone Safety:** Documented that migration should be run with session `time_zone = '+00:00'` to ensure `TIMESTAMP` (UTC-based) converts accurately to `DATETIME`.

### Regression Testing
A new test was added to ensure this drift never returns:
*   **File:** `backend/tests/test_schema_validation.py`
*   **Logic:** Queries `information_schema.COLUMNS` to verify that no `TIMESTAMP` types exist in the application schema.
*   **Verification:** Verified using `./docker-test-github-actions.sh` against a fresh database.

## Post-Implementation Standards
*   **Always Validate:** New migrations must be validated against a clean database using:
    ```bash
    cd backend
    ./docker-test-github-actions.sh
    ```
*   **Prefixes:** Always use `ix_` for indexes (automatic if using `index=True` in SQLAlchemy models).
