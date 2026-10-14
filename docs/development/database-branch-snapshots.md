# Branch-Aware Database Snapshots

## Problem Overview

When switching between Git branches in the Divemap development environment, each branch may introduce its own database migration files (Alembic revisions). Because MySQL DDL statements are non-transactional and Docker containers persist data across Git operations:
1. `alembic_version` in the database may point to a future revision not present in the checked-out branch.
2. Tables and columns created in one branch remain in the database when switching to another branch, causing `Table already exists` or foreign key conflicts when running `run_migrations.py`.
3. Rolling back manually with `alembic downgrade` is time-consuming, prone to data loss, and fails when branches have divergent histories.
4. When multiple migrations are created or tested in the same branch, developers need snapshots at specific revisions to test forward and backward migration steps without losing earlier stable snapshots.

## Solution

The `scripts/db_branch.sh` utility (and its matching `make` targets) automates per-branch and per-revision database snapshotting and restoration.

Snapshots are created using `mysqldump` running directly inside the Compose `db` container (typically `divemap_db`), gzipped, and stored along with metadata in:
```
# Revision-specific snapshot (keeps historical migration points):
database_backups/branch_snapshots/<sanitized_branch_name>__rev_<revision>.sql.gz
database_backups/branch_snapshots/<sanitized_branch_name>__rev_<revision>.meta.json

# Latest branch pointer (symlink or copy for seamless branch switching):
database_backups/branch_snapshots/<sanitized_branch_name>.sql.gz
database_backups/branch_snapshots/<sanitized_branch_name>.meta.json
```
*(Note: `database_backups/` is gitignored so snapshots remain local only).*

This tooling targets the **Compose development** MySQL database only. It does not touch the ephemeral test harness used by `./docker-test-github-actions.sh`.

---

## Quick Reference (Makefile)

| Command | Action |
| :--- | :--- |
| `make db-snapshot` | Save a snapshot of the current database for the active Git branch and its active Alembic revision. |
| `make db-snapshot rev=0100` | Save a snapshot with a specific revision or custom tag label. |
| `make db-restore` | Restore the latest snapshot saved for the active Git branch. |
| `make db-restore rev=0100` | Restore a specific revision snapshot saved for the active Git branch. |
| `make db-status` | Display the active Git branch, DB Alembic revision, and snapshot sync status. |
| `make db-snapshots` | List all saved branch and revision snapshots, their revisions, size, type, and timestamps. |
| `make db-switch branch=<name>` | Snapshot current branch, checkout target, restore target DB **if a snapshot exists** (otherwise DB is left unchanged). |

---

## Detailed CLI Commands (`scripts/db_branch.sh`)

```bash
# Save current database state (named by branch + active Alembic revision, updates latest link)
./scripts/db_branch.sh save

# Save current database state with a custom revision or tag
./scripts/db_branch.sh save feature/octo-booking-system 0101

# Check sync status and whether an exact snapshot exists for active revision
./scripts/db_branch.sh status

# List all saved branch & revision snapshots
./scripts/db_branch.sh list

# Restore latest snapshot for current branch
./scripts/db_branch.sh restore

# Restore a specific revision snapshot for current branch
./scripts/db_branch.sh restore --rev 0100
# Or positional:
./scripts/db_branch.sh restore feature/octo-booking-system 0100

# Restore with fallback to 'main' baseline if no branch snapshot exists
./scripts/db_branch.sh restore --fallback-base

# Switch: snapshots current branch, checkouts target, restores target snapshot if one exists
./scripts/db_branch.sh switch feature/octo-booking-system

# Clean up snapshots for branches that have been deleted locally
./scripts/db_branch.sh prune

# Delete a specific revision snapshot or all snapshots for a branch
./scripts/db_branch.sh delete feature/octo-booking-system 0100
./scripts/db_branch.sh delete old-branch-name
```

### `switch` is not fully atomic

`switch` always snapshots the current branch and checks out the target. **If the target branch has no snapshot, the database is left unchanged** — so you can still hit Alembic revision drift / leftover tables (the problem this tool exists to prevent).

When that happens:
1. Prefer `./scripts/db_branch.sh restore --fallback-base` (or `make db-restore` after saving a `main` baseline) if a `main` snapshot exists.
2. Or run `docker compose exec backend python run_migrations.py` only when you are sure the leftover schema is compatible.

Always create a `main` (or shared baseline) snapshot early so `--fallback-base` is available.

---

## Automated Git Hook (Optional)

You can enable an interactive Git post-checkout prompt so that switching branches via `git checkout` or `git switch` automatically asks if you'd like to restore the branch's snapshot:

```bash
./scripts/db_branch.sh install-hooks
```

To remove the hook:
```bash
./scripts/db_branch.sh uninstall-hooks
```

Notes:
- The prompt reads from `/dev/tty` (Git hooks receive stdin from `/dev/null`).
- `make db-switch` / `db_branch.sh switch` sets `DB_BRANCH_SKIP_HOOK=1` so the hook does not double-prompt during an already-orchestrated restore.
- Hook install uses `git rev-parse --git-path hooks` so it works in linked worktrees.
- Fresh hooks get a `#!/usr/bin/env bash` shebang (required for Git to exec them).

---

## After restore / switch without a snapshot

If no snapshot exists for the target branch, bring schema forward with:

```bash
docker compose exec backend python run_migrations.py
```

Or restore the `main` baseline when available:

```bash
./scripts/db_branch.sh restore --fallback-base
```
