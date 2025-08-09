#!/usr/bin/env python3
"""
Database Export/Import Script for Diving Centers and Dive Sites

This script exports diving centers, dive sites, and related tables from the local
development database and imports them to the fly.io production database.

Features:
- Creates full database backups before any operations
- Exports only relevant tables (diving centers, dive sites, and related data)
- Imports data to fly.io database, overwriting existing data
- Handles foreign key relationships properly
- Provides detailed logging and error handling

Usage:
    python utils/export_import_diving_data.py

Requirements:
    - MySQL client tools installed
    - Access to both local and fly.io databases
    - Proper credentials configured
"""

import os
import sys
import subprocess
import datetime
import json
import logging
import argparse
from pathlib import Path
from typing import List, Dict, Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('export_import_diving_data.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class DatabaseExporter:
    def __init__(self, dry_run=False, preserve_tags=False, preserve_organizations=False):
        self.dry_run = dry_run
        self.preserve_tags = preserve_tags
        self.preserve_organizations = preserve_organizations
        self.project_root = Path(__file__).parent.parent
        self.backup_dir = self.project_root / "database_backups"
        self.backup_dir.mkdir(exist_ok=True)
        
        # Local database credentials (from environment variables)
        self.local_db_config = {
            'host': os.getenv('LOCAL_DB_HOST', 'localhost'),
            'port': int(os.getenv('LOCAL_DB_PORT', '3306')),
            'database': os.getenv('LOCAL_DB_NAME', 'divemap'),
            'user': os.getenv('LOCAL_DB_USER', 'divemap_user'),
            'password': os.getenv('LOCAL_DB_PASSWORD', 'divemap_password')
        }
        
        # Fly.io database credentials (from environment variables or credential file)
        fly_credentials = self._load_fly_credentials()
        self.fly_db_config = {
            'host': os.getenv('FLY_DB_HOST', 'divemap-db.flycast'),
            'port': int(os.getenv('FLY_DB_PORT', '3306')),
            'database': os.getenv('FLY_DB_NAME', 'divemap'),
            'user': fly_credentials.get('user', os.getenv('FLY_DB_USER', 'divemap_user')),
            'password': fly_credentials.get('password', os.getenv('FLY_DB_PASSWORD', ''))
        }
        
        # Tables to export (in order of dependencies)
        self.tables_to_export = [
            # Core tables
            'diving_organizations',
            'available_tags',
            'dive_sites',
            'dive_site_aliases',
            'diving_centers',
            
            # Relationship tables
            'center_dive_sites',
            'diving_center_organizations',
            'dive_site_tags',
            
            # Media and content tables
            'site_media',
            'gear_rental_costs',
            
            # Rating and comment tables
            'site_ratings',
            'site_comments',
            'center_ratings',
            'center_comments',
            
            # Trip and dive tables
            'parsed_dive_trips',
            'parsed_dives'
        ]
        
        # Tables that reference diving centers or dive sites
        self.related_tables = [
            'dives',  # Contains dive_site_id and diving_center_id
        ]

    def _load_fly_credentials(self) -> Dict[str, str]:
        """Load Fly.io database credentials from credential file or environment variables."""
        credentials = {}
        
        # Try to load from credential file first
        credential_file = self.project_root / "database" / "FLY_secrets"
        
        if credential_file.exists():
            try:
                with open(credential_file, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            key, value = line.split('=', 1)
                            credentials[key.strip()] = value.strip()
                logger.info(f"Loaded Fly.io credentials from {credential_file}")
            except Exception as e:
                logger.warning(f"Could not load credentials from {credential_file}: {e}")
        
        # Check if we have the required credentials
        if not credentials.get('MYSQL_USER') and not os.getenv('FLY_DB_USER'):
            logger.error("Fly.io database user not found in credentials file or FLY_DB_USER environment variable")
            raise ValueError("Fly.io database user not configured")
            
        if not credentials.get('MYSQL_PASSWORD') and not os.getenv('FLY_DB_PASSWORD'):
            logger.error("Fly.io database password not found in credentials file or FLY_DB_PASSWORD environment variable")
            raise ValueError("Fly.io database password not configured")
        
        # Map credential file keys to expected keys
        return {
            'user': credentials.get('MYSQL_USER', ''),
            'password': credentials.get('MYSQL_PASSWORD', '')
        }

    def _validate_backup_file(self, backup_file: Path, backup_name: str) -> bool:
        """Validate that a backup file contains data and is not empty."""
        logger.info(f"Validating backup file: {backup_file}")
        
        try:
            # Check if file exists and has content
            if not backup_file.exists():
                logger.error(f"Backup file does not exist: {backup_file}")
                return False
            
            file_size = backup_file.stat().st_size
            if file_size == 0:
                logger.error(f"Backup file is empty: {backup_file}")
                return False
            
            # Read file content for validation
            with open(backup_file, 'r') as f:
                content = f.read()
            
            # Check for essential SQL elements
            if not content.strip():
                logger.error(f"Backup file contains only whitespace: {backup_file}")
                return False
            
            # Check for MySQL dump header
            if not content.startswith('-- MySQL dump'):
                logger.warning(f"Backup file may not be a valid MySQL dump: {backup_file}")
            
            # Check for database creation
            if 'CREATE DATABASE' not in content and 'USE `' not in content:
                logger.warning(f"Backup file may not contain database structure: {backup_file}")
            
            # Check for table creation statements
            if 'CREATE TABLE' not in content:
                logger.error(f"Backup file does not contain table creation statements: {backup_file}")
                return False
            
            # Check for INSERT statements (data)
            if 'INSERT INTO' not in content:
                logger.warning(f"Backup file may not contain data (no INSERT statements): {backup_file}")
            
            # Log file size for reference
            logger.info(f"✓ Backup file validation passed: {backup_file} ({file_size} bytes)")
            return True
            
        except Exception as e:
            logger.error(f"Error validating backup file {backup_file}: {e}")
            return False

    def _validate_export_file(self, export_file: Path, export_name: str) -> bool:
        """Validate that an export file contains the expected tables and data."""
        logger.info(f"Validating export file: {export_file}")
        
        try:
            # Check if file exists and has content
            if not export_file.exists():
                logger.error(f"Export file does not exist: {export_file}")
                return False
            
            file_size = export_file.stat().st_size
            if file_size == 0:
                logger.error(f"Export file is empty: {export_file}")
                return False
            
            # Read file content for validation
            with open(export_file, 'r') as f:
                content = f.read()
            
            # Check for essential SQL elements
            if not content.strip():
                logger.error(f"Export file contains only whitespace: {export_file}")
                return False
            
            # Check for MySQL dump header
            if not content.startswith('-- MySQL dump'):
                logger.warning(f"Export file may not be a valid MySQL dump: {export_file}")
            
            # Check for expected table creation statements
            missing_tables = []
            for table in self.tables_to_export:
                if f"CREATE TABLE `{table}`" not in content:
                    missing_tables.append(table)
            
            if missing_tables:
                logger.error(f"Export file missing table creation statements: {missing_tables}")
                return False
            
            # Check for INSERT statements (data)
            insert_count = content.count('INSERT INTO')
            if insert_count == 0:
                logger.warning(f"Export file may not contain data (no INSERT statements): {export_file}")
            else:
                logger.info(f"Found {insert_count} INSERT statements in export file")
            
            # Enhanced validation: Check for actual data in key tables
            if not self._validate_key_table_data(content):
                return False
            
            # Log file size for reference
            logger.info(f"✓ Export file validation passed: {export_file} ({file_size} bytes)")
            logger.info(f"✓ All expected tables found: {', '.join(self.tables_to_export)}")
            return True
            
        except Exception as e:
            logger.error(f"Error validating export file {export_file}: {e}")
            return False

    def _validate_key_table_data(self, content: str) -> bool:
        """Validate that key tables contain actual data."""
        logger.info("Validating key table data...")
        
        # Define key tables and their minimum required records
        key_tables = {
            'dive_sites': 1,      # Must have at least 1 dive site
            'diving_centers': 1   # Must have at least 1 diving center
        }
        
        validation_passed = True
        
        for table, min_records in key_tables.items():
            # Check if INSERT statement exists for the table
            insert_pattern = f"INSERT INTO `{table}`"
            if insert_pattern not in content:
                logger.error(f"❌ No INSERT statement found for key table: {table}")
                validation_passed = False
                continue
            
            # Extract the INSERT statement for this table
            try:
                # Find the INSERT statement block
                start_marker = f"--\n-- Dumping data for table `{table}`\n--\n\n"
                if start_marker in content:
                    start_idx = content.find(start_marker) + len(start_marker)
                    # Find the end of this INSERT block (next comment or end of file)
                    end_idx = content.find("\n--\n--", start_idx)
                    if end_idx == -1:
                        end_idx = len(content)
                    
                    insert_block = content[start_idx:end_idx]
                else:
                    # Fallback: find INSERT statement directly
                    start_idx = content.find(insert_pattern)
                    end_idx = content.find(";", start_idx)
                    if end_idx == -1:
                        end_idx = len(content)
                    insert_block = content[start_idx:end_idx]
                
                # Count the number of value tuples in the INSERT statement
                # Look for patterns like (1,'name','desc'),(2,'name2','desc2')
                value_tuples = insert_block.count("),(") + 1  # Count separators + 1
                
                # Also count single values like (1,'name','desc')
                if "),(" not in insert_block and "(" in insert_block:
                    value_tuples = insert_block.count("(")
                
                logger.info(f"✓ {table}: Found {value_tuples} records")
                
                if value_tuples < min_records:
                    logger.error(f"❌ {table}: Insufficient data - found {value_tuples} records, need at least {min_records}")
                    validation_passed = False
                else:
                    logger.info(f"✓ {table}: Data validation passed ({value_tuples} records)")
                    
            except Exception as e:
                logger.error(f"❌ Error validating {table} data: {e}")
                validation_passed = False
        
        if validation_passed:
            logger.info("✓ All key table data validation passed")
        else:
            logger.error("❌ Key table data validation failed")
        
        return validation_passed

    def _validate_source_database(self, db_config: Dict[str, Any]) -> bool:
        """Validate that the source database contains the required data before export."""
        logger.info(f"Validating source database: {db_config['host']}")
        
        # Define key tables and their minimum required records
        key_tables = {
            'dive_sites': 1,      # Must have at least 1 dive site
            'diving_centers': 1   # Must have at least 1 diving center
        }
        
        validation_passed = True
        
        for table, min_records in key_tables.items():
            try:
                # Query to count records in the table
                command = [
                    'mysql',
                    f'--host={db_config["host"]}',
                    f'--port={db_config["port"]}',
                    f'--user={db_config["user"]}',
                    f'--password={db_config["password"]}',
                    '--silent',  # Suppress headers
                    '--skip-column-names',  # Don't show column names
                    db_config['database'],
                    '-e',
                    f'SELECT COUNT(*) FROM {table};'
                ]
                
                result = subprocess.run(
                    command,
                    capture_output=True,
                    text=True,
                    check=True,
                    timeout=30
                )
                
                # Parse the count
                count = int(result.stdout.strip())
                logger.info(f"✓ {table}: Found {count} records in source database")
                
                if count < min_records:
                    logger.error(f"❌ {table}: Insufficient data in source - found {count} records, need at least {min_records}")
                    validation_passed = False
                else:
                    logger.info(f"✓ {table}: Source data validation passed ({count} records)")
                    
            except subprocess.CalledProcessError as e:
                logger.error(f"❌ Error querying {table} in source database: {e.stderr}")
                validation_passed = False
            except ValueError as e:
                logger.error(f"❌ Error parsing count for {table}: {e}")
                validation_passed = False
            except subprocess.TimeoutExpired:
                logger.error(f"❌ Timeout querying {table} in source database")
                validation_passed = False
            except Exception as e:
                logger.error(f"❌ Unexpected error validating {table}: {e}")
                validation_passed = False
        
        if validation_passed:
            logger.info("✓ All source database validation passed")
        else:
            logger.error("❌ Source database validation failed")
        
        return validation_passed

    def get_timestamp(self) -> str:
        """Get current timestamp for backup naming."""
        return datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

    def run_command(self, command: List[str], description: str) -> bool:
        """Run a shell command with error handling."""
        logger.info(f"Running: {description}")
        logger.debug(f"Command: {' '.join(command)}")
        
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=True
            )
            logger.info(f"✓ {description} completed successfully")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"✗ {description} failed")
            logger.error(f"Error: {e.stderr}")
            return False

    def create_full_backup(self, db_config: Dict[str, Any], backup_name: str) -> bool:
        """Create a full database backup."""
        backup_file = self.backup_dir / f"{backup_name}_{self.get_timestamp()}.sql"
        
        if self.dry_run:
            logger.info(f"[DRY-RUN] Would create full backup: {backup_file}")
            return True
        
        command = [
            'mysqldump',
            f'--host={db_config["host"]}',
            f'--port={db_config["port"]}',
            f'--user={db_config["user"]}',
            f'--password={db_config["password"]}',
            '--single-transaction',
            '--routines',
            '--triggers',
            '--events',
            '--add-drop-database',
            '--add-drop-table',
            db_config['database']
        ]
        
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=True
            )
            
            # Write the output to the backup file
            with open(backup_file, 'w') as f:
                f.write(result.stdout)
            
            # Validate the backup file
            if not self._validate_backup_file(backup_file, backup_name):
                logger.error(f"✗ Backup validation failed: {backup_name}")
                return False
            
            logger.info(f"✓ Creating full backup: {backup_name} completed successfully")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"✗ Creating full backup: {backup_name} failed")
            logger.error(f"Error: {e.stderr}")
            return False

    def export_selected_tables(self, db_config: Dict[str, Any], export_name: str) -> bool:
        """Export only the selected tables."""
        export_file = self.backup_dir / f"{export_name}_{self.get_timestamp()}.sql"
        
        if self.dry_run:
            logger.info(f"[DRY-RUN] Would export tables to: {export_file}")
            logger.info(f"[DRY-RUN] Tables to export: {', '.join(self.tables_to_export)}")
            return True
        
        # Pre-export validation: Check that source database has data
        if not self._validate_source_database(db_config):
            logger.error(f"✗ Source database validation failed: {export_name}")
            return False
        
        # Build mysqldump command for selected tables
        command = [
            'mysqldump',
            f'--host={db_config["host"]}',
            f'--port={db_config["port"]}',
            f'--user={db_config["user"]}',
            f'--password={db_config["password"]}',
            '--single-transaction',
            '--add-drop-table',
            '--disable-keys',
            '--extended-insert',
            '--set-charset',
            db_config['database']
        ] + self.tables_to_export
        
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=True
            )
            
            # Write the output to the export file
            with open(export_file, 'w') as f:
                f.write(result.stdout)
            
            # Validate the export file
            if not self._validate_export_file(export_file, export_name):
                logger.error(f"✗ Export validation failed: {export_name}")
                return False
            
            logger.info(f"✓ Exporting selected tables: {export_name} completed successfully")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"✗ Exporting selected tables: {export_name} failed")
            logger.error(f"Error: {e.stderr}")
            return False

    def import_tables(self, db_config: Dict[str, Any], import_file: str) -> bool:
        """Import tables to the target database."""
        logger.info(f"Importing tables to {db_config['host']}")
        logger.debug(f"Import file: {import_file}")
        
        if self.dry_run:
            logger.info(f"[DRY-RUN] Would import data from: {import_file}")
            logger.info(f"[DRY-RUN] Target database: {db_config['host']}")
            return True
        
        try:
            with open(import_file, 'r') as f:
                sql_content = f.read()
            
            command = [
                'mysql',
                f'--host={db_config["host"]}',
                f'--port={db_config["port"]}',
                f'--user={db_config["user"]}',
                f'--password={db_config["password"]}',
                db_config['database']
            ]
            
            result = subprocess.run(
                command,
                input=sql_content,
                text=True,
                capture_output=True,
                check=True
            )
            
            logger.info(f"✓ Import completed successfully")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"✗ Import failed")
            logger.error(f"Error: {e.stderr}")
            return False
        except Exception as e:
            logger.error(f"✗ Import failed: {e}")
            return False

    def clear_existing_data(self, db_config: Dict[str, Any]) -> bool:
        """Clear existing diving centers and dive sites data from target database."""
        logger.info("Clearing existing diving centers and dive sites data...")
        
        # Tables to clear (in reverse dependency order)
        tables_to_clear = [
            'dive_media',           # References dives
            'dive_tags',            # References dives
            'dives',                # References dive_sites and diving_centers
            'parsed_dives',
            'parsed_dive_trips',
            'center_comments',
            'center_ratings',
            'gear_rental_costs',
            'site_comments',
            'site_ratings',
            'dive_site_tags',
            'user_certifications',   # References diving_organizations
            'diving_center_organizations',
            'center_dive_sites',
            'site_media',
            'dive_site_aliases',
            'diving_centers',
            'dive_sites',
        ]
        
        # Optional tables that can be preserved
        if not self.preserve_tags:
            tables_to_clear.append('available_tags')
        else:
            logger.info("Preserving available_tags table")
            
        if not self.preserve_organizations:
            tables_to_clear.append('diving_organizations')
        else:
            logger.info("Preserving diving_organizations table")
        
        if self.dry_run:
            logger.info(f"[DRY-RUN] Would clear data from {len(tables_to_clear)} tables:")
            for table in tables_to_clear:
                logger.info(f"[DRY-RUN]   - {table}")
            return True
        
        # Build SQL commands to clear tables
        clear_commands = []
        for table in tables_to_clear:
            clear_commands.append(f"DELETE FROM {table};")
            clear_commands.append(f"ALTER TABLE {table} AUTO_INCREMENT = 1;")
        
        # Write SQL commands to temporary file
        temp_sql_file = self.backup_dir / "clear_tables_temp.sql"
        with open(temp_sql_file, 'w') as f:
            f.write('\n'.join(clear_commands))
        
        # Execute the clear commands
        try:
            with open(temp_sql_file, 'r') as f:
                sql_content = f.read()
            
            command = [
                'mysql',
                f'--host={db_config["host"]}',
                f'--port={db_config["port"]}',
                f'--user={db_config["user"]}',
                f'--password={db_config["password"]}',
                db_config['database']
            ]
            
            result = subprocess.run(
                command,
                input=sql_content,
                text=True,
                capture_output=True,
                check=True
            )
            
            logger.info("✓ Clearing existing diving data completed successfully")
            success = True
        except subprocess.CalledProcessError as e:
            logger.error("✗ Clearing existing diving data failed")
            logger.error(f"Error: {e.stderr}")
            success = False
        except Exception as e:
            logger.error(f"✗ Clearing existing diving data failed: {e}")
            success = False
        
        # Clean up temporary file
        temp_sql_file.unlink(missing_ok=True)
        
        return success

    def verify_export(self, export_file: str) -> bool:
        """Verify that the export file contains the expected tables."""
        logger.info(f"Verifying export file: {export_file}")
        
        # Use the new validation method
        return self._validate_export_file(Path(export_file), "export_verification")

    def get_latest_export_file(self, prefix: str) -> str:
        """Get the most recent export file with the given prefix."""
        pattern = f"{prefix}_*.sql"
        files = list(self.backup_dir.glob(pattern))
        
        if not files:
            raise FileNotFoundError(f"No export files found with pattern: {pattern}")
        
        # Sort by modification time and return the latest
        latest_file = max(files, key=lambda f: f.stat().st_mtime)
        return str(latest_file)

    def run_export_import(self) -> bool:
        """Main function to run the export/import process."""
        if self.dry_run:
            logger.info("=== DRY RUN MODE ===")
            logger.info("No actual changes will be made to the databases")
            logger.info("=" * 50)
        
        logger.info("Starting diving centers and dive sites export/import process")
        
        try:
            # Step 1: Create full backups
            logger.info("Step 1: Creating full database backups")
            
            if not self.create_full_backup(self.local_db_config, "local_full_backup"):
                logger.error("Failed to create local database backup")
                return False
            
            if not self.create_full_backup(self.fly_db_config, "fly_full_backup"):
                logger.error("Failed to create fly.io database backup")
                return False
            
            # Step 2: Export selected tables from local database
            logger.info("Step 2: Exporting selected tables from local database")
            
            if not self.export_selected_tables(self.local_db_config, "local_diving_export"):
                logger.error("Failed to export tables from local database")
                return False
            
            # Step 3: Verify the export (skip in dry-run mode)
            if not self.dry_run:
                export_file = self.get_latest_export_file("local_diving_export")
                if not self.verify_export(export_file):
                    logger.error("Export verification failed")
                    return False
            else:
                logger.info("[DRY-RUN] Would verify export file")
            
            # Step 4: Clear existing data from fly.io database
            logger.info("Step 4: Clearing existing diving data from fly.io database")
            
            if not self.clear_existing_data(self.fly_db_config):
                logger.error("Failed to clear existing data from fly.io database")
                return False
            
            # Step 5: Import data to fly.io database
            logger.info("Step 5: Importing data to fly.io database")
            
            if not self.dry_run:
                export_file = self.get_latest_export_file("local_diving_export")
                if not self.import_tables(self.fly_db_config, export_file):
                    logger.error("Failed to import data to fly.io database")
                    return False
            else:
                if not self.import_tables(self.fly_db_config, "local_diving_export_DRY_RUN.sql"):
                    logger.error("Failed to simulate import")
                    return False
            
            if self.dry_run:
                logger.info("=== DRY RUN COMPLETED ===")
                logger.info("All operations would have been successful")
                logger.info("Run without --dry-run to perform actual operations")
            else:
                logger.info("✓ Export/import process completed successfully!")
                logger.info(f"Export file: {export_file}")
                logger.info(f"Backup directory: {self.backup_dir}")
            
            return True
            
        except Exception as e:
            logger.error(f"Unexpected error during export/import process: {e}")
            return False

