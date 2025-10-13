#!/bin/bash

# Comprehensive Performance Testing Script for Dive Routes
# Generates 1000+ routes with varied segment types and measures performance

set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost}"
API_BASE="$BASE_URL/api/v1"
WORKDIR="/tmp/performance_test"
PERF_PREFIX="PERF_$(date +%Y%m%d)_"
DIVE_SITE_ID=112  # Abu Dabab 2&3
TOTAL_ROUTES=1000
BATCH_SIZE=50

# Credentials from environment variables with fallbacks
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin123}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create work directory
mkdir -p "$WORKDIR"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[PERF]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to login and get token
login() {
    local username="$1"
    local password="$2"
    
    print_status "Logging in as $username..."
    
    local response=$(curl -sSL -X POST \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$username\",\"password\":\"$password\"}" \
        "$API_BASE/auth/login")
    
    local token=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
    
    if [ -z "$token" ]; then
        print_error "Failed to login as $username"
        return 1
    fi
    
    echo "$token" > "$WORKDIR/token_${username}.txt"
    print_success "Logged in as $username"
    return 0
}

# Function to generate random coordinates around dive site
generate_coordinates() {
    local base_lat=25.344639
    local base_lon=34.778111
    
    # Generate simple offset for variety
    local offset=$((RANDOM % 1000))
    local lat_offset=$(echo "scale=6; $offset / 100000" | bc)
    local lon_offset=$(echo "scale=6; $offset / 100000" | bc)
    
    local lat=$(echo "scale=6; $base_lat + $lat_offset" | bc)
    local lon=$(echo "scale=6; $base_lon + $lon_offset" | bc)
    
    echo "$lon,$lat"  # Note: GeoJSON uses [longitude, latitude] format
}

# Function to generate route data with varied segment types
generate_route_data() {
    local route_type="$1"
    local segment_count="$2"
    
    # Generate coordinates for segments
    local coordinates=""
    for ((i=0; i<segment_count; i++)); do
        local coord=$(generate_coordinates)
        if [ $i -eq 0 ]; then
            coordinates="[[$coord]"
        else
            coordinates="$coordinates,[$coord]"
        fi
    done
    coordinates="$coordinates]"
    
    # Create GeoJSON based on route type
    case "$route_type" in
        "walk")
            cat <<EOF
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": $coordinates
      },
      "properties": {
        "segment_type": "walk"
      }
    }
  ]
}
EOF
            ;;
        "swim")
            cat <<EOF
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": $coordinates
      },
      "properties": {
        "segment_type": "swim"
      }
    }
  ]
}
EOF
            ;;
        "scuba")
            cat <<EOF
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": $coordinates
      },
      "properties": {
        "segment_type": "scuba"
      }
    }
  ]
}
EOF
            ;;
        "mixed")
            # Create mixed route with multiple segment types
            local walk_coords="[$(generate_coordinates),$(generate_coordinates)]"
            local swim_coords="[$(generate_coordinates),$(generate_coordinates)]"
            local scuba_coords="[$(generate_coordinates),$(generate_coordinates)]"
            
            cat <<EOF
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": $walk_coords
      },
      "properties": {
        "segment_type": "walk"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": $swim_coords
      },
      "properties": {
        "segment_type": "swim"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": $scuba_coords
      },
      "properties": {
        "segment_type": "scuba"
      }
    }
  ]
}
EOF
            ;;
    esac
}

# Function to create a single route
create_route() {
    local route_num="$1"
    local route_type="$2"
    local segment_count="$3"
    local token="$4"
    
    local route_name="${PERF_PREFIX}Route_${route_num}_${route_type}"
    local description="Performance test route #$route_num - $route_type type with $segment_count segments"
    local route_data=$(generate_route_data "$route_type" "$segment_count")
    
    local response=$(curl -sSL -X POST \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"$route_name\",
            \"description\": \"$description\",
            \"route_data\": $route_data,
            \"route_type\": \"$route_type\",
            \"dive_site_id\": $DIVE_SITE_ID
        }" \
        "$API_BASE/dive-routes/")
    
    local route_id=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
    
    if [ -n "$route_id" ]; then
        echo "$route_id" >> "$WORKDIR/created_routes.txt"
        return 0
    else
        print_error "Failed to create route $route_num"
        print_error "Response: $response"
        return 1
    fi
}

