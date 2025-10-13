#!/bin/bash

# Performance Test Cleanup Script
# Removes all performance test routes created by the performance testing script

set -e

WORKDIR="/tmp/performance_test"
API_BASE="http://localhost/api/v1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[CLEANUP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if work directory exists
if [ ! -d "$WORKDIR" ]; then
    print_error "Performance test directory not found: $WORKDIR"
    exit 1
fi

# Check if routes file exists
if [ ! -f "$WORKDIR/created_routes.txt" ]; then
    print_error "Created routes file not found: $WORKDIR/created_routes.txt"
    exit 1
fi

# Check if token file exists
if [ ! -f "$WORKDIR/token_admin.txt" ]; then
    print_error "Admin token file not found: $WORKDIR/token_admin.txt"
    exit 1
fi

# Get token
TOKEN=$(cat "$WORKDIR/token_admin.txt")
ROUTE_COUNT=$(wc -l < "$WORKDIR/created_routes.txt")

print_status "Starting cleanup of $ROUTE_COUNT performance test routes..."

# Clean up routes
DELETED_COUNT=0
FAILED_COUNT=0

while IFS= read -r route_id; do
    if [ -n "$route_id" ]; then
        response=$(curl -sSL -X DELETE \
            -H "Authorization: Bearer $TOKEN" \
            "$API_BASE/dive-routes/$route_id")
        
        if echo "$response" | grep -q "deleted successfully"; then
            DELETED_COUNT=$((DELETED_COUNT + 1))
        else
            FAILED_COUNT=$((FAILED_COUNT + 1))
            print_error "Failed to delete route $route_id"
        fi
        
        # Progress indicator
        if [ $((DELETED_COUNT + FAILED_COUNT)) % 100 -eq 0 ]; then
            print_status "Processed $((DELETED_COUNT + FAILED_COUNT))/$ROUTE_COUNT routes..."
        fi
    fi
done < "$WORKDIR/created_routes.txt"

print_success "Cleanup completed!"
print_status "Deleted: $DELETED_COUNT routes"
if [ $FAILED_COUNT -gt 0 ]; then
    print_warning "Failed: $FAILED_COUNT routes"
fi

# Verify cleanup
print_status "Verifying cleanup..."
remaining_routes=$(curl -sSL -H "Authorization: Bearer $TOKEN" \
    "$API_BASE/dive-routes?dive_site_id=112&page_size=1000" | \
    python3 -c "import sys, json; data=json.load(sys.stdin); print(len([r for r in data.get('items', []) if r.get('name', '').startswith('PERF_')]))" 2>/dev/null || echo "0")

if [ "$remaining_routes" -eq 0 ]; then
    print_success "All performance test routes successfully removed!"
else
    print_warning "$remaining_routes performance test routes still remain"
fi

# Clean up work directory
print_status "Cleaning up work directory..."
rm -rf "$WORKDIR"

print_success "Performance test cleanup completed successfully!"