def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Database Export/Import Script for Diving Centers and Dive Sites",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --dry-run                    # Test the process without making changes
  %(prog)s                              # Run the actual export/import process
  %(prog)s --preserve-tags              # Preserve existing tags
  %(prog)s --preserve-organizations     # Preserve existing organizations
  %(prog)s --preserve-tags --preserve-organizations  # Preserve both

Table Clearing Strategy:
  NECESSARY (always cleared): 14 tables including dive_sites, diving_centers, and their relationships
  OPTIONAL (can be preserved): available_tags, diving_organizations
        """
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Run in dry-run mode (no actual changes will be made)'
    )
    parser.add_argument(
        '--preserve-tags',
        action='store_true',
        help='Preserve existing available_tags (don\'t clear and reimport)'
    )
    parser.add_argument(
        '--preserve-organizations',
        action='store_true',
        help='Preserve existing diving_organizations (don\'t clear and reimport)'
    )
    
    args = parser.parse_args()
    
    print("=" * 80)
    print("Database Export/Import Script for Diving Centers and Dive Sites")
    print("=" * 80)
    print()
    
    if args.dry_run:
        print("🔍 DRY-RUN MODE: No actual changes will be made to the databases")
        print()
        print("This script would:")
        print("1. Create full backups of both local and fly.io databases")
        print("2. Export diving centers, dive sites, and related tables from local database")
        print("3. Clear existing diving data from fly.io database")
        print("4. Import the exported data to fly.io database")
        print()
    else:
        print("This script will:")
        print("1. Create full backups of both local and fly.io databases")
        print("2. Export diving centers, dive sites, and related tables from local database")
        print("3. Clear existing diving data from fly.io database")
        print("4. Import the exported data to fly.io database")
        print()
        print("⚠️  WARNING: This will overwrite existing diving centers and dive sites")
        print("   in the fly.io database!")
        print()
        
        response = input("Do you want to continue? (yes/no): ").lower().strip()
        if response not in ['yes', 'y']:
            print("Operation cancelled.")
            return
    
    print()
    exporter = DatabaseExporter(
        dry_run=args.dry_run,
        preserve_tags=args.preserve_tags,
        preserve_organizations=args.preserve_organizations
    )
    
    if exporter.run_export_import():
        if args.dry_run:
            print()
            print("✓ Dry-run completed successfully!")
            print("All operations would have been successful.")
            print("Run without --dry-run to perform actual operations.")
        else:
            print()
            print("✓ Export/import process completed successfully!")
            print(f"Check the log file: export_import_diving_data.log")
            print(f"Backup files are stored in: {exporter.backup_dir}")
    else:
        print()
        print("✗ Export/import process failed!")
        print("Check the log file for details: export_import_diving_data.log")
        sys.exit(1)

if __name__ == "__main__":
    main()
