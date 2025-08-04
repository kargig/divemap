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

# Try to connect to database with retries
attempt=1
max_attempts=10

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
        
        # Sleep for random time between 1 and 5 seconds
        sleep_time=$((RANDOM % 5 + 1))
        echo "⏳ Waiting $sleep_time seconds before next attempt..."
        sleep $sleep_time
        
        attempt=$((attempt + 1))
    fi
done

echo "🚀 Starting application in development mode with auto-reload..."
echo "🔄 Development mode - enabling auto-reload with enhanced directory watching"
python run_migrations.py && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir /app/app --reload-dir /app/migrations 