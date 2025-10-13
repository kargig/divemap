#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROUTES_SH="$SCRIPT_DIR/e2e_routes.sh"
WORKDIR="${TMPDIR:-/tmp}/e2e_routes"
mkdir -p "$WORKDIR"

# Credentials from environment variables with fallbacks
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin123}"

echo "[1] Admin login"
ADMIN_USER="$ADMIN_USER" ADMIN_PASS="$ADMIN_PASS" "$ROUTES_SH" login

echo "[2] Create route as admin"
"$ROUTES_SH" create 112 "Perm Route" "perm test" walk >"$WORKDIR/create_run.out" 2>&1 || true
RID=""
# Prefer created_id.txt
if [[ -s "$WORKDIR/created_id.txt" ]]; then
  RID=$(cat "$WORKDIR/created_id.txt")
else
  # Fallback: parse from last_route_id.txt
  if [[ -s "$WORKDIR/last_route_id.txt" ]]; then RID=$(cat "$WORKDIR/last_route_id.txt"); fi
fi
if [[ -z "$RID" ]]; then
  # Last fallback: grep ID: line from captured stdout
  RID=$(sed -n 's/^ID://p' "$WORKDIR/create_run.out" | tail -1 || true)
fi
if [[ -z "$RID" ]]; then
  echo "Failed to obtain route id" >&2
  cat "$WORKDIR/create_run.out" >&2 || true
  exit 1
fi
echo "RID=$RID"

echo "[3] Show admin identity"
curl -sS -H "Authorization: Bearer $(cat "$WORKDIR/token_admin.txt")" "$BASE_URL/api/v1/auth/me" | jq '.username, .is_admin' || true

echo "[4] Bubble login and identity"
ADMIN_USER=bubble ADMIN_PASS=Bubble123! "$ROUTES_SH" login
curl -sS -H "Authorization: Bearer $(cat "$WORKDIR/token_bubble.txt")" "$BASE_URL/api/v1/auth/me" | jq '.username, .is_admin' || true

echo "[5] Attempt hard delete as bubble (expect 403)"
ADMIN_USER=bubble "$ROUTES_SH" hard_delete "$RID" || true

echo "[6] Hard delete as admin (cleanup)"
ADMIN_USER=admin "$ROUTES_SH" hard_delete "$RID" || true

echo "PERMISSIONS_E2E_DONE"


