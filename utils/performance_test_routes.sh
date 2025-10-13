#!/usr/bin/env bash
set -euo pipefail

# Performance testing script for dive routes
# Creates 1000+ routes, tests performance, then cleans up

BASE_URL="${BASE_URL:-http://localhost}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROUTES_SH="$SCRIPT_DIR/e2e_routes.sh"
WORKDIR="${TMPDIR:-/tmp}/e2e_routes"
mkdir -p "$WORKDIR"

# Credentials from environment variables with fallbacks
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin123}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Dive Routes Performance Testing ===${NC}"
echo "Testing with 1000+ routes for performance validation"
echo

# Login as admin
echo -e "${YELLOW}[1] Logging in as admin...${NC}"
ADMIN_USER="$ADMIN_USER" ADMIN_PASS="$ADMIN_PASS" "$ROUTES_SH" login
echo -e "${GREEN}✓ Login successful${NC}"

# Get dive site ID (Abu Dabab 2&3)
DIVE_SITE_ID=112
echo -e "${YELLOW}[2] Using dive site ID: $DIVE_SITE_ID${NC}"

# Create performance test routes
echo -e "${YELLOW}[3] Creating 1000+ test routes...${NC}"
CREATED_ROUTES=()
FAILED_COUNT=0

for i in $(seq 1 1000); do
    ROUTE_NAME="PerfTest_${i}"
    ROUTE_DESC="Performance test route #${i}"
    ROUTE_TYPE="walk"
    
    echo -n "Creating route $i/1000... "
    
    if OUTPUT=$("$ROUTES_SH" create "$DIVE_SITE_ID" "$ROUTE_NAME" "$ROUTE_DESC" "$ROUTE_TYPE" 2>&1); then
        ROUTE_ID=$(echo "$OUTPUT" | sed -n 's/^ID://p' | tail -1)
        if [[ -n "$ROUTE_ID" ]]; then
            CREATED_ROUTES+=("$ROUTE_ID")
            echo -e "${GREEN}✓${NC} (ID: $ROUTE_ID)"
        else
            echo -e "${RED}✗ Failed to extract ID${NC}"
            ((FAILED_COUNT++))
        fi
    else
        echo -e "${RED}✗ Creation failed${NC}"
        ((FAILED_COUNT++))
    fi
    
    # Progress indicator every 50 routes
    if (( i % 50 == 0 )); then
        echo -e "${BLUE}Progress: $i/1000 routes created${NC}"
    fi
done

echo
echo -e "${GREEN}✓ Route creation completed${NC}"
echo -e "Created: ${#CREATED_ROUTES[@]} routes"
echo -e "Failed: $FAILED_COUNT routes"

# Performance testing
echo
echo -e "${YELLOW}[4] Running performance tests...${NC}"

# Test 1: List routes by site (API performance)
echo -e "${BLUE}Test 1: API route listing performance${NC}"
START_TIME=$(date +%s.%N)
"$ROUTES_SH" list_by_site "$DIVE_SITE_ID" > /dev/null 2>&1
END_TIME=$(date +%s.%N)
API_TIME=$(echo "$END_TIME - $START_TIME" | bc)
echo -e "API list time: ${API_TIME}s"

# Test 2: Frontend route loading (via Playwright)
echo -e "${BLUE}Test 2: Frontend route loading performance${NC}"
echo "Note: Frontend performance testing requires Playwright MCP"
echo "This would test the dive site page with 1000+ routes"

# Test 3: Route export performance
if [[ ${#CREATED_ROUTES[@]} -gt 0 ]]; then
    echo -e "${BLUE}Test 3: Route export performance${NC}"
    TEST_ROUTE_ID="${CREATED_ROUTES[0]}"
    START_TIME=$(date +%s.%N)
    curl -sS -H "Authorization: Bearer $(cat "$WORKDIR/token_admin.txt")" \
         "$BASE_URL/api/v1/dive-routes/$TEST_ROUTE_ID/export/gpx" > /dev/null
    END_TIME=$(date +%s.%N)
    EXPORT_TIME=$(echo "$END_TIME - $START_TIME" | bc)
    echo -e "GPX export time: ${EXPORT_TIME}s"
fi

# Cleanup: Delete all created routes
echo
echo -e "${YELLOW}[5] Cleaning up test routes...${NC}"
DELETED_COUNT=0
FAILED_DELETE_COUNT=0

for route_id in "${CREATED_ROUTES[@]}"; do
    if "$ROUTES_SH" hard_delete "$route_id" > /dev/null 2>&1; then
        ((DELETED_COUNT++))
    else
        ((FAILED_DELETE_COUNT++))
    fi
    
    # Progress indicator every 100 deletions
    if (( DELETED_COUNT % 100 == 0 )); then
        echo -e "${BLUE}Deleted: $DELETED_COUNT/${#CREATED_ROUTES[@]} routes${NC}"
    fi
done

echo
echo -e "${GREEN}✓ Performance testing completed${NC}"
echo -e "Routes created: ${#CREATED_ROUTES[@]}"
echo -e "Routes deleted: $DELETED_COUNT"
echo -e "Failed deletions: $FAILED_DELETE_COUNT"
echo -e "API list time: ${API_TIME}s"
if [[ -n "${EXPORT_TIME:-}" ]]; then
    echo -e "Export time: ${EXPORT_TIME}s"
fi

# Performance thresholds
echo
echo -e "${YELLOW}Performance Analysis:${NC}"
if (( $(echo "$API_TIME < 2.0" | bc -l) )); then
    echo -e "API listing: ${GREEN}✓ PASS${NC} (< 2.0s)"
else
    echo -e "API listing: ${RED}✗ FAIL${NC} (>= 2.0s)"
fi

if [[ -n "${EXPORT_TIME:-}" ]] && (( $(echo "$EXPORT_TIME < 1.0" | bc -l) )); then
    echo -e "Route export: ${GREEN}✓ PASS${NC} (< 1.0s)"
else
    echo -e "Route export: ${RED}✗ FAIL${NC} (>= 1.0s)"
fi

echo
echo -e "${BLUE}=== Performance Testing Complete ===${NC}"
