#!/usr/bin/env bash

set -euo pipefail

# Simple E2E helper for managing test Dive Routes via backend API
#
# Requirements:
# - Backend reachable via BASE_URL (default: http://localhost)
# - Credentials provided via env vars or local_testme file
#
# Usage examples:
#   BASE_URL=http://localhost ./utils/e2e_routes.sh login
#   ./utils/e2e_routes.sh create 112 "E2E Route" "Test route"
#   ./utils/e2e_routes.sh update <route_id> "New Name" "New Desc"
#   ./utils/e2e_routes.sh hide <route_id>
#   ./utils/e2e_routes.sh restore <route_id>
#   ./utils/e2e_routes.sh hard_delete <route_id>            # no migrate
#   ./utils/e2e_routes.sh hard_delete <route_id> <migrate_to_route_id>
#   ./utils/e2e_routes.sh list_by_site 112

BASE_URL="${BASE_URL:-http://localhost}"
API_AUTH_LOGIN="$BASE_URL/api/v1/auth/login"
API_ROUTES_BASE="$BASE_URL/api/v1/dive-routes"

WORKDIR="${TMPDIR:-/tmp}/e2e_routes"
mkdir -p "$WORKDIR"
CURL_BIN=${CURL_BIN:-curl}
CURL="${CURL_BIN} -sSL"  # follow redirects and surface errors

token_path() {
  local user_key
  user_key="${ADMIN_USER:-admin}"
  printf '%s' "$WORKDIR/token_${user_key}.txt"
}

whoami() {
  require_token
  local tfile resp
  tfile=$(token_path)
  resp="$WORKDIR/whoami.json"
  $CURL -H "Authorization: Bearer $(cat "$tfile")" \
    "$BASE_URL/api/v1/auth/me" > "$resp" || true
  echo "Identity:"; cat "$resp"; echo
}

read_local_testme() {
  local file_dir
  file_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
  local file="$file_dir/local_testme"
  if [[ -f "$file" ]]; then
    # Format in local_testme:
    # Admin user:
    #   username/password
    # Optionally another admin on next line; we use the first pair
    if [[ -z "${ADMIN_USER:-}" || -z "${ADMIN_PASS:-}" ]]; then
      local line
      line=$(awk '/^Admin user:/{getline; gsub(/^\s+|\s+$/,"",$0); print; exit}' "$file" 2>/dev/null || true)
      if [[ -n "$line" ]]; then
        IFS='/' read -r ADMIN_USER ADMIN_PASS <<< "$line"
      fi
    fi
  fi
}

json_get() {
  # json_get <json_file> <key>
  python3 - "$1" "$2" <<'PY'
import sys, json
path = sys.argv[2]
try:
    with open(sys.argv[1], 'rb') as f:
        raw = f.read()
    if not raw:
        print("")
        raise SystemExit(0)
    data = json.loads(raw)
except Exception:
    print("")
    raise SystemExit(0)
cur = data
for part in path.split('.'):
    if isinstance(cur, dict):
        cur = cur.get(part)
    else:
        cur = None
        break
if cur is None:
    print("")
elif isinstance(cur, (dict, list)):
    print(json.dumps(cur))
else:
    print(str(cur))
PY
}

require_token() {
  local tfile
  tfile=$(token_path)
  if [[ ! -s "$tfile" ]]; then
    echo "No token found. Run: $0 login" >&2
    exit 1
  fi
}

login() {
  local user pass
  user="${ADMIN_USER:-admin}"
  pass="${ADMIN_PASS:-admin123}"

  # Only read from local_testme if env is not set
  if [[ -z "${ADMIN_USER:-}" && -z "${ADMIN_PASS:-}" ]]; then
    read_local_testme || true
    user="${ADMIN_USER:-$user}"
    pass="${ADMIN_PASS:-$pass}"
  else
    user="${ADMIN_USER:-$user}"
    pass="${ADMIN_PASS:-$pass}"
  fi

  echo "Logging in as: $user"
  local resp="$WORKDIR/login.json"
  $CURL -X POST \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$user\",\"password\":\"$pass\"}" \
    "$API_AUTH_LOGIN" > "$resp"

  local token
  token=$(python3 -c 'import sys,json; print(json.load(open(sys.argv[1])).get("access_token",""))' "$resp")
  if [[ -z "$token" ]]; then
    echo "Login failed. Response:" >&2
    cat "$resp" >&2
    exit 1
  fi
  local tfile
  tfile=$(token_path)
  printf '%s' "$token" > "$tfile"
  echo "Token saved to $tfile"
}

