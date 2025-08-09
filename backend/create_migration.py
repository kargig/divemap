#!/usr/bin/env python3
"""
Script to create new Alembic migrations.
Usage: python create_migration.py "Description of the migration"
"""

import sys
import subprocess
from pathlib import Path

def create_migration(description):
    """Create a new Alembic migration"""
    print(f"Creating migration: {description}")

    try:
        # Run alembic revision --autogenerate
        result = subprocess.run(
            ["alembic", "revision", "--autogenerate", "-m", description],
            cwd=Path(__file__).parent,
            capture_output=True,
            text=True,
            check=True
        )
        print("✅ Migration created successfully!")
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print("❌ Failed to create migration!")
        print(f"Error: {e}")
        print(f"stdout: {e.stdout}")
        print(f"stderr: {e.stderr}")
        return False
    except FileNotFoundError:
        print("❌ Alembic not found. Make sure it's installed in the virtual environment.")
        return False

def main():
    """Main function"""
    if len(sys.argv) != 2:
        print("Usage: python create_migration.py 'Description of the migration'")
        print("Example: python create_migration.py 'Add user preferences table'")
        sys.exit(1)

    description = sys.argv[1]

    if not create_migration(description):
        sys.exit(1)

    print("✅ Migration creation completed successfully!")

if __name__ == "__main__":
    main()