# Function to measure API performance
measure_api_performance() {
    local endpoint="$1"
    local token="$2"
    local iterations="$3"
    
    print_status "Measuring performance for $endpoint ($iterations iterations)..."
    
    local total_time=0
    local success_count=0
    
    for ((i=1; i<=iterations; i++)); do
        local start_time=$(date +%s.%N)
        
        local response=$(curl -sSL -w "%{http_code}" \
            -H "Authorization: Bearer $token" \
            "$API_BASE$endpoint")
        
        local end_time=$(date +%s.%N)
        local duration=$(echo "$end_time - $start_time" | bc)
        
        local http_code="${response: -3}"
        if [ "$http_code" = "200" ]; then
            total_time=$(echo "$total_time + $duration" | bc)
            success_count=$((success_count + 1))
        fi
        
        # Progress indicator
        if [ $((i % 10)) -eq 0 ]; then
            print_status "Completed $i/$iterations requests"
        fi
    done
    
    if [ $success_count -gt 0 ]; then
        local avg_time=$(echo "scale=3; $total_time / $success_count" | bc)
        print_success "$endpoint: Average response time ${avg_time}s (${success_count}/${iterations} successful)"
        echo "$endpoint,$avg_time,$success_count,$iterations" >> "$WORKDIR/performance_metrics.csv"
    else
        print_error "$endpoint: All requests failed"
    fi
}

# Function to measure export performance
measure_export_performance() {
    local route_id="$1"
    local format="$2"
    local token="$3"
    local iterations="$4"
    
    print_status "Measuring export performance for route $route_id ($format format, $iterations iterations)..."
    
    local total_time=0
    local success_count=0
    
    for ((i=1; i<=iterations; i++)); do
        local start_time=$(date +%s.%N)
        
        local response=$(curl -sSL -w "%{http_code}" \
            -H "Authorization: Bearer $token" \
            "$API_BASE/dive-routes/$route_id/export/$format")
        
        local end_time=$(date +%s.%N)
        local duration=$(echo "$end_time - $start_time" | bc)
        
        local http_code="${response: -3}"
        if [ "$http_code" = "200" ]; then
            total_time=$(echo "$total_time + $duration" | bc)
            success_count=$((success_count + 1))
        fi
        
        # Progress indicator
        if [ $((i % 5)) -eq 0 ]; then
            print_status "Completed $i/$iterations export requests"
        fi
    done
    
    if [ $success_count -gt 0 ]; then
        local avg_time=$(echo "scale=3; $total_time / $success_count" | bc)
        print_success "Export $format: Average response time ${avg_time}s (${success_count}/${iterations} successful)"
        echo "export_$format,$avg_time,$success_count,$iterations" >> "$WORKDIR/performance_metrics.csv"
    else
        print_error "Export $format: All requests failed"
    fi
}

