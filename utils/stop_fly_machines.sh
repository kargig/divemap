#!/usr/bin/env bash

set -euo pipefail

# Stop all Fly.io machines for the Divemap stack (nginx, frontend, backend, db).
# Requires: flyctl installed and authenticated (fly auth login).
# Usage:
#   utils/stop_fly_machines.sh            # prompts for confirmation
#   utils/stop_fly_machines.sh --yes      # non-interactive
#   utils/stop_fly_machines.sh --dry-run  # show actions without executing
#
# It reads app names from component fly.toml files.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
YES="false"
DRY_RUN="false"

for arg in "$@"; do
  case "$arg" in
    --yes|-y) YES="true" ;;
    --dry-run) DRY_RUN="true" ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Error: '$1' not found in PATH" >&2; exit 1; }
}

parse_app_from_toml() {
  # Minimal parser: first non-comment line starting with app = '...'
  awk -F"'" '/^app\s*=\s*\x27/ { print $2; exit }' "$1"
}

apps=()

nginx_toml="$ROOT_DIR/nginx/fly.toml"
frontend_toml="$ROOT_DIR/frontend/fly.toml"
backend_toml="$ROOT_DIR/backend/fly.toml"
db_toml="$ROOT_DIR/database/fly.toml"

[[ -f "$nginx_toml" ]] && apps+=("$(parse_app_from_toml "$nginx_toml")")
[[ -f "$frontend_toml" ]] && apps+=("$(parse_app_from_toml "$frontend_toml")")
[[ -f "$backend_toml" ]] && apps+=("$(parse_app_from_toml "$backend_toml")")
[[ -f "$db_toml" ]] && apps+=("$(parse_app_from_toml "$db_toml")")

# Deduplicate while preserving order
unique_apps=()
for a in "${apps[@]}"; do
  [[ -z "$a" ]] && continue
  skip="false"
  for ua in "${unique_apps[@]}"; do
    [[ "$ua" == "$a" ]] && skip="true" && break
  done
  [[ "$skip" == "false" ]] && unique_apps+=("$a")
done

if [[ ${#unique_apps[@]} -eq 0 ]]; then
  echo "No Fly apps found from fly.toml files." >&2
  exit 1
fi

require_cmd fly

echo "Will stop machines for the following Fly apps: ${unique_apps[*]}"

if [[ "$YES" != "true" ]]; then
  read -r -p "Proceed? [y/N] " reply
  case "$reply" in
    y|Y|yes|YES) ;;
    *) echo "Aborted."; exit 0 ;;
  esac
fi

stop_app_machines() {
  local app="$1"
  echo "Listing machines for app: $app"
  # Using JSON output to be robust; fallback to non-JSON if needed
  if ids_json=$(fly machines list -a "$app" --json 2>/dev/null); then
    mapfile -t ids < <(printf '%s' "$ids_json" | awk -F'"' '/"id"\s*:\s*"/ {print $4}')
  else
    # Fallback: parse plain output, assuming ID is first column
    mapfile -t ids < <(fly machines list -a "$app" 2>/dev/null | awk 'NR>1 {print $1}')
  fi

  if [[ ${#ids[@]} -eq 0 ]]; then
    echo "No machines found for $app"
    return 0
  fi

  for id in "${ids[@]}"; do
    [[ -z "$id" ]] && continue
    echo "Stopping machine $id in app $app ..."
    if [[ "$DRY_RUN" == "true" ]]; then
      echo "DRY-RUN: fly machine stop $id -a $app"
    else
      fly machine stop "$id" -a "$app"
    fi
  done
}

for app in "${unique_apps[@]}"; do
  stop_app_machines "$app"
done

echo "Done."


