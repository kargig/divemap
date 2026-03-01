#!/bin/bash
set -e

# Extract database host and port from DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "💥 ERROR: DATABASE_URL environment variable is not set"
    exit 1
fi

# Parse DATABASE_URL to extract host and port
# Expected format: mysql+pymysql://user:password@host:port/database
if [[ "$DATABASE_URL" =~ mysql\+pymysql://[^@]+@([^:]+):([^/]+)/ ]]; then
    DB_HOST="${BASH_REMATCH[1]}"
    DB_PORT="${BASH_REMATCH[2]}"
    echo "✅ Successfully parsed DATABASE_URL"
    echo "📡 Database host: $DB_HOST:$DB_PORT"
else
    echo "💥 ERROR: Could not parse DATABASE_URL format"
    echo "Expected format: mysql+pymysql://user:password@host:port/database"
    echo "Current DATABASE_URL: $DATABASE_URL"
    exit 1
fi

echo "Waiting for database to be ready..."

# Function to check database connectivity with IPv6 support
check_db() {
    # Try IPv6 first, then fallback to IPv4
    if command -v nc >/dev/null 2>&1; then
        # Use netcat-openbsd with IPv6 support
        echo "🔍 Attempting to connect to $DB_HOST:$DB_PORT..."
        nc -z -w 5 $DB_HOST $DB_PORT 2>/dev/null
        return $?
    else
        echo "ERROR: netcat not found"
        return 1
    fi
}

# Try to connect to database with retries (optimized with fixed intervals for cold starts)
attempt=1
max_attempts=25
fixed_delay=0.2

while [ $attempt -le $max_attempts ]; do
    echo "Attempt $attempt/$max_attempts: Checking database connectivity..."
    
    if check_db; then
        echo "✅ Database is ready!"
        break
    else
        echo "❌ Database not ready yet. Attempt $attempt/$max_attempts failed."
        
        if [ $attempt -eq $max_attempts ]; then
            echo "💥 ERROR: Database connection failed after $max_attempts attempts. Exiting."
            exit 1
        fi
        
        # Fixed interval: 0.2s between attempts (optimized for cold starts)
        # This provides the fastest possible detection for predictable database startup
        echo "⏳ Waiting ${fixed_delay}s before next attempt..."
        sleep $fixed_delay
        
        attempt=$((attempt + 1))
    fi
done

echo "🚀 Starting application..."

# Generate LLM content (runs in background to not block startup)
echo "🤖 Checking LLM content (background)..."
python generate_static_content.py > /tmp/llm_gen.log 2>&1 &

# Check if we're in development mode
if [ "$ENVIRONMENT" = "development" ]; then
    echo "🔄 Development mode detected - enabling auto-reload"
    python run_migrations.py && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --proxy-headers --forwarded-allow-ips '*'
else
    echo "🚀 Production mode - no auto-reload"
    python run_migrations.py && uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips '*'
fi 
