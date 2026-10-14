# Branch-Aware Database Snapshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a fast, robust script and documentation to snapshot and restore MySQL database states per Git branch, eliminating Alembic revision drift when switching branches in local Docker development.

**Architecture:** A standalone bash utility `scripts/db_branch.sh` wraps containerized `mysqldump` and `mysql` commands targeting `divemap_db`. Snapshots are stored gzipped with metadata in `database_backups/branch_snapshots/` (already gitignored). The script handles branch name sanitization, metadata tracking (Alembic revision, commit hash), auto-snapshotting before checkout, restoring on checkout, and optional Git hook integration.

**Tech Stack:** Bash, Docker (`divemap_db` MySQL 8.4 LTS container), Alembic, Make.

**Spec:** Branch-aware database snapshots for multi-branch development in Divemap Docker environment.

## Global Constraints

- Never use `git add` or `git commit -m` (forbidden in project instructions).
- Keep all snapshot artifacts inside `database_backups/branch_snapshots/` so they remain gitignored.
- Use `docker exec` targeting `divemap_db` directly with `MYSQL_PWD` to avoid host tool dependencies and suppress password warnings.
- All file edits must use dedicated tools (`write_file`, `replace`).

---

### Task 1: Create `scripts/db_branch.sh` Core Script

**Files:**
- Create: `scripts/db_branch.sh`

**Interfaces:**
- CLI operations:
  - `./scripts/db_branch.sh save [branch]`
  - `./scripts/db_branch.sh restore [branch] [--fallback-base]`
  - `./scripts/db_branch.sh switch <branch>`
  - `./scripts/db_branch.sh list`
  - `./scripts/db_branch.sh status`
  - `./scripts/db_branch.sh delete <branch>`
  - `./scripts/db_branch.sh prune`
  - `./scripts/db_branch.sh install-hooks`
  - `./scripts/db_branch.sh uninstall-hooks`

- [ ] **Step 1: Write `scripts/db_branch.sh` implementation**
- [ ] **Step 2: Make `scripts/db_branch.sh` executable (`chmod +x scripts/db_branch.sh`)**
- [ ] **Step 3: Test `status`, `list`, `save`, and `restore` against live `divemap_db`**

---

### Task 2: Add Make Targets in `Makefile`

**Files:**
- Modify: `Makefile`

**Interfaces:**
- `make db-snapshot` -> calls `./scripts/db_branch.sh save`
- `make db-restore` -> calls `./scripts/db_branch.sh restore`
- `make db-snapshots` -> calls `./scripts/db_branch.sh list`
- `make db-switch branch=<name>` -> calls `./scripts/db_branch.sh switch <name>`

- [ ] **Step 1: Update `Makefile` with db snapshot targets and help text**
- [ ] **Step 2: Test `make db-snapshots` and `make db-snapshot`**

---

### Task 3: Automated Verification and Edge Case Testing

**Files:**
- Test with temporary branches / test snapshot verification via script execution.

- [ ] **Step 1: Save snapshot for current branch (`feature/octo-booking-system`)**
- [ ] **Step 2: Verify metadata and gzip integrity**
- [ ] **Step 3: Test `status` output shows active revision and saved snapshot**
- [ ] **Step 4: Test safe fallback when a branch has no snapshot**

---

### Task 4: Documentation and Repo Map Updates

**Files:**
- Create: `docs/development/database-branch-snapshots.md`
- Modify: `REPO_MAP.md`
- Modify: `GEMINI.md` (add quick reference under Development Workflow / Database Management)

- [ ] **Step 1: Create comprehensive guide `docs/development/database-branch-snapshots.md`**
- [ ] **Step 2: Update `REPO_MAP.md` to index `scripts/db_branch.sh` and the new doc**
- [ ] **Step 3: Update `GEMINI.md` to reference the snapshot workflow**
