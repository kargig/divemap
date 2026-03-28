import pytest
from fastapi import status
from app.models import User, UserFriendship

@pytest.fixture
def other_user(db_session):
    user = User(
        username="otheruser",
        email="other@example.com",
        password_hash="hashed_password",
        enabled=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

class TestUserFriendships:
    """Test user friendships endpoints."""

    def test_list_friendships_empty(self, client, auth_headers):
        """Test listing friendships when none exist."""
        response = client.get("/api/v1/user-friendships", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []

    def test_send_friend_request_success(self, client, auth_headers, other_user):
        """Test sending a friend request successfully."""
        response = client.post(
            "/api/v1/user-friendships/requests",
            json={"friend_id": other_user.id},
            headers=auth_headers
          )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["status"] == "PENDING"
        assert data["initiator_id"] is not None

    def test_send_friend_request_to_self_fails(self, client, auth_headers, test_user):
        """Test that sending a friend request to oneself fails."""
        response = client.post(
            "/api/v1/user-friendships/requests",
            json={"friend_id": test_user.id},
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_accept_friend_request_success(self, client, db_session, test_user, other_user):
        """Test accepting a friend request."""
        # Create a pending request from other_user to test_user
        uid1, uid2 = min(test_user.id, other_user.id), max(test_user.id, other_user.id)
        friendship = UserFriendship(
            user_id=uid1,
            friend_id=uid2,
            status="PENDING",
            initiator_id=other_user.id
        )
        db_session.add(friendship)
        db_session.commit()
        db_session.refresh(friendship)

        # test_user accepts the request
        from app.auth import create_access_token
        test_user_token = create_access_token(data={"sub": test_user.username})
        test_user_headers = {"Authorization": f"Bearer {test_user_token}"}

        response = client.put(
            f"/api/v1/user-friendships/requests/{friendship.id}/accept",
            headers=test_user_headers
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "ACCEPTED"

    def test_reject_friend_request(self, client, db_session, test_user, other_user):
        """Test rejecting a friend request."""
        uid1, uid2 = min(test_user.id, other_user.id), max(test_user.id, other_user.id)
        friendship = UserFriendship(
            user_id=uid1,
            friend_id=uid2,
            status="PENDING",
            initiator_id=other_user.id
        )
        db_session.add(friendship)
        db_session.commit()

        from app.auth import create_access_token
        test_user_token = create_access_token(data={"sub": test_user.username})
        test_user_headers = {"Authorization": f"Bearer {test_user_token}"}

        response = client.put(
            f"/api/v1/user-friendships/requests/{friendship.id}/reject",
            headers=test_user_headers
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "REJECTED"

    def test_remove_friendship(self, client, db_session, test_user, other_user):
        """Test removing a friendship."""
        uid1, uid2 = min(test_user.id, other_user.id), max(test_user.id, other_user.id)
        friendship = UserFriendship(
            user_id=uid1,
            friend_id=uid2,
            status="ACCEPTED",
            initiator_id=other_user.id
        )
        db_session.add(friendship)
        db_session.commit()

        from app.auth import create_access_token
        test_user_token = create_access_token(data={"sub": test_user.username})
        test_user_headers = {"Authorization": f"Bearer {test_user_token}"}

        response = client.delete(
            f"/api/v1/user-friendships/{friendship.id}",
            headers=test_user_headers
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT
        
        # Verify it's gone
        assert db_session.query(UserFriendship).filter(UserFriendship.id == friendship.id).first() is None
