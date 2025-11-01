import pytest
from fastapi import status
from app.models import Setting
import json


class TestSettings:
    """Test settings API endpoints."""

    def test_get_setting_success(self, client, db_session):
        """Test getting a setting value by key."""
        # Ensure setting exists (may already exist from migration)
        setting = db_session.query(Setting).filter(Setting.key == "disable_diving_center_reviews").first()
        if not setting:
            setting = Setting(
                key="disable_diving_center_reviews",
                value=json.dumps(False),
                description="Disable comments and ratings for diving centers"
            )
            db_session.add(setting)
            db_session.commit()

        response = client.get("/api/v1/settings/disable_diving_center_reviews")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["key"] == "disable_diving_center_reviews"
        assert data["value"] is False
        assert "description" in data

    def test_get_setting_not_found(self, client):
        """Test getting a non-existent setting."""
        response = client.get("/api/v1/settings/nonexistent_setting")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_list_settings_admin_success(self, client, admin_headers, db_session):
        """Test listing all settings as admin."""
        # Ensure main setting exists (may already exist from migration)
        setting1 = db_session.query(Setting).filter(Setting.key == "disable_diving_center_reviews").first()
        if not setting1:
            setting1 = Setting(
                key="disable_diving_center_reviews",
                value=json.dumps(False),
                description="Disable comments and ratings for diving centers"
            )
            db_session.add(setting1)
        # Create additional test setting
        setting2 = Setting(
            key="test_setting",
            value=json.dumps("test_value"),
            description="A test setting"
        )
        db_session.add(setting2)
        db_session.commit()

        response = client.get("/api/v1/settings", headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2
        # Check that our settings are in the list
        keys = [s["key"] for s in data]
        assert "disable_diving_center_reviews" in keys
        assert "test_setting" in keys

    def test_list_settings_non_admin_forbidden(self, client, auth_headers):
        """Test that non-admin users cannot list all settings."""
        response = client.get("/api/v1/settings", headers=auth_headers)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_setting_admin_success(self, client, admin_headers, db_session):
        """Test updating a setting value as admin."""
        # Ensure setting exists (may already exist from migration)
        setting = db_session.query(Setting).filter(Setting.key == "disable_diving_center_reviews").first()
        if not setting:
            setting = Setting(
                key="disable_diving_center_reviews",
                value=json.dumps(False),
                description="Disable comments and ratings for diving centers"
            )
            db_session.add(setting)
            db_session.commit()

        # Update the setting
        response = client.put(
            "/api/v1/settings/disable_diving_center_reviews",
            headers=admin_headers,
            json={"value": True}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["key"] == "disable_diving_center_reviews"
        assert data["value"] is True

        # Verify the setting was updated in the database
        db_session.refresh(setting)
        assert json.loads(setting.value) is True

    def test_update_setting_non_admin_forbidden(self, client, auth_headers, db_session):
        """Test that non-admin users cannot update settings."""
        # Ensure setting exists (may already exist from migration)
        setting = db_session.query(Setting).filter(Setting.key == "disable_diving_center_reviews").first()
        if not setting:
            setting = Setting(
                key="disable_diving_center_reviews",
                value=json.dumps(False),
                description="Disable comments and ratings for diving centers"
            )
            db_session.add(setting)
            db_session.commit()

        response = client.put(
            "/api/v1/settings/disable_diving_center_reviews",
            headers=auth_headers,
            json={"value": True}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_setting_not_found(self, client, admin_headers):
        """Test updating a non-existent setting."""
        response = client.put(
            "/api/v1/settings/nonexistent_setting",
            headers=admin_headers,
            json={"value": True}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_setting_public_access(self, client, db_session):
        """Test that getting a setting works without authentication."""
        # Ensure setting exists (may already exist from migration)
        setting = db_session.query(Setting).filter(Setting.key == "disable_diving_center_reviews").first()
        if not setting:
            setting = Setting(
                key="disable_diving_center_reviews",
                value=json.dumps(False),
                description="Disable comments and ratings for diving centers"
            )
            db_session.add(setting)
            db_session.commit()

        # No authentication headers
        response = client.get("/api/v1/settings/disable_diving_center_reviews")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["key"] == "disable_diving_center_reviews"
        assert data["value"] is False

    def test_setting_value_types(self, client, admin_headers, db_session):
        """Test that settings can store different value types (boolean, string, number)."""
        # Test boolean
        setting_bool = Setting(
            key="test_bool",
            value=json.dumps(True),
            description="Boolean setting"
        )
        db_session.add(setting_bool)
        db_session.commit()

        response = client.get("/api/v1/settings/test_bool")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["value"] is True

        # Test string
        setting_str = Setting(
            key="test_string",
            value=json.dumps("test_value"),
            description="String setting"
        )
        db_session.add(setting_str)
        db_session.commit()

        response = client.get("/api/v1/settings/test_string")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["value"] == "test_value"

        # Test number
        setting_num = Setting(
            key="test_number",
            value=json.dumps(42),
            description="Number setting"
        )
        db_session.add(setting_num)
        db_session.commit()

        response = client.get("/api/v1/settings/test_number")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["value"] == 42

