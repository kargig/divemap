import pytest
import io
import orjson
from unittest.mock import MagicMock, patch
from fastapi import UploadFile
from app.routers.dives.imports.ssi_csv import process_csv_import

@pytest.mark.asyncio
async def test_csv_import_site_caching_scalability(db_session, test_user):
    """
    Verify that fuzzy matching is only performed once per unique site name,
    ensuring scalability for large imports.
    """
    # 3 dives, all at the same site "Blue Hole"
    csv_content = (
        '"Dive Site","Date / Time"\n'
        '"Blue Hole","2023-01-01 10:00"\n'
        '"Blue Hole","2023-01-02 10:00"\n'
        '"Blue Hole","2023-01-03 10:00"\n'
    )
    
    file = UploadFile(
        filename="test.csv",
        file=io.BytesIO(csv_content.encode('utf-8'))
    )
    
    mapping = {
        "Dive Site": "dive_site_name",
        "Date / Time": "dive_date"
    }
    
    # We mock find_dive_site_by_import_id and track how many times it's called
    with patch('app.routers.dives.imports.ssi_csv.find_dive_site_by_import_id') as mock_match:
        mock_match.return_value = {"id": 1, "name": "Blue Hole"}
        
        await process_csv_import(
            file=file,
            mapping=orjson.dumps(mapping).decode('utf-8'),
            db=db_session,
            current_user=test_user
        )
        
        # CRITICAL ASSERTION: Should be 1, NOT 3.
        # This proves the "Unique Name Fuzzy Cache" is working.
        assert mock_match.call_count == 1
