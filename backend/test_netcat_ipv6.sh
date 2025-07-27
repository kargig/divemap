#!/bin/bash

# Test script to verify netcat IPv6 support
echo "Testing netcat IPv6 support..."

# Check if netcat-openbsd is installed
if command -v nc >/dev/null 2>&1; then
    echo "✅ netcat found: $(which nc)"
    echo "Version info:"
    nc -h 2>&1 | head -5
else
    echo "❌ netcat not found"
    exit 1
fi

# Test IPv6 support
echo ""
echo "Testing IPv6 support..."
if nc -6 -z google.com 80 2>/dev/null; then
    echo "✅ IPv6 support confirmed"
else
    echo "⚠️  IPv6 test failed, but this might be due to network configuration"
fi

# Test database connectivity (if db host is available)
echo ""
echo "Testing database connectivity..."

# Extract database host and port from DATABASE_URL if available
if [ -n "$DATABASE_URL" ]; then
    if [[ "$DATABASE_URL" =~ mysql\+pymysql://[^@]+@([^:]+):([^/]+)/ ]]; then
        DB_HOST="${BASH_REMATCH[1]}"
        DB_PORT="${BASH_REMATCH[2]}"
        echo "📡 Testing connection to $DB_HOST:$DB_PORT (from DATABASE_URL)..."
        if nc -z -w 5 $DB_HOST $DB_PORT 2>/dev/null; then
            echo "✅ Database connectivity confirmed"
        else
            echo "❌ Database connectivity failed (this is expected if database is not running)"
        fi
    else
        echo "⚠️  Could not parse DATABASE_URL, testing default db:3306..."
        if nc -z -w 5 db 3306 2>/dev/null; then
            echo "✅ Database connectivity confirmed"
        else
            echo "❌ Database connectivity failed (this is expected if database is not running)"
        fi
    fi
else
    echo "📡 Testing connection to db:3306 (default)..."
    if nc -z -w 5 db 3306 2>/dev/null; then
        echo "✅ Database connectivity confirmed"
    else
        echo "❌ Database connectivity failed (this is expected if database is not running)"
    fi
fi

echo ""
echo "Netcat test completed." 