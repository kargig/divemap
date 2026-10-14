#!/usr/bin/env bash
#
# scripts/db_branch.sh
#
# Branch-Aware Database Snapshot & Restore Utility for Divemap
# Manages per-branch and per-revision MySQL snapshots to prevent Alembic revision drift when switching Git branches.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SNAPSHOT_DIR="$PROJECT_ROOT/database_backups/branch_snapshots"
COMPOSE=(docker compose)

mkdir -p "$SNAPSHOT_DIR"

# ---------------------------------------------------------------------------
# Configuration & Credentials
# ---------------------------------------------------------------------------
if [ -f "$PROJECT_ROOT/.env" ]; then
    MYSQL_ROOT_PASSWORD_ENV=$(grep -E '^MYSQL_ROOT_PASSWORD=' "$PROJECT_ROOT/.env" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
    MYSQL_DATABASE_ENV=$(grep -E '^MYSQL_DATABASE=' "$PROJECT_ROOT/.env" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
fi

# Defaults match docker-compose.yml (db service)
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD_ENV:-${MYSQL_ROOT_PASSWORD:-rootpassword}}"
MYSQL_DATABASE="${MYSQL_DATABASE_ENV:-${MYSQL_DATABASE:-divemap}}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
get_db_container() {
    local name
    name=$("${COMPOSE[@]}" -f "$PROJECT_ROOT/docker-compose.yml" ps --status running --format '{{.Name}}' db 2>/dev/null | head -n1 || true)
    if [ -z "$name" ]; then
        # Fallback: any running container for the compose db service
        name=$("${COMPOSE[@]}" -f "$PROJECT_ROOT/docker-compose.yml" ps --format '{{.Name}}' db 2>/dev/null | head -n1 || true)
    fi
    echo "$name"
}

check_docker() {
    local container
    container=$(get_db_container)
    if [ -z "$container" ]; then
        echo "❌ Error: Compose 'db' service is not running." >&2
        echo "   Please start the database with: docker compose up -d db" >&2
        exit 1
    fi
    if ! docker ps --format '{{.Names}}' | grep -qx "$container"; then
        echo "❌ Error: Docker container '${container}' is not running." >&2
        echo "   Please start the database with: docker compose up -d db" >&2
        exit 1
    fi
    DB_CONTAINER="$container"
}

get_current_branch() {
    # --show-current prints nothing (exit 0) on detached HEAD; do not rely on ||.
    local branch
    branch=$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null || true)
    if [ -z "$branch" ]; then
        echo "detached"
    else
        echo "$branch"
    fi
}

