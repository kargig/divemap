# Utils Directory

This directory contains utility scripts for the Divemap project.

## 📁 Available Scripts

### **Database Utilities**
- **[export_database_data.py](./export_database_data.py)** - Export current database data for inclusion in init.sql
  - Generates INSERT statements for all current data
  - Useful for creating database snapshots
  - Handles all tables: users, dive_sites, diving_centers, tags, etc.
  - Properly escapes SQL strings and handles NULL values

## 🚀 Usage

### Database Export
```bash
# Export current database data to SQL statements
cd utils
python export_database_data.py > ../local_data_export.sql
```

### Environment Setup
```bash
# Set database connection (if not using default)
export DATABASE_URL="mysql+pymysql://user:password@host:port/database"
```

## 📋 Script Details

### export_database_data.py
- **Purpose**: Export all current database data as SQL INSERT statements
- **Output**: SQL statements that can be included in init.sql
- **Tables Exported**:
  - users
  - dive_sites
  - diving_centers
  - available_tags
  - dive_site_tags
  - site_media
  - site_ratings
  - site_comments
  - center_ratings
  - center_comments
  - center_dive_sites
  - gear_rental_costs
  - parsed_dive_trips
  - newsletters

### Features
- **SQL String Escaping**: Properly escapes quotes and special characters
- **NULL Handling**: Correctly handles NULL values in database
- **Comprehensive Export**: Exports all tables with all fields
- **Error Handling**: Graceful error handling and session management

## 🔧 Requirements

- Python 3.11+
- SQLAlchemy
- PyMySQL
- Access to the Divemap database

## 📝 Notes

- These scripts are for development and maintenance purposes
- Always backup your database before running export scripts
- Generated SQL files can be used to recreate database state
- Scripts are designed to work with the current database schema 