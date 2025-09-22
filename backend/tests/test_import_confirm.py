import pytest
from fastapi import status


class TestImportConfirm:
    def test_confirm_import_generates_name_without_strptime_error(self, client, auth_headers, db_session):
        # Create a dive site to trigger name generation path
        from app.models import DiveSite
        site = DiveSite(name="Attiki - Psatha")
        db_session.add(site)
        db_session.commit()

        dives = [{
            "dive_site_id": site.id,
            # name omitted on purpose to trigger generate_dive_name branch
            "is_private": False,
            "dive_date": "2025-09-21",
            # omit time to keep minimal
            "duration": 80
        }]

        resp = client.post("/api/v1/dives/import/confirm", json=dives, headers=auth_headers)
        # Should not fail due to strptime() with a date object
        if resp.status_code == status.HTTP_400_BAD_REQUEST:
            assert "strptime() argument 1 must be str, not datetime.date" not in resp.json()["detail"]
        else:
            assert resp.status_code == status.HTTP_200_OK
            data = resp.json()
            assert data["message"].startswith("Successfully imported")
            assert len(data["imported_dives"]) == 1

    def test_confirm_import_handles_dive_time_string(self, client, auth_headers):
        dives = [{
            "dive_site_id": None,
            "name": None,
            "is_private": False,
            "dive_date": "2025-09-21",
            "dive_time": "13:14:15",
            "duration": 80
        }]

        resp = client.post("/api/v1/dives/import/confirm", json=dives, headers=auth_headers)
        # Accept either success or other validation errors, but not type error from strptime
        if resp.status_code == status.HTTP_400_BAD_REQUEST:
            assert "strptime() argument 1 must be str, not datetime.date" not in resp.json()["detail"]
        else:
            assert resp.status_code == status.HTTP_200_OK

