#!/bin/bash
set -e

# Database connection configuration
DB_HOST="db"
DB_PORT="3306"

echo "Waiting for database to be ready..."
echo "📡 Database host: $DB_HOST:$DB_PORT"

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

echo "🚀 Starting application..."
python run_migrations.py && uvicorn app.main:app --host 0.0.0.0 --port 8000 