create_route() {
  require_token
  local site_id name desc rtype
  site_id="$1"; shift || true
  name="$1"; shift || true
  desc="${1:-}"; shift || true
  rtype="${1:-walk}"; shift || true
  if [[ -z "$site_id" || -z "$name" ]]; then
    echo "Usage: $0 create <dive_site_id> <name> [description] [route_type: walk|swim|scuba]" >&2
    exit 1
  fi
  local body resp
  body=$(cat <<JSON
{
  "dive_site_id": $site_id,
  "name": "${name}",
  "description": "${desc}",
  "route_type": "${rtype}",
  "route_data": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {"segment_type": "${rtype}"},
        "geometry": {"type": "LineString", "coordinates": [[24.0000,38.0000],[24.0010,38.0010]]}
      }
    ]
  }
}
JSON
)
  resp="$WORKDIR/create.json"
  $CURL -X POST \
    -H "Authorization: Bearer $(cat "$(token_path)")" \
    -H 'Content-Type: application/json' \
    -d "$body" \
    "$API_ROUTES_BASE" > "$resp"
  echo "Create response:"; cat "$resp"; echo
  local rid
  rid=$(json_get "$resp" id)
  if [[ -n "$rid" ]]; then
    echo "$rid" > "$WORKDIR/last_route_id.txt"
    echo "$rid" > "$WORKDIR/created_id.txt"
    echo "Saved route id: $rid"
    # Also print id for easy capture in pipelines
    echo "ID:$rid"
  fi
}

create_id() {
  # Convenience: print only route id on success
  create_route "$@" >/dev/null
  if [[ -s "$WORKDIR/last_route_id.txt" ]]; then
    cat "$WORKDIR/last_route_id.txt"
  fi
}

update_route() {
  require_token
  local route_id name desc
  route_id="$1"; name="$2"; desc="$3"
  if [[ -z "$route_id" || -z "$name" || -z "$desc" ]]; then
    echo "Usage: $0 update <route_id> <name> <description>" >&2
    exit 1
  fi
  local body resp
  body=$(cat <<JSON
{
  "name": "${name}",
  "description": "${desc}"
}
JSON
)
  resp="$WORKDIR/update.json"
  $CURL -X PUT \
    -H "Authorization: Bearer $(cat "$(token_path)")" \
    -H 'Content-Type: application/json' \
    -d "$body" \
    "$API_ROUTES_BASE/$route_id" > "$resp"
  echo "Update response:"; cat "$resp"; echo
}

hide_route() {
  require_token
  local route_id="$1"
  if [[ -z "$route_id" ]]; then
    echo "Usage: $0 hide <route_id>" >&2
    exit 1
  fi
  local resp="$WORKDIR/hide.json"
  $CURL -X POST \
    -H "Authorization: Bearer $(cat "$(token_path)")" \
    "$API_ROUTES_BASE/$route_id/hide" > "$resp"
  echo "Hide response:"; cat "$resp"; echo
}

restore_route() {
  require_token
  local route_id="$1"
  if [[ -z "$route_id" ]]; then
    echo "Usage: $0 restore <route_id>" >&2
    exit 1
  fi
  local resp="$WORKDIR/restore.json"
  $CURL -X POST \
    -H "Authorization: Bearer $(cat "$(token_path)")" \
    "$API_ROUTES_BASE/$route_id/restore" > "$resp"
  echo "Restore response:"; cat "$resp"; echo
}

hard_delete_route() {
  require_token
  local route_id="${1-}" migrate_to="${2-}"
  if [[ -z "$route_id" ]]; then
    echo "Usage: $0 hard_delete <route_id> [migrate_to_route_id]" >&2
    exit 1
  fi
  local url="$API_ROUTES_BASE/$route_id"
  if [[ -n "$migrate_to" ]]; then
    url="$url?migration_route_id=$migrate_to"
  fi
  local resp="$WORKDIR/hard_delete.json" status_file="$WORKDIR/hard_delete.status"
  : > "$status_file"
  ${CURL_BIN} -sS -X DELETE \
    -H "Authorization: Bearer $(cat "$(token_path)")" \
    -o "$resp" -w "%{http_code}" "$url" > "$status_file" || true
  echo "Hard delete HTTP_STATUS: $(cat "$status_file")"
  echo "Hard delete response:"; cat "$resp"; echo
}

list_by_site() {
  local site_id="$1"
  if [[ -z "$site_id" ]]; then
    echo "Usage: $0 list_by_site <dive_site_id>" >&2
    exit 1
  fi
  local resp="$WORKDIR/list_site.json"
  $CURL "$BASE_URL/api/v1/dive-sites/$site_id/routes" > "$resp"
  echo "List by site response:"; cat "$resp"; echo
}

cmd="${1:-}"
shift || true
case "$cmd" in
  login)          login "$@" ;;
  create)         create_route "$@" ;;
  create_id)      create_id "$@" ;;
  update)         update_route "$@" ;;
  hide)           hide_route "$@" ;;
  restore)        restore_route "$@" ;;
  hard_delete)    hard_delete_route "$@" ;;
  whoami)         whoami "$@" ;;
  list_by_site)   list_by_site "$@" ;;
  *)
    cat <<USAGE >&2
Usage:
  BASE_URL=http://localhost $0 login
  $0 create <dive_site_id> <name> [description]
  $0 update <route_id> <name> <description>
  $0 hide <route_id>
  $0 restore <route_id>
  $0 hard_delete <route_id> [migrate_to_route_id]
  $0 list_by_site <dive_site_id>
USAGE
    exit 1
    ;;
esac


