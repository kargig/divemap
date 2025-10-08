#!/bin/bash
set -e

# Cloudflare cache warmup script
# This script primes the cache with key assets after deployment

DOMAIN="${DOMAIN:-localhost:8000}"
PROTOCOL="${PROTOCOL:-http}"

echo "🔥 Warming up Cloudflare cache for $PROTOCOL://$DOMAIN"

# Curl options for reliable requests
CURL_OPTS="--fail --silent --show-error --max-time 10 --connect-timeout 5 --retry 3 --retry-delay 1 --retry-all-errors --compressed"

# Function to warm an endpoint
warm_endpoint() {
    local url="$1"
    local description="$2"
    
    echo "  🔥 Warming: $description"
    if curl $CURL_OPTS "$url" >/dev/null; then
        echo "    ✅ Success"
    else
        echo "    ❌ Failed"
        return 1
    fi
}

# Warm main HTML
warm_endpoint "$PROTOCOL://$DOMAIN/" "Homepage (index.html)"

# Warm health endpoint
warm_endpoint "$PROTOCOL://$DOMAIN/health" "Health check"

# Try to warm some common static assets (these will be hashed in production)
# We'll warm the most common patterns
echo "  🔥 Warming static assets (if available)..."

# Common static asset patterns to warm
STATIC_PATTERNS=(
    "static/js/main"
    "static/css/main"
    "static/js/runtime"
    "static/css/runtime"
)

for pattern in "${STATIC_PATTERNS[@]}"; do
    # Find the actual hashed files and warm them
    find nginx/frontend-build -path "*/$pattern*" -type f \( -name "*.js" -o -name "*.css" \) | head -1 | while read -r file; do
        if [ -n "$file" ]; then
            # Extract the relative path from nginx/frontend-build
            rel_path="${file#nginx/frontend-build/}"
            warm_endpoint "$PROTOCOL://$DOMAIN/$rel_path" "Static asset: $rel_path"
        fi
    done
done

echo "✅ Cache warmup complete!"
echo "💡 Check Cloudflare analytics for cache hit rates"

