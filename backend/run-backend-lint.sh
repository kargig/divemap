#!/usr/bin/env bash
set -e

# Change directory to backend root
cd "$(dirname "$0")"

FIX_MODE=false
if [ "$1" = "--fix" ]; then
    FIX_MODE=true
fi

# Detect ruff binary
if [ -f "./divemap_venv/bin/ruff" ]; then
    RUFF="./divemap_venv/bin/ruff"
elif command -v ruff >/dev/null 2>&1; then
    RUFF="ruff"
else
    echo "❌ Ruff is not installed in divemap_venv or system PATH."
    exit 1
fi

# Determine base branch (origin/main, main, or master)
BASE_REF=""
if git rev-parse --verify origin/main >/dev/null 2>&1; then
    BASE_REF="origin/main"
elif git rev-parse --verify main >/dev/null 2>&1; then
    BASE_REF="main"
elif git rev-parse --verify master >/dev/null 2>&1; then
    BASE_REF="master"
fi

CHANGED_FILES=""
if [ -n "$BASE_REF" ]; then
    MERGE_BASE=$(git merge-base "$BASE_REF" HEAD 2>/dev/null || true)
    if [ -n "$MERGE_BASE" ]; then
        CHANGED_FILES=$(git diff --name-only --relative --diff-filter=ACMR "$MERGE_BASE" -- app tests 2>/dev/null | grep '\.py$' || true)
    fi
fi

# Fallback: check uncommitted changes against HEAD if no merge-base diff found
if [ -z "$CHANGED_FILES" ]; then
    CHANGED_FILES=$(git diff --name-only --relative --diff-filter=ACMR HEAD -- app tests 2>/dev/null | grep '\.py$' || true)
fi

# Fallback: default to app if no modified files found
if [ -z "$CHANGED_FILES" ]; then
    RUFF_TARGETS="app"
    echo "ℹ️ No modified files detected in app/ or tests/. Targeting 'app' directory."
else
    # Format changed files as space-separated targets
    RUFF_TARGETS=$(echo "$CHANGED_FILES" | tr '
' ' ')
    echo "🎯 Targeting $(echo "$CHANGED_FILES" | wc -l) modified file(s) in app/ and tests/:"
    echo "$CHANGED_FILES" | sed 's/^/  - /'
fi

if [ "$FIX_MODE" = true ]; then
    echo "🛠️ Fixing backend lint errors and formatting with Ruff..."
    $RUFF check --fix $RUFF_TARGETS
    $RUFF format $RUFF_TARGETS
    echo "✅ Backend linting and formatting complete."
else
    echo "🧹 Checking backend linting with Ruff..."
    $RUFF check $RUFF_TARGETS
    echo "🧹 Checking backend formatting with Ruff..."
    $RUFF format --check $RUFF_TARGETS
    echo "✅ Backend lint and format checks passed."
fi