get_post_checkout_hook() {
    # Works in normal repos and linked worktrees (hooks live under the main .git).
    local hooks_path
    hooks_path=$(git -C "$PROJECT_ROOT" rev-parse --git-path hooks 2>/dev/null || echo ".git/hooks")
    if [[ "$hooks_path" != /* ]]; then
        hooks_path="$PROJECT_ROOT/$hooks_path"
    fi
    echo "$hooks_path/post-checkout"
}

sanitize_branch_name() {
    local branch="$1"
    # Replace slashes with double underscores, and replace non-safe chars with underscore.
    # Use printf (not echo) so tr -c does not turn a trailing newline into '_'.
    printf '%s' "$branch" | sed 's/\//__/g' | tr -c 'a-zA-Z0-9._-' '_'
}

sanitize_identifier() {
    local id="$1"
    printf '%s' "$id" | tr -c 'a-zA-Z0-9._-' '_'
}

unsanitize_branch_name() {
    local sanitized="$1"
    echo "$sanitized" | sed 's/__/\//g'
}

get_active_alembic_version() {
    check_docker
    local rev
    rev=$(docker exec -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" "$DB_CONTAINER" mysql -u root -N -s -e "SELECT version_num FROM ${MYSQL_DATABASE}.alembic_version LIMIT 1;" 2>/dev/null || true)
    if [ -z "$rev" ]; then
        echo "none"
    else
        echo "$rev"
    fi
}

# Returns path for a specific revision or latest snapshot
get_snapshot_file() {
    local branch="$1"
    local rev="${2:-}"
    local safe_branch
    safe_branch=$(sanitize_branch_name "$branch")

    if [ -n "$rev" ] && [ "$rev" != "latest" ]; then
        local safe_rev
        safe_rev=$(sanitize_identifier "$rev")
        echo "$SNAPSHOT_DIR/${safe_branch}__rev_${safe_rev}.sql.gz"
    else
        echo "$SNAPSHOT_DIR/${safe_branch}.sql.gz"
    fi
}

get_meta_file() {
    local branch="$1"
    local rev="${2:-}"
    local safe_branch
    safe_branch=$(sanitize_branch_name "$branch")

    if [ -n "$rev" ] && [ "$rev" != "latest" ]; then
        local safe_rev
        safe_rev=$(sanitize_identifier "$rev")
        echo "$SNAPSHOT_DIR/${safe_branch}__rev_${safe_rev}.meta.json"
    else
        echo "$SNAPSHOT_DIR/${safe_branch}.meta.json"
    fi
}

# ---------------------------------------------------------------------------
# Core Commands
# ---------------------------------------------------------------------------

cmd_save() {
    local branch="${1:-$(get_current_branch)}"
    local custom_rev="${2:-}"

    if [ "$branch" = "detached" ] || [ -z "$branch" ]; then
        echo "❌ Cannot snapshot in detached HEAD state without specifying a branch name." >&2
        echo "   Usage: $0 save <branch_name> [revision_or_tag]" >&2
        exit 1
    fi

    check_docker

    local alembic_ver commit_hash timestamp safe_branch
    alembic_ver=$(get_active_alembic_version)
    commit_hash=$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    safe_branch=$(sanitize_branch_name "$branch")

    local rev_identifier="${custom_rev:-$alembic_ver}"
    local safe_rev
    safe_rev=$(sanitize_identifier "$rev_identifier")

    local rev_sql_file rev_meta_file
    rev_sql_file="$SNAPSHOT_DIR/${safe_branch}__rev_${safe_rev}.sql.gz"
    rev_meta_file="$SNAPSHOT_DIR/${safe_branch}__rev_${safe_rev}.meta.json"

    local latest_sql_file latest_meta_file
    latest_sql_file="$SNAPSHOT_DIR/${safe_branch}.sql.gz"
    latest_meta_file="$SNAPSHOT_DIR/${safe_branch}.meta.json"

    echo "💾 Saving database snapshot for branch '${branch}'..."
    echo "   Database:         ${MYSQL_DATABASE}"
    echo "   Container:        ${DB_CONTAINER}"
    echo "   Alembic Revision: ${alembic_ver}"
    if [ -n "$custom_rev" ]; then
        echo "   Snapshot Tag:     ${custom_rev}"
    fi
    echo "   Commit:           ${commit_hash}"

    # Dump database with drop & create statements to ensure clean restores.
    # --set-gtid-purged=OFF avoids restore failures on MySQL with GTIDs enabled (Compose 9.x).
    docker exec -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" "$DB_CONTAINER" mysqldump -u root --single-transaction --quick --routines --triggers --events --set-gtid-purged=OFF --add-drop-database --databases "$MYSQL_DATABASE" | gzip > "$rev_sql_file.tmp"

    mv "$rev_sql_file.tmp" "$rev_sql_file"

    local size
    size=$(du -h "$rev_sql_file" | cut -f1)

    # Write metadata JSON for revision-specific snapshot
    cat <<EOF > "$rev_meta_file"
{
  "branch": "${branch}",
  "commit": "${commit_hash}",
  "alembic_version": "${alembic_ver}",
  "revision_tag": "${rev_identifier}",
  "timestamp": "${timestamp}",
  "size": "${size}"
}
EOF

    # Update latest symlink/copy for seamless branch switching
    rm -f "$latest_sql_file" "$latest_meta_file"
    ln -s "$(basename "$rev_sql_file")" "$latest_sql_file" 2>/dev/null || cp "$rev_sql_file" "$latest_sql_file"
    ln -s "$(basename "$rev_meta_file")" "$latest_meta_file" 2>/dev/null || cp "$rev_meta_file" "$latest_meta_file"

    echo "✅ Snapshot saved successfully!"
    echo "   Revision File: ${rev_sql_file} (${size})"
    echo "   Latest Link:   ${latest_sql_file}"
}

cmd_restore() {
    local branch=""
    local target_rev=""
    local fallback_base=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --fallback-base|--fallback)
                fallback_base=true
                shift
                ;;
            --rev|--revision|-r)
                target_rev="$2"
                shift 2
                ;;
            *)
                if [ -z "$branch" ]; then
                    branch="$1"
                elif [ -z "$target_rev" ]; then
                    target_rev="$1"
                fi
                shift
                ;;
        esac
    done

    if [ -z "$branch" ]; then
        branch=$(get_current_branch)
    fi

    check_docker

    local sql_file
    if [ -n "$target_rev" ]; then
        sql_file=$(get_snapshot_file "$branch" "$target_rev")
    else
        sql_file=$(get_snapshot_file "$branch")
    fi

    if [ ! -f "$sql_file" ]; then
        echo "⚠️  No snapshot found for branch '${branch}'${target_rev:+ (revision '$target_rev')} at:"
        echo "   $sql_file"

        local main_sql
        main_sql=$(get_snapshot_file "main")

        if [ "$fallback_base" = true ] && [ -f "$main_sql" ]; then
            echo "ℹ️  Falling back to 'main' baseline snapshot..."
            sql_file="$main_sql"
            branch="main (baseline)"
        elif [ -f "$main_sql" ]; then
            echo ""
            echo "💡 Tip: A baseline snapshot for 'main' exists."
            echo "   To restore from 'main' baseline instead, run:"
            echo "   $0 restore main"
            echo "   or"
            echo "   $0 restore --fallback-base"
            return 1
        else
            echo ""
            echo "💡 To create a snapshot for the current state:"
            echo "   $0 save ${branch}"
            return 1
        fi
    fi

    echo "🔄 Restoring database snapshot for branch '${branch}'${target_rev:+ (revision '$target_rev')}..."
    echo "   Target file: $sql_file"
    echo "   Container:   ${DB_CONTAINER}"
    echo "⚠️  This will DROP and recreate database '${MYSQL_DATABASE}' from the snapshot."

    # Validate gzip integrity before DROP DATABASE runs inside the dump.
    if ! gzip -t "$sql_file" 2>/dev/null; then
        echo "❌ Error: Snapshot file is corrupt or truncated: $sql_file" >&2
        exit 1
    fi

    gzip -dc "$sql_file" | docker exec -i -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" "$DB_CONTAINER" mysql -u root

    # Flush privileges in case grants were touched
    docker exec -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" "$DB_CONTAINER" mysql -u root -e "FLUSH PRIVILEGES;" 2>/dev/null || true

    local restored_ver
    restored_ver=$(get_active_alembic_version)

    echo "✅ Database restored successfully!"
    echo "   Current Alembic Revision: ${restored_ver}"
}

cmd_switch() {
    local target_branch="$1"
    if [ -z "$target_branch" ]; then
        echo "❌ Error: Target branch required." >&2
        echo "   Usage: $0 switch <target_branch>" >&2
        exit 1
    fi

    local current_branch
    current_branch=$(get_current_branch)

    # 1. Snapshot current branch if it's a valid branch name
    if [ "$current_branch" != "detached" ] && [ -n "$current_branch" ]; then
        echo "📌 Step 1/3: Snapshotting current branch '${current_branch}'..."
        cmd_save "$current_branch"
    fi

    # 2. Switch git branch (skip post-checkout restore prompt; we restore below)
    echo ""
    echo "🔀 Step 2/3: Switching Git branch to '${target_branch}'..."
    DB_BRANCH_SKIP_HOOK=1 git -C "$PROJECT_ROOT" checkout "$target_branch"

    # 3. Restore target branch snapshot if exists
    echo ""
    echo "📦 Step 3/3: Checking database snapshot for '${target_branch}'..."
    local target_sql
    target_sql=$(get_snapshot_file "$target_branch")

    if [ -f "$target_sql" ]; then
        cmd_restore "$target_branch"
    else
        echo "⚠️  No snapshot found for branch '${target_branch}'."
        echo "   Git checkout succeeded, but the DB was left unchanged (not an atomic DB switch)."
        local main_sql
        main_sql=$(get_snapshot_file "main")
        if [ -f "$main_sql" ]; then
            echo "ℹ️  A snapshot for 'main' is available. Restore it with:"
            echo "   $0 restore --fallback-base"
            echo "   or: $0 restore main"
        else
            echo "ℹ️  Options: restore a baseline snapshot, or run migrations if the leftover schema is compatible:"
            echo "   docker compose exec backend python run_migrations.py"
        fi
    fi
}

cmd_list() {
    local current_branch
    current_branch=$(get_current_branch)

    echo "📋 Saved Database Snapshots (${SNAPSHOT_DIR}):"
    echo ""
    printf "%-3s %-32s %-12s %-8s %-8s %-6s %-20s\n" "" "BRANCH" "REVISION/TAG" "COMMIT" "SIZE" "TYPE" "SAVED (UTC)"
    printf "%-3s %-32s %-12s %-8s %-8s %-6s %-20s\n" "" "--------------------------------" "------------" "--------" "--------" "------" "--------------------"

    local count=0
    # Process both revision-specific and branch pointer meta files
    for meta in "$SNAPSHOT_DIR"/*.meta.json; do
        [ -e "$meta" ] || continue
        count=$((count + 1))
        local branch rev commit timestamp size mark is_link type_label filename
        filename=$(basename "$meta")
        branch=$(grep -o '"branch": "[^"]*"' "$meta" | cut -d'"' -f4 || echo "unknown")
        rev=$(grep -o '"revision_tag": "[^"]*"' "$meta" | cut -d'"' -f4 || grep -o '"alembic_version": "[^"]*"' "$meta" | cut -d'"' -f4 || echo "unknown")
        commit=$(grep -o '"commit": "[^"]*"' "$meta" | cut -d'"' -f4 || echo "unknown")
        timestamp=$(grep -o '"timestamp": "[^"]*"' "$meta" | cut -d'"' -f4 | sed 's/T/ /;s/Z//' || echo "unknown")
        size=$(grep -o '"size": "[^"]*"' "$meta" | cut -d'"' -f4 || echo "unknown")

        if [ -L "$meta" ] || [[ ! "$filename" =~ __rev_ ]]; then
            type_label="latest"
        else
            type_label="rev"
        fi

        if [ "$branch" = "$current_branch" ]; then
            mark="* "
        else
            mark="  "
        fi

        printf "%-3s %-32s %-12s %-8s %-8s %-6s %-20s\n" "$mark" "$branch" "$rev" "$commit" "$size" "$type_label" "$timestamp"
    done

    if [ $count -eq 0 ]; then
        echo "  (No branch snapshots saved yet)"
    fi
    echo ""
    echo "* indicates current Git branch"
}

cmd_status() {
    local current_branch current_rev snapshot_file meta_file
    current_branch=$(get_current_branch)
    # Resolve container in this shell first; get_active_alembic_version runs in a
    # subshell via $() so its check_docker would not set DB_CONTAINER here.
    check_docker
    current_rev=$(get_active_alembic_version)
    snapshot_file=$(get_snapshot_file "$current_branch")
    meta_file=$(get_meta_file "$current_branch")

    echo "📊 Database Branch Status:"
    echo "   Git Branch:            ${current_branch}"
    echo "   DB Container:          ${DB_CONTAINER}"
    echo "   Active DB Alembic Rev: ${current_rev}"

    if [ -f "$snapshot_file" ] && [ -f "$meta_file" ]; then
        local snap_rev snap_time snap_size snap_tag
        snap_rev=$(grep -o '"alembic_version": "[^"]*"' "$meta_file" | cut -d'"' -f4 || echo "unknown")
        snap_tag=$(grep -o '"revision_tag": "[^"]*"' "$meta_file" | cut -d'"' -f4 || echo "$snap_rev")
        snap_time=$(grep -o '"timestamp": "[^"]*"' "$meta_file" | cut -d'"' -f4 || echo "unknown")
        snap_size=$(grep -o '"size": "[^"]*"' "$meta_file" | cut -d'"' -f4 || echo "unknown")

        echo "   Latest Snapshot:       Found (${snap_size}, updated ${snap_time})"
        echo "   Snapshot Revision:     ${snap_rev}${snap_tag:+ (tag: $snap_tag)}"

        if [ "$current_rev" = "$snap_rev" ]; then
            echo "   Sync Status:           ✅ In sync (active DB matches saved snapshot revision)"
        else
            echo "   Sync Status:           ⚠️ Drift detected (active DB '${current_rev}' != snapshot '${snap_rev}')"
            echo "                          Run '$0 save' to update snapshot or '$0 restore' to revert DB."
        fi

        # Also check if specific rev snapshot exists
        local specific_rev_file
        specific_rev_file=$(get_snapshot_file "$current_branch" "$current_rev")
        if [ -f "$specific_rev_file" ]; then
            echo "   Exact Rev Snapshot:    ✅ Snapshot for active rev '${current_rev}' exists"
        else
            echo "   Exact Rev Snapshot:    ℹ️ No specific snapshot for active rev '${current_rev}'"
        fi
    else
        echo "   Saved Snapshot:        ❌ None (run '$0 save' to capture current state)"
    fi
}

cmd_delete() {
    local branch="$1"
    local rev="${2:-}"
    if [ -z "$branch" ]; then
        echo "❌ Error: Branch name required." >&2
        echo "   Usage: $0 delete <branch_name> [revision_or_tag]" >&2
        exit 1
    fi

    local safe_branch
    safe_branch=$(sanitize_branch_name "$branch")

    if [ -n "$rev" ]; then
        local safe_rev sql_file meta_file
        safe_rev=$(sanitize_identifier "$rev")
        sql_file="$SNAPSHOT_DIR/${safe_branch}__rev_${safe_rev}.sql.gz"
        meta_file="$SNAPSHOT_DIR/${safe_branch}__rev_${safe_rev}.meta.json"

        if [ ! -f "$sql_file" ] && [ ! -f "$meta_file" ]; then
            echo "⚠️ No snapshot found for branch '${branch}' revision '${rev}'."
            return 0
        fi
        rm -f "$sql_file" "$meta_file"
        echo "🗑️ Deleted snapshot files for branch '${branch}' revision '${rev}'."
    else
        # Exact names only: prefix globs like "${safe_branch}"* would also delete
        # snapshots for longer names (e.g. deleting "feat" would remove "feat-2").
        rm -f \
            "$SNAPSHOT_DIR/${safe_branch}.sql.gz" \
            "$SNAPSHOT_DIR/${safe_branch}.meta.json" \
            "$SNAPSHOT_DIR/${safe_branch}__rev_"*.sql.gz \
            "$SNAPSHOT_DIR/${safe_branch}__rev_"*.meta.json
        echo "🗑️ Deleted all snapshot files for branch '${branch}'."
    fi
}

cmd_prune() {
    echo "🧹 Checking for stale snapshots of deleted local branches..."
    local pruned=0
    for meta in "$SNAPSHOT_DIR"/*.meta.json; do
        [ -e "$meta" ] || continue
        # Only check real meta files or broken links
        local branch
        branch=$(grep -o '"branch": "[^"]*"' "$meta" 2>/dev/null | cut -d'"' -f4 || echo "")
        [ -n "$branch" ] || continue

        # Check if local git branch exists
        if ! git -C "$PROJECT_ROOT" show-ref --verify --quiet "refs/heads/$branch"; then
            echo "   Removing stale snapshot for non-existent branch: '${branch}'"
            cmd_delete "$branch"
            pruned=$((pruned + 1))
        fi
    done

    if [ $pruned -eq 0 ]; then
        echo "✅ No stale snapshots found."
    else
        echo "✅ Pruned stale snapshots."
    fi
}

cmd_install_hooks() {
    local hook_file
    hook_file=$(get_post_checkout_hook)
    mkdir -p "$(dirname "$hook_file")"

    if [ -f "$hook_file" ] && grep -q "db_branch.sh" "$hook_file"; then
        echo "ℹ️  db_branch hook is already installed in $hook_file"
        return 0
    fi

    echo "⚙️  Installing post-checkout Git hook..."
    # Fresh clones have no post-checkout file. Git execs the hook directly, so it
    # needs a shebang. Use bash: the hook body uses [[ and read -p.
    if [ ! -f "$hook_file" ]; then
        printf '%s\n' '#!/usr/bin/env bash' > "$hook_file"
    elif ! head -n 1 "$hook_file" | grep -q '^#!'; then
        local tmp_hook
        tmp_hook=$(mktemp)
        printf '%s\n' '#!/usr/bin/env bash' > "$tmp_hook"
        cat "$hook_file" >> "$tmp_hook"
        mv "$tmp_hook" "$hook_file"
    fi

    cat <<'HOOK_EOF' >> "$hook_file"

# --- Divemap db_branch hook ---
# Automatically prompts/restores DB snapshot on branch switch ($3 == 1 means branch switch).
# Skip when make db-switch / db_branch.sh switch already handles restore (DB_BRANCH_SKIP_HOOK=1).
# Git hooks get stdin from /dev/null; read the prompt from the controlling terminal.
if [ "$3" = "1" ] && [ -z "${DB_BRANCH_SKIP_HOOK:-}" ] && [ -x "./scripts/db_branch.sh" ]; then
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || true)
    if [ -n "$CURRENT_BRANCH" ]; then
        SAFE_NAME=$(./scripts/db_branch.sh _safe_name "$CURRENT_BRANCH" 2>/dev/null || echo "")
        if [ -n "$SAFE_NAME" ] && [ -f "database_backups/branch_snapshots/${SAFE_NAME}.sql.gz" ]; then
            echo ""
            echo "💡 [db_branch] Found database snapshot for '${CURRENT_BRANCH}'."
            if [ -r /dev/tty ]; then
                read -r -p "   Restore database to match this branch? [y/N]: " RESP < /dev/tty || RESP=""
            else
                RESP=""
            fi
            if [[ "$RESP" =~ ^[Yy]$ ]]; then
                ./scripts/db_branch.sh restore "$CURRENT_BRANCH"
            fi
        fi
    fi
fi
# --- End Divemap db_branch hook ---
HOOK_EOF

    chmod +x "$hook_file"
    echo "✅ Git post-checkout hook installed to ${hook_file}!"
}

cmd_uninstall_hooks() {
    local hook_file tmp_hook
    hook_file=$(get_post_checkout_hook)
    if [ ! -f "$hook_file" ]; then
        echo "ℹ️  No post-checkout hook found."
        return 0
    fi

    # Portable edit (GNU sed -i differs from BSD/macOS sed -i).
    tmp_hook=$(mktemp)
    sed '/# --- Divemap db_branch hook ---/,/# --- End Divemap db_branch hook ---/d' "$hook_file" > "$tmp_hook"
    mv "$tmp_hook" "$hook_file"
    echo "✅ db_branch Git hook removed from ${hook_file}."
}

# ---------------------------------------------------------------------------
# CLI Dispatcher
# ---------------------------------------------------------------------------

usage() {
    echo "Usage: $0 <command> [arguments]"
    echo ""
    echo "Commands:"
    echo "  save [branch] [rev]        Snapshot database for branch & revision (default: current branch & active rev)"
    echo "  restore [branch] [rev]     Restore snapshot (default: branch latest, or specific revision/tag)"
    echo "  switch <target_branch>     Snapshot current, checkout target, restore target snapshot if present"
    echo "  status                     Show current branch, DB revision, and snapshot sync status"
    echo "  list                       List all saved branch & revision snapshots"
    echo "  delete <branch> [rev]      Delete snapshot for a specific branch (or specific revision)"
    echo "  prune                      Remove snapshots for local branches that no longer exist"
    echo "  install-hooks              Install Git post-checkout hook for branch switching prompts"
    echo "  uninstall-hooks            Remove Git post-checkout hook"
    echo "  help                       Show this help message"
    echo ""
}

case "${1:-}" in
    save|snapshot)
        shift
        cmd_save "$@"
        ;;
    restore)
        shift
        cmd_restore "$@"
        ;;
    switch)
        shift
        cmd_switch "$@"
        ;;
    list|ls)
        cmd_list
        ;;
    status)
        cmd_status
        ;;
    delete|rm)
        shift
        cmd_delete "$@"
        ;;
    prune)
        cmd_prune
        ;;
    install-hooks)
        cmd_install_hooks
        ;;
    uninstall-hooks)
        cmd_uninstall_hooks
        ;;
    _safe_name)
        sanitize_branch_name "$2"
        ;;
    help|--help|-h|"")
        usage
        ;;
    *)
        echo "❌ Unknown command: $1" >&2
        usage
        exit 1
        ;;
esac
