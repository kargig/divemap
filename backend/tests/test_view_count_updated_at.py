import pytest
import time
from fastapi import status
from datetime import date
from app.models import Dive, DiveRoute, DivingOrganization, ParsedDiveTrip, TripStatus, RouteType

class TestViewCountUpdatedAt:
    """
    Regression tests to ensure that viewing entities increments their view_count
    but does NOT modify the updated_at timestamp.
    """

    def test_view_dive_site_preserves_updated_at(self, client, test_dive_site, db_session):
        db_session.refresh(test_dive_site)
        initial_view_count = test_dive_site.view_count
        initial_updated_at = test_dive_site.updated_at
        
        assert initial_updated_at is not None
        time.sleep(1.1)
        
        response = client.get(f"/api/v1/dive-sites/{test_dive_site.id}")
        assert response.status_code == status.HTTP_200_OK
        
        db_session.refresh(test_dive_site)
        assert test_dive_site.view_count == initial_view_count + 1
        assert test_dive_site.updated_at == initial_updated_at

    def test_view_diving_center_preserves_updated_at(self, client, test_diving_center, db_session):
        db_session.refresh(test_diving_center)
        initial_view_count = test_diving_center.view_count
        initial_updated_at = test_diving_center.updated_at
        
        assert initial_updated_at is not None
        time.sleep(1.1)
        
        response = client.get(f"/api/v1/diving-centers/{test_diving_center.id}")
        assert response.status_code == status.HTTP_200_OK
        
        db_session.refresh(test_diving_center)
        assert test_diving_center.view_count == initial_view_count + 1
        assert test_diving_center.updated_at == initial_updated_at

    def test_view_public_dive_preserves_updated_at(self, client, auth_headers, test_user, test_dive_site, db_session):
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            name="Public Test Dive",
            dive_date=date(2025, 1, 1),
            duration=30,
            is_private=False,
            view_count=0
        )
        db_session.add(dive)
        db_session.commit()
        db_session.refresh(dive)
        
        initial_view_count = dive.view_count
        initial_updated_at = dive.updated_at
        time.sleep(1.1)
        
        response = client.get(f"/api/v1/dives/{dive.id}", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        
        db_session.refresh(dive)
        assert dive.view_count == initial_view_count + 1
        assert dive.updated_at == initial_updated_at

    def test_view_dive_route_preserves_updated_at(self, client, test_user, test_dive_site, db_session):
        route = DiveRoute(
            dive_site_id=test_dive_site.id,
            created_by=test_user.id,
            name="Test Route",
            description="Test Description",
            route_data={
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [[0, 0], [1, 1]]
                        },
                        "properties": {}
                    }
                ]
            },
            route_type=RouteType.scuba,
            view_count=0
        )
        db_session.add(route)
        db_session.commit()
        db_session.refresh(route)
        
        initial_view_count = route.view_count
        initial_updated_at = route.updated_at
        time.sleep(1.1)
        
        response = client.get(f"/api/v1/dive-routes/{route.id}")
        assert response.status_code == status.HTTP_200_OK
        
        db_session.refresh(route)
        assert route.view_count == initial_view_count + 1
        assert route.updated_at == initial_updated_at

    def test_view_diving_organization_preserves_updated_at(self, client, test_diving_organization, db_session):
        db_session.refresh(test_diving_organization)
        initial_view_count = test_diving_organization.view_count
        initial_updated_at = test_diving_organization.updated_at
        time.sleep(1.1)
        
        response = client.get(f"/api/v1/diving-organizations/{test_diving_organization.id}")
        assert response.status_code == status.HTTP_200_OK
        
        db_session.refresh(test_diving_organization)
        assert test_diving_organization.view_count == initial_view_count + 1
        assert test_diving_organization.updated_at == initial_updated_at

    def test_view_parsed_trip_preserves_updated_at(self, client, auth_headers, test_diving_center, db_session):
        trip = ParsedDiveTrip(
            diving_center_id=test_diving_center.id,
            trip_date=date(2025, 1, 1),
            trip_status=TripStatus.scheduled,
            view_count=0
        )
        db_session.add(trip)
        db_session.commit()
        db_session.refresh(trip)
        
        initial_view_count = trip.view_count
        initial_updated_at = trip.updated_at
        time.sleep(1.1)
        
        response = client.get(f"/api/v1/newsletters/trips/{trip.id}", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        
        db_session.refresh(trip)
        assert trip.view_count == initial_view_count + 1
        assert trip.updated_at == initial_updated_at
