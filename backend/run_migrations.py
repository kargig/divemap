#!/usr/bin/env python3
"""
Script to run Alembic migrations before starting the FastAPI backend.
This ensures the database schema is up to date.
"""

import os
import sys
import subprocess
import time
import sqlalchemy as sa
from pathlib import Path

def wait_for_database(max_retries=25, fixed_delay=0.2):
    """Wait for database to be available with fixed intervals (optimized for cold starts)"""
    print("Waiting for database to be available...")

    # Add the backend directory to Python path
    backend_dir = Path(__file__).parent
    sys.path.insert(0, str(backend_dir))

    from app.database import engine

    for attempt in range(max_retries):
        try:
            # Try to connect to the database
            with engine.connect() as conn:
                conn.execute(sa.text("SELECT 1"))
            print("✅ Database is available!")
            return True
        except Exception as e:
            print(f"⏳ Database not ready (attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                # Fixed interval: 0.2s between attempts (optimized for cold starts)
                # This provides the fastest possible detection for predictable database startup
                print(f"⏳ Waiting {fixed_delay}s before next attempt...")
                time.sleep(fixed_delay)

    print("❌ Database is not available after maximum retries")
    return False

def run_migrations():
    """Run Alembic migrations"""
    print("Running database migrations...")

    try:
        # Run alembic upgrade head
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            cwd=Path(__file__).parent,
            capture_output=True,
            text=True,
            check=True
        )
        print("✅ Migrations completed successfully!")
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print("❌ Migration failed!")
        print(f"Error: {e}")
        print(f"stdout: {e.stdout}")
        print(f"stderr: {e.stderr}")
        return False
    except FileNotFoundError:
        print("❌ Alembic not found. Make sure it's installed in the virtual environment.")
        return False

def main():
    """Main function to run migrations"""
    print("🚀 Starting database migration process...")

    # Wait for database to be available
    if not wait_for_database():
        sys.exit(1)

    # Run migrations
    if not run_migrations():
        sys.exit(1)

    print("✅ Database migration process completed successfully!")

if __name__ == "__main__":
    main()
