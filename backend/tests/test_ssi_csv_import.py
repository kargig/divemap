import pytest
import io
import orjson
from fastapi import UploadFile
from app.routers.dives.imports.ssi_csv import process_csv_import
from app.models import DivingCenter

class TestSSICSVImport:
    """End-to-end verification of SSI CSV import."""

    @pytest.mark.asyncio
    async def test_process_ssi_csv_parsing(self, db_session, test_user, client):
        # Sample CSV content from the user's provided divessi.csv
        csv_content = (
            '"dive #","Dive Site","Country","Date / Time","Dive Activity","Specialty Dive","Dive type","Duration","Depth","Dive Buddy / Instructor / Center"\n'
            '"301","SS Thistlegorm (Wreck)","Egypt","06. Dec 2025 20:27","Scuba","","Fun Dive","51 min","25.5 m (84 ft)",""\n'
            '"300","SS Carnatic, wreck","Egypt","06. Dec 2025 08:15","Scuba","","Fun Dive","58 min","25.5 m (84 ft)","AQUALIZED DIVE ADVENTURES IKE"\n'
        )
        
        file = UploadFile(
            filename="divessi.csv",
            file=io.BytesIO(csv_content.encode('utf-8'))
        )
        
        # Mapping defined during brainstorming
        mapping = {
            "dive #": "ignore",
            "Dive Site": "dive_site_name",
            "Country": "ignore",
            "Date / Time": "dive_date",
            "Dive Activity": "auto_tag",
            "Specialty Dive": "auto_tag",
            "Dive type": "notes",
            "Duration": "duration",
            "Depth": "max_depth",
            "Dive Buddy / Instructor / Center": "mixed_entity"
        }
        
        # Create a matching Diving Center to test fuzzy entity resolution
        # DB has a shorter name, CSV has the full legal name
        center = DivingCenter(name="Aqualized", country="Egypt")
        db_session.add(center)
        db_session.commit()
        
        # We call the function directly (it's a route but we can test logic)
        # Note: We need to mock current_user as it's a dependency
        result = await process_csv_import(
            file=file,
            mapping=orjson.dumps(mapping).decode('utf-8'),
            db=db_session,
            current_user=test_user
        )
        
        dives = result["dives"]
        assert len(dives) == 2
        
        # Check first dive
        dive1 = dives[0]
        assert dive1["max_depth"] == 25.5
        assert dive1["dive_date"] == "2025-12-06"
        assert dive1["dive_time"] == "20:27:00"
        assert dive1["duration"] == 51
        
        # Check second dive entity resolution
        dive2 = dives[1]
        assert dive2["diving_center_id"] == center.id
        assert dive2["dive_information"] is not None
        assert "Fun Dive" in dive2["dive_information"]
