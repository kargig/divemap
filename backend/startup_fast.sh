#!/bin/bash
set -e

# Fast startup script for development - skips database checks and migrations
echo "⚡ Fast startup mode - skipping database checks and migrations"
echo "🚀 Starting application directly..."

# Set environment variables for faster startup
export SKIP_MIGRATIONS=true
export LOG_LEVEL=ERROR

# Start uvicorn directly with optimized settings
uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --reload-dir /app/app \
    --reload-dir /app/migrations \
    --log-level error \
    --access-log \
    --no-use-colors
