#!/bin/bash

# Script to run Alembic migrations in Docker environment
# This script sets up the proper PYTHONPATH for asdf Python environments

set -e

echo "🚀 Starting database migration process in Docker..."

# Activate virtual environment and set PYTHONPATH
source divemap_venv/bin/activate
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.13/site-packages:$PYTHONPATH"

# Run migrations
echo "Running database migrations..."
python run_migrations.py

echo "✅ Database migration process completed successfully!" 