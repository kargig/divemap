---
name: alembic-helper
description: Assists with Alembic database migrations in Python projects. Use when generating, applying, or debugging database schema migrations to ensure consistency and prevent conflicts.
---

# Alembic Helper

This skill provides a safe and consistent workflow for managing database migrations with Alembic. It is designed to prevent common issues like revision ID conflicts, non-sequential file naming, and safe rollback procedures.

## Core Principles

1.  **Check Before Generate**: Always check the current database head revision before creating a new migration to avoid divergence.
2.  **Sequential Naming**: Enforce strict sequential naming (e.g., `0063_description.py`) for migration files to maintain readable history.
3.  **Verify Content**: Always inspect auto-generated migrations for correctness before applying them.
4.  **Safe Rollback**: Know how to safely revert changes if a migration fails.

## Workflows

### 1. Generating a New Migration

**Goal**: Create a new migration file that captures changes in `models.py`.

1.  **Check Current Head**:
    ```bash
    docker-compose exec backend alembic current
    ```
    Or check the latest file in `migrations/versions/`.

2.  **Generate Migration**:
    ```bash
    docker-compose exec backend alembic revision --autogenerate -m "description_of_change"
    ```

3.  **Rename and Enforce Convention**:
    *   Locate the new file in `backend/migrations/versions/`. It will have a random hash ID (e.g., `1a2b3c4d5e6f_description.py`).
    *   **CRITICAL**: Check the `/home/kargig/src/divemap/backend/migrations/versions/` directory to find the TRUE latest revision number (e.g., if the latest file is `0067_...`, the next is `0068`).
    *   Rename the new file to the next sequence number (e.g., `0068_description.py`).
    *   **CRITICAL REQUIREMENT**: The `revision` variable inside the file MUST match the new file prefix exactly (e.g., '0068').
        *   Open the file and manually edit the line: `revision = '1a2b...'` -> `revision = '0068'`.
        *   Also update the docstring at the top of the file to reflect the new revision ID.
    *   **CRITICAL**: You MUST verify that the `down_revision` inside the file accurately points to the ID of the immediately preceding migration (e.g., '0067').

4.  **Review Content**:
    *   Read the generated file.
    *   Ensure it only contains intended changes.
    *   Remove any unintended `drop_table` or `drop_column` directives that might be artifacts of environment issues.
    *   **Remove Spatial Index noise**: Alembic often generates false-positive `drop_index` commands for MySQL spatial columns. Remove them.

### 2. Dynamic Foreign Key Resolution (Avoiding `_ibfk_` Drift)

**Goal**: Prevent migrations from crashing on fresh test databases due to auto-generated foreign key name drift (e.g., `_ibfk_2` in dev vs `_ibfk_1` in test).

If your migration involves modifying or dropping a foreign key constraint:
1.  **NEVER hardcode `_ibfk_` names.**
2.  **When creating a FK**: Pass `None` as the constraint name so MySQL auto-generates it safely.
    ```python
    op.create_foreign_key(None, 'my_table', 'users', ['user_id'], ['id'], ondelete='CASCADE')
    ```
3.  **When dropping a FK**: Use SQLAlchemy's `Inspector` to dynamically look up the name of the constraint based on the column, rather than hardcoding it. Add these helper functions to the top of your migration file:

    ```python
    from sqlalchemy.engine.reflection import Inspector
    import sqlalchemy as sa

    def get_fk_name(table_name, column_name):
        bind = op.get_bind()
        inspector = sa.inspect(bind)
        for fk in inspector.get_foreign_keys(table_name):
            if column_name in fk['constrained_columns']:
                return fk['name']
        return None

    def safe_drop_fk(table_name, column_name):
        fk_name = get_fk_name(table_name, column_name)
        if fk_name:
            op.drop_constraint(fk_name, table_name, type_='foreignkey')
    ```
4.  Then in your `upgrade()` or `downgrade()`, simply call:
    ```python
    safe_drop_fk('my_table', 'user_id')
    ```

### 3. Applying Migrations

**Goal**: Apply pending migrations to the database.

1.  **Upgrade to Head**:
    ```bash
    docker-compose exec backend alembic upgrade head
    ```
    *   Or use the project's wrapper script if available (e.g., `python run_migrations.py`).

2.  **Verify**:
    *   Check `alembic current` again to confirm the new revision is active.

### 3. Handling Conflicts & Rollbacks

**Goal**: Fix a failed migration or a divergence error.

**Scenario A: "Multiple head revisions are present"**
*   This means two migrations claim the same `down_revision`.
*   **Fix**: Merge the heads or manually edit the `down_revision` of the newer file to point to the older "head".

**Scenario B: Migration Failed / Error during Upgrade**
1.  **Rollback**:
    ```bash
    docker-compose exec backend alembic downgrade -1
    # OR specify the revision ID
    docker-compose exec backend alembic downgrade <previous_revision_id>
    ```
2.  **Fix**: Edit the migration file to correct the SQL/Logic error.
3.  **Retry**: Run upgrade again.

**Scenario C: "Revision ID Mismatch (Strict Enforcement)"**
*   If you renamed `1a2b...py` to `0063...py` but forgot to update the internal `revision` variable.
*   **Fix**:
    1.  Rollback the migration if it was already applied: `docker-compose exec backend alembic downgrade -1`
    2.  Edit the file: Change `revision = '1a2b...'` to `revision = '0063'`.
    3.  Upgrade again: `docker-compose exec backend alembic upgrade head`

## Common Commands Reference

| Action | Command |
| :--- | :--- |
| Check Status | `alembic current` or `alembic heads` |
| Generate | `alembic revision --autogenerate -m "msg"` |
| Upgrade | `alembic upgrade head` |
| Downgrade (1 step) | `alembic downgrade -1` |
| Downgrade (to specific) | `alembic downgrade <revision_id>` |
| History | `alembic history` |