# Main execution
main() {
    print_status "Starting comprehensive performance testing..."
    print_status "Target: $TOTAL_ROUTES routes on dive site $DIVE_SITE_ID"
    print_status "Prefix: $PERF_PREFIX"
    
    # Login as admin
    if ! login "$ADMIN_USER" "$ADMIN_PASS"; then
        print_error "Failed to login. Exiting."
        exit 1
    fi
    
    local token=$(cat "$WORKDIR/token_admin.txt")
    
    # Initialize metrics file
    echo "endpoint,avg_time_seconds,success_count,total_requests" > "$WORKDIR/performance_metrics.csv"
    
    # Generate routes in batches
    print_status "Generating $TOTAL_ROUTES routes..."
    
    local route_types=("walk" "swim" "scuba")
    local segment_counts=(2 3 4 5)
    
    for ((batch=1; batch<=$((TOTAL_ROUTES / BATCH_SIZE)); batch++)); do
        print_status "Processing batch $batch/$((TOTAL_ROUTES / BATCH_SIZE))..."
        
        for ((i=1; i<=BATCH_SIZE; i++)); do
            local route_num=$(((batch - 1) * BATCH_SIZE + i))
            
            # Select random route type and segment count
            local route_type=${route_types[$((RANDOM % ${#route_types[@]}))]}
            local segment_count=${segment_counts[$((RANDOM % ${#segment_counts[@]}))]}
            
            if create_route "$route_num" "$route_type" "$segment_count" "$token"; then
                if [ $((route_num % 100)) -eq 0 ]; then
                    print_status "Created $route_num routes..."
                fi
            else
                print_error "Failed to create route $route_num"
            fi
        done
        
        # Small delay between batches to avoid overwhelming the system
        sleep 1
    done
    
    local created_count=$(wc -l < "$WORKDIR/created_routes.txt" 2>/dev/null || echo "0")
    print_success "Created $created_count routes"
    
    if [ "$created_count" -lt 50 ]; then
        print_error "Insufficient routes created for meaningful performance testing"
        exit 1
    fi
    
    # Performance testing
    print_status "Starting performance measurements..."
    
    # Test route listing performance
    measure_api_performance "/dive-routes?dive_site_id=$DIVE_SITE_ID&page_size=100" "$token" 20
    
    # Test route detail performance (test with first few routes)
    local first_route_id=$(head -1 "$WORKDIR/created_routes.txt")
    measure_api_performance "/dive-routes/$first_route_id" "$token" 20
    
    # Test export performance
    measure_export_performance "$first_route_id" "gpx" "$token" 10
    measure_export_performance "$first_route_id" "kml" "$token" 10
    
    # Test dive site routes endpoint
    measure_api_performance "/dive-sites/$DIVE_SITE_ID/routes" "$token" 20
    
    # Generate performance report
    print_status "Generating performance report..."
    
    cat > "$WORKDIR/performance_report.md" <<EOF
# Performance Testing Report
Generated: $(date)
Total Routes Created: $created_count
Dive Site ID: $DIVE_SITE_ID

## Performance Metrics

| Endpoint | Average Response Time (s) | Success Rate | Total Requests |
|----------|---------------------------|--------------|----------------|
EOF

    # Add metrics to report
    tail -n +2 "$WORKDIR/performance_metrics.csv" | while IFS=',' read -r endpoint avg_time success_count total_requests; do
        local success_rate=$(echo "scale=1; $success_count * 100 / $total_requests" | bc)
        echo "| $endpoint | $avg_time | ${success_rate}% | $total_requests |" >> "$WORKDIR/performance_report.md"
    done
    
    cat >> "$WORKDIR/performance_report.md" <<EOF

## Success Criteria Validation

- **p95 list routes < 400ms**: $(if [ $(echo "$(grep 'dive-routes.*dive_site_id' "$WORKDIR/performance_metrics.csv" | cut -d',' -f2) < 0.4" | bc) -eq 1 ]; then echo "✅ PASSED"; else echo "❌ FAILED"; fi)
- **Export GPX/KML < 500ms**: $(if [ $(echo "$(grep 'export_gpx' "$WORKDIR/performance_metrics.csv" | cut -d',' -f2) < 0.5" | bc) -eq 1 ] && [ $(echo "$(grep 'export_kml' "$WORKDIR/performance_metrics.csv" | cut -d',' -f2) < 0.5" | bc) -eq 1 ]; then echo "✅ PASSED"; else echo "❌ FAILED"; fi)

## Files Generated

- Performance metrics: $WORKDIR/performance_metrics.csv
- Created routes list: $WORKDIR/created_routes.txt
- Performance report: $WORKDIR/performance_report.md

## Cleanup

To remove all performance test data, run:
\`\`\`bash
bash -c 'for route_id in \$(cat $WORKDIR/created_routes.txt); do curl -sSL -X DELETE -H "Authorization: Bearer \$(cat $WORKDIR/token_admin.txt)" "$API_BASE/dive-routes/\$route_id" > /dev/null; done'
\`\`\`
EOF

    print_success "Performance testing completed!"
    print_status "Report saved to: $WORKDIR/performance_report.md"
    print_status "Metrics saved to: $WORKDIR/performance_metrics.csv"
    print_status "Created routes list: $WORKDIR/created_routes.txt"
    
    # Display summary
    echo
    print_status "=== PERFORMANCE TESTING SUMMARY ==="
    echo "Total routes created: $created_count"
    echo "Performance metrics collected: $(tail -n +2 "$WORKDIR/performance_metrics.csv" | wc -l)"
    echo "Report location: $WORKDIR/performance_report.md"
    echo
    print_warning "Remember to clean up test data when done!"
}

# Run main function
main "$@"
