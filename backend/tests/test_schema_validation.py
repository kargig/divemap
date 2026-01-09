import pytest
from sqlalchemy import text
from app.database import SessionLocal

def test_no_timestamp_columns():
    """
    Ensure no columns in the database are using the TIMESTAMP data type.
    All date/time columns should be using DATETIME (or DateTime in SQLAlchemy)
    to avoid the Year 2038 problem.
    """
    db = SessionLocal()
    try:
        # Query information_schema to find any columns using TIMESTAMP
        # Exclude internal MySQL tables
        query = text("""
            SELECT TABLE_NAME, COLUMN_NAME 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND DATA_TYPE = 'timestamp'
            AND TABLE_NAME != 'alembic_version' 
        """)
        
        result = db.execute(query).fetchall()
        
        # If result is not empty, we have forbidden TIMESTAMP columns
        if result:
            violations = [f"{row[0]}.{row[1]}" for row in result]
            pytest.fail(f"Found forbidden TIMESTAMP columns (should be DATETIME): {', '.join(violations)}")
            
    finally:
        db.close()
