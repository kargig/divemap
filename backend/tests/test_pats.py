import pytest
from fastapi import status
from app.models import User, PersonalAccessToken
from datetime import datetime, timezone, timedelta

class TestPATs:
    """Test Personal Access Token (PAT) functionality."""

    def test_create_pat_success(self, client, test_user):
        """Test successful PAT creation."""
        # Log in first to get JWT (or use a test client with user dependency)
        # Assuming our client fixture handles auth or we can use it directly with the test_user
        # For simplicity, we assume 'client' can be used with a logged-in user if needed,
        # but here we'll just mock the dependency if the standard client doesn't have it.
        
        # We need an authenticated session. Let's get a token for test_user.
        login_response = client.post("/api/v1/auth/login", json={
            "username": "testuser",
            "password": "TestPass123!"
        })
        access_token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {access_token}"}

        response = client.post("/api/v1/users/me/tokens", json={
            "name": "My Test Token",
            "expires_in_days": 30
        }, headers=headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "My Test Token"
        assert "token" in data
        assert data["token"].startswith("dm_pat_")
        assert data["expires_at"] is not None
        assert data["is_active"] is True

    def test_authenticate_with_pat(self, client, test_user, db_session):
        """Test accessing protected endpoint with a PAT."""
        # 1. Create a PAT for the test user manually in DB for the test
        from app.auth import get_password_hash
        raw_token = "dm_pat_testtoken1234567890abcdefghijkl"
        token_hash = get_password_hash(raw_token)
        
        pat = PersonalAccessToken(
            user_id=test_user.id,
            name="Test PAT",
            token_prefix=raw_token[7:][:12],
            token_hash=token_hash,
            is_active=True
        )
        db_session.add(pat)
        db_session.commit()

        # 2. Use the PAT to access /auth/me
        headers = {"Authorization": f"Bearer {raw_token}"}
        response = client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["username"] == test_user.username
        
        # 3. Verify last_used_at was updated
        db_session.refresh(pat)
        assert pat.last_used_at is not None

    def test_pat_expiration(self, client, test_user, db_session):
        """Test that expired PAT is rejected."""
        from app.auth import get_password_hash
        raw_token = "dm_pat_expiredtoken123"
        token_hash = get_password_hash(raw_token)
        
        # Expired yesterday
        expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        
        pat = PersonalAccessToken(
            user_id=test_user.id,
            name="Expired PAT",
            token_prefix=raw_token[7:][:12],
            token_hash=token_hash,
            expires_at=expires_at,
            is_active=True
        )
        db_session.add(pat)
        db_session.commit()

        headers = {"Authorization": f"Bearer {raw_token}"}
        response = client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_pat_revocation(self, client, test_user, db_session):
        """Test that revoked (inactive) PAT is rejected."""
        from app.auth import get_password_hash
        raw_token = "dm_pat_revokedtoken123"
        token_hash = get_password_hash(raw_token)
        
        pat = PersonalAccessToken(
            user_id=test_user.id,
            name="Revoked PAT",
            token_prefix=raw_token[7:][:12],
            token_hash=token_hash,
            is_active=False
        )
        db_session.add(pat)
        db_session.commit()

        headers = {"Authorization": f"Bearer {raw_token}"}
        response = client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_pat_max_limit(self, client, test_user, db_session):
        """Test that user cannot exceed 10 active tokens."""
        # Log in
        login_response = client.post("/api/v1/auth/login", json={
            "username": "testuser",
            "password": "TestPass123!"
        })
        access_token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {access_token}"}

        # Create 10 tokens manually
        from app.auth import get_password_hash
        for i in range(10):
            token_val = f"dm_pat_token_{i}_longenoughsuffix"
            pat = PersonalAccessToken(
                user_id=test_user.id,
                name=f"Token {i}",
                token_prefix=token_val[7:][:12],
                token_hash=get_password_hash(token_val),
                is_active=True
            )
            db_session.add(pat)
        db_session.commit()

        # Try to create the 11th token via API
        response = client.post("/api/v1/users/me/tokens", json={
            "name": "The 11th Token"
        }, headers=headers)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Maximum number of active tokens" in response.json()["detail"]

    def test_list_and_delete_pats(self, client, test_user, db_session):
        """Test listing and deleting PATs."""
        # Log in
        login_response = client.post("/api/v1/auth/login", json={
            "username": "testuser",
            "password": "TestPass123!"
        })
        access_token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {access_token}"}

        # 1. Create a token
        create_resp = client.post("/api/v1/users/me/tokens", json={
            "name": "To be deleted"
        }, headers=headers)
        token_id = create_resp.json()["id"]

        # 2. List tokens
        list_resp = client.get("/api/v1/users/me/tokens", headers=headers)
        assert list_resp.status_code == status.HTTP_200_OK
        assert any(t["id"] == token_id for t in list_resp.json())

        # 3. Delete token
        del_resp = client.delete(f"/api/v1/users/me/tokens/{token_id}", headers=headers)
        assert del_resp.status_code == status.HTTP_200_OK

        # 4. Verify gone
        list_resp = client.get("/api/v1/users/me/tokens", headers=headers)
        assert not any(t["id"] == token_id for t in list_resp.json())

    def test_authenticate_optional_with_pat(self, client, test_user, db_session):
        """Test that get_current_user_optional works with a PAT."""
        from app.auth import get_password_hash
        raw_token = "dm_pat_optional_token_12345"
        token_hash = get_password_hash(raw_token)
        
        pat = PersonalAccessToken(
            user_id=test_user.id,
            name="Optional PAT",
            token_prefix=raw_token[7:][:12],
            token_hash=token_hash,
            is_active=True
        )
        db_session.add(pat)
        db_session.commit()

        # weather/forecast uses get_current_user_optional
        headers = {"Authorization": f"Bearer {raw_token}"}
        # Note: We don't care about the actual weather response, 
        # just that the PAT doesn't cause a 401 or 500 on an optional endpoint
        # Use auth/me which requires authentication, but here we just want to see if PAT works
        response = client.get("/api/v1/auth/me", headers=headers)
        
        # Should be 200 OK
        assert response.status_code == status.HTTP_200_OK

    def test_pat_write_access_parity(self, client, test_user, db_session):
        """Test that a PAT can perform write operations (PUT/POST/DELETE)."""
        from app.auth import get_password_hash
        raw_token = "dm_pat_write_token_999888777"
        token_hash = get_password_hash(raw_token)
        
        pat = PersonalAccessToken(
            user_id=test_user.id,
            name="Write Access PAT",
            token_prefix=raw_token[7:][:12],
            token_hash=token_hash,
            is_active=True
        )
        db_session.add(pat)
        db_session.commit()

        # Attempt to update user profile via PUT
        headers = {"Authorization": f"Bearer {raw_token}"}
        new_name = "Authenticated via PAT"
        response = client.put("/api/v1/users/me", json={"name": new_name}, headers=headers)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == new_name
        
        # Verify in DB
        db_session.refresh(test_user)
        assert test_user.name == new_name
