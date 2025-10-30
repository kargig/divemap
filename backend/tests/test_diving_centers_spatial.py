import pytest
from fastapi import status
from sqlalchemy import text


@pytest.mark.spatial
class TestDivingCentersSpatial:
    """MySQL-only tests for spatial endpoints. Run via docker-test-github-actions.sh"""

    def _set_location_for_center(self, db_session, center_id, lng, lat):
        # Ensure POINT(location) is populated for tests (model doesn't include POINT field)
        db_session.execute(
            text(
                """
                UPDATE diving_centers
                SET location = ST_SRID(POINT(:lng, :lat), 4326)
                WHERE id = :center_id
                """
            ),
            {"lng": float(lng), "lat": float(lat), "center_id": center_id},
        )
        db_session.commit()

    def test_nearby_returns_sorted_within_radius_spatial(self, client, db_session):
        from app.models import DivingCenter

        # Reference point (approx Skourdouliari, Ikaria)
        lat0, lng0 = 37.57722, 26.23544

        # Create three centers at increasing distances (rough coordinates)
        centers = [
            ("Center A", 37.60, 26.24),    # ~3 km
            ("Center B", 37.65, 26.30),    # ~9 km
            ("Center C", 37.90, 26.50),    # ~41 km
        ]

        created_ids = []
        for name, lat, lng in centers:
            c = DivingCenter(name=name, latitude=lat, longitude=lng)
            db_session.add(c)
            db_session.commit()
            db_session.refresh(c)
            created_ids.append(c.id)
            # Set POINT(location)
            self._set_location_for_center(db_session, c.id, lng, lat)

        # Query nearby within 50 km (should include all three), expect sorted by distance
        resp = client.get(
            f"/api/v1/diving-centers/nearby?lat={lat0}&lng={lng0}&radius_km=50&limit=10"
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()

        # Extract names in order and ensure distances are ascending
        names = [d["name"] for d in data]
        distances = [d["distance_km"] for d in data]
        assert names[:3] == ["Center A", "Center B", "Center C"]
        assert distances == sorted(distances)

        # Query nearby within 5 km (should only include Center A)
        resp2 = client.get(
            f"/api/v1/diving-centers/nearby?lat={lat0}&lng={lng0}&radius_km=5&limit=10"
        )
        assert resp2.status_code == status.HTTP_200_OK
        data2 = resp2.json()
        assert len(data2) >= 1
        assert data2[0]["name"] == "Center A"

    def test_search_global_with_distance_ranking_spatial(self, client, db_session):
        from app.models import DivingCenter

        # Reference point
        lat0, lng0 = 37.57722, 26.23544

        # Create centers with prefix matches at different distances
        near = DivingCenter(name="Dive Near One", latitude=37.59, longitude=26.25)
        far = DivingCenter(name="Dive Far Away", latitude=37.90, longitude=26.50)
        other = DivingCenter(name="Another Shop", latitude=37.58, longitude=26.24)
        db_session.add_all([near, far, other])
        db_session.commit()
        db_session.refresh(near)
        db_session.refresh(far)
        db_session.refresh(other)

        # Set POINT(location)
        self._set_location_for_center(db_session, near.id, near.longitude, near.latitude)
        self._set_location_for_center(db_session, far.id, far.longitude, far.latitude)
        self._set_location_for_center(db_session, other.id, other.longitude, other.latitude)

        # Prefix query 'dive' should list prefix matches, near before far (distance tiebreaker)
        resp = client.get(
            f"/api/v1/diving-centers/search?q=dive&lat={lat0}&lng={lng0}&limit=10"
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()

        # Filter to results with prefix 'dive' (case-insensitive)
        prefix_results = [d for d in data if d["name"].lower().startswith("dive")]
        assert len(prefix_results) >= 2
        # Near should appear before far among prefix matches
        names_order = [d["name"] for d in prefix_results[:2]]
        assert names_order[0] == "Dive Near One"
        assert any("Far" in n or "Far" in d["name"] for n, d in zip(names_order, prefix_results[:2])) or "Dive Far Away" in [d["name"] for d in data]


