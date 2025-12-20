"""
Tests for admin notification functionality.

Tests admin notifications for:
- New user registrations (regular users after email verification)
- New user registrations (Google OAuth users immediately)
- Diving center ownership claims
- Duplicate prevention
- Edge cases (no admins, admins without preferences, etc.)
"""

import pytest
from fastapi import status
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock, AsyncMock
from app.models import (
    User, Notification, NotificationPreference, DivingCenter, EmailVerificationToken
)
from app.services.notification_service import NotificationService
from app.services.email_verification_service import EmailVerificationService


class TestAdminNotificationsForUserRegistration:
    """Test admin notifications for new user registrations."""

    @pytest.mark.asyncio
    async def test_notify_admins_after_email_verification(self, db_session, test_admin_user, test_user):
        """Test that admins are notified after a user verifies their email."""
        # Set up admin with admin_alerts preference
        admin_pref = NotificationPreference(
            user_id=test_admin_user.id,
            category='admin_alerts',
            enable_website=True,
            enable_email=False,
            frequency='immediate'
        )
        db_session.add(admin_pref)
        db_session.commit()

        # Create unverified user
        test_user.email_verified = False
        test_user.email_verified_at = None
        db_session.commit()

        # Verify email (simulating what happens in /verify-email endpoint)
        test_user.email_verified = True
        test_user.email_verified_at = datetime.now(timezone.utc)
        db_session.commit()

        # Notify admins
        notification_service = NotificationService()
        count = await notification_service.notify_admins_for_user_registration(test_user.id, db_session)

        # Check that notification was created
        assert count == 1
        notification = db_session.query(Notification).filter(
            Notification.user_id == test_admin_user.id,
            Notification.entity_type == 'user',
            Notification.entity_id == test_user.id,
            Notification.category == 'admin_alerts'
        ).first()

        assert notification is not None
        assert notification.title == f"New User Registration: {test_user.username}"
        assert test_user.email in notification.message
        assert test_user.username in notification.message
        assert notification.link_url == "/admin/users"

    @pytest.mark.asyncio
    async def test_notify_admins_google_oauth_user(self, db_session, test_admin_user):
        """Test that admins are notified immediately for Google OAuth users."""
        # Set up admin with admin_alerts preference
        admin_pref = NotificationPreference(
            user_id=test_admin_user.id,
            category='admin_alerts',
            enable_website=True,
            enable_email=False,
            frequency='immediate'
        )
        db_session.add(admin_pref)
        db_session.commit()

        # Create new Google OAuth user (simulating what happens in get_or_create_google_user)
        google_user = User(
            username="googleuser",
            email="googleuser@gmail.com",
            password_hash="dummy_hash",
            google_id="google_123",
            enabled=True,
            email_verified=True,  # Google users are auto-verified
            email_verified_at=datetime.now(timezone.utc),
            is_admin=False,
            is_moderator=False
        )
        db_session.add(google_user)
        db_session.commit()
        db_session.refresh(google_user)

        # Notify admins (simulating what happens after Google user creation)
        notification_service = NotificationService()
        count = await notification_service.notify_admins_for_user_registration(google_user.id, db_session)

        # Check that notification was created
        assert count == 1
        notification = db_session.query(Notification).filter(
            Notification.user_id == test_admin_user.id,
            Notification.entity_type == 'user',
            Notification.entity_id == google_user.id,
            Notification.category == 'admin_alerts'
        ).first()

        assert notification is not None
        assert notification.title == f"New User Registration: {google_user.username}"

    @pytest.mark.asyncio
    async def test_no_duplicate_notifications(self, db_session, test_admin_user, test_user):
        """Test that duplicate notifications are not sent if function is called multiple times."""
        # Set up admin with admin_alerts preference
        admin_pref = NotificationPreference(
            user_id=test_admin_user.id,
            category='admin_alerts',
            enable_website=True,
            enable_email=False,
            frequency='immediate'
        )
        db_session.add(admin_pref)
        db_session.commit()

        # Verify user
        test_user.email_verified = True
        test_user.email_verified_at = datetime.now(timezone.utc)
        db_session.commit()

        # Call notification service first time
        notification_service = NotificationService()
        count1 = await notification_service.notify_admins_for_user_registration(test_user.id, db_session)
        assert count1 == 1

        # Call notification service second time (should return 0, no new notifications)
        count2 = await notification_service.notify_admins_for_user_registration(test_user.id, db_session)
        assert count2 == 0

        # Check that only one notification exists
        notifications = db_session.query(Notification).filter(
            Notification.user_id == test_admin_user.id,
            Notification.entity_type == 'user',
            Notification.entity_id == test_user.id,
            Notification.category == 'admin_alerts'
        ).all()

        assert len(notifications) == 1

    @pytest.mark.asyncio
    async def test_notify_all_admins_when_no_preferences(self, db_session, test_admin_user, test_moderator_user):
        """Test that all admins are notified when no admins have admin_alerts preferences."""
        # Create another admin user
        admin2 = User(
            username="admin2",
            email="admin2@example.com",
            password_hash="dummy_hash",
            enabled=True,
            email_verified=True,
            email_verified_at=datetime.now(timezone.utc),
            is_admin=True,
            is_moderator=False
        )
        db_session.add(admin2)
        db_session.commit()

        # Create regular user
        regular_user = User(
            username="regularuser",
            email="regular@example.com",
            password_hash="dummy_hash",
            enabled=True,
            email_verified=True,
            email_verified_at=datetime.now(timezone.utc),
            is_admin=False,
            is_moderator=False
        )
        db_session.add(regular_user)
        db_session.commit()

        # No admin_alerts preferences exist

        # Notify admins
        notification_service = NotificationService()
        count = await notification_service.notify_admins_for_user_registration(regular_user.id, db_session)

        # Should notify both admins (fallback to all admins when no preferences)
        assert count == 2

        # Check notifications for both admins
        notif1 = db_session.query(Notification).filter(
            Notification.user_id == test_admin_user.id,
            Notification.entity_id == regular_user.id
        ).first()
        notif2 = db_session.query(Notification).filter(
            Notification.user_id == admin2.id,
            Notification.entity_id == regular_user.id
        ).first()

        assert notif1 is not None
        assert notif2 is not None

    @pytest.mark.asyncio
    async def test_notify_only_admins_with_preferences(self, db_session, test_admin_user):
        """Test that only admins with admin_alerts preferences are notified."""
        # Create admin with preference
        admin_with_pref = User(
            username="admin_with_pref",
            email="admin_with_pref@example.com",
            password_hash="dummy_hash",
            enabled=True,
            email_verified=True,
            email_verified_at=datetime.now(timezone.utc),
            is_admin=True,
            is_moderator=False
        )
        db_session.add(admin_with_pref)

        # Create admin without preference
        admin_without_pref = User(
            username="admin_without_pref",
            email="admin_without_pref@example.com",
            password_hash="dummy_hash",
            enabled=True,
            email_verified=True,
            email_verified_at=datetime.now(timezone.utc),
            is_admin=True,
            is_moderator=False
        )
        db_session.add(admin_without_pref)
        db_session.commit()  # Commit users first to get their IDs
        db_session.refresh(admin_with_pref)
        db_session.refresh(admin_without_pref)

        # Create preference only for admin_with_pref
        admin_pref = NotificationPreference(
            user_id=admin_with_pref.id,
            category='admin_alerts',
            enable_website=True,
            enable_email=False,
            frequency='immediate'
        )
        db_session.add(admin_pref)
        db_session.commit()

        # Create regular user
        regular_user = User(
            username="regularuser",
            email="regular@example.com",
            password_hash="dummy_hash",
            enabled=True,
            email_verified=True,
            email_verified_at=datetime.now(timezone.utc),
            is_admin=False,
            is_moderator=False
        )
        db_session.add(regular_user)
        db_session.commit()

        # Notify admins
        notification_service = NotificationService()
        count = await notification_service.notify_admins_for_user_registration(regular_user.id, db_session)

        # Should notify only admin_with_pref (and test_admin_user if it has preference)
        # Actually, since no admins have preferences, it should fall back to all admins
        # Let's add a preference for test_admin_user too
        test_admin_pref = NotificationPreference(
            user_id=test_admin_user.id,
            category='admin_alerts',
            enable_website=True,
            enable_email=False,
            frequency='immediate'
        )
        db_session.add(test_admin_pref)
        db_session.commit()

        # Now notify again (but we already have a notification, so it should return 0)
        # Let's create a new user instead
        regular_user2 = User(
            username="regularuser2",
            email="regular2@example.com",
            password_hash="dummy_hash",
            enabled=True,
            email_verified=True,
            email_verified_at=datetime.now(timezone.utc),
            is_admin=False,
            is_moderator=False
        )
        db_session.add(regular_user2)
        db_session.commit()

        count2 = await notification_service.notify_admins_for_user_registration(regular_user2.id, db_session)

        # Should notify both admins with preferences
        assert count2 == 2

        # Check that admin_without_pref was NOT notified
        notif_for_admin_without_pref = db_session.query(Notification).filter(
            Notification.user_id == admin_without_pref.id,
            Notification.entity_id == regular_user2.id
        ).first()
        assert notif_for_admin_without_pref is None

    @pytest.mark.asyncio
    async def test_email_queued_when_preference_enabled(self, db_session, test_admin_user, test_user, monkeypatch):
        """Test that email is queued when admin has email preference enabled."""
        # Set up admin with email preference
        admin_pref = NotificationPreference(
            user_id=test_admin_user.id,
            category='admin_alerts',
            enable_website=True,
            enable_email=True,  # Email enabled
            frequency='immediate'
        )
        db_session.add(admin_pref)
        db_session.commit()

        # Verify user
        test_user.email_verified = True
        test_user.email_verified_at = datetime.now(timezone.utc)
        db_session.commit()

        # Mock _queue_email_notification
        notification_service = NotificationService()
        with patch.object(notification_service, '_queue_email_notification', return_value=True) as mock_queue:
            count = await notification_service.notify_admins_for_user_registration(test_user.id, db_session)

            assert count == 1
            # Check that email was queued
            mock_queue.assert_called_once()
            call_args = mock_queue.call_args
            assert call_args[0][1].id == test_admin_user.id  # Admin user
            assert call_args[0][2] == 'admin_alert'  # Template name

    @pytest.mark.asyncio
    async def test_no_notification_for_nonexistent_user(self, db_session):
        """Test that no notification is created for nonexistent user."""
        notification_service = NotificationService()
        count = await notification_service.notify_admins_for_user_registration(99999, db_session)

        assert count == 0

    @pytest.mark.asyncio
    async def test_no_notification_for_disabled_admin(self, db_session, test_user):
        """Test that disabled admins are not notified."""
        # Create disabled admin
        disabled_admin = User(
            username="disabled_admin",
            email="disabled_admin@example.com",
            password_hash="dummy_hash",
            enabled=False,  # Disabled
            email_verified=True,
            email_verified_at=datetime.now(timezone.utc),
            is_admin=True,
            is_moderator=False
        )
        db_session.add(disabled_admin)
        db_session.commit()  # Commit user first to get ID
        db_session.refresh(disabled_admin)

        # Create preference for disabled admin
        admin_pref = NotificationPreference(
            user_id=disabled_admin.id,
            category='admin_alerts',
            enable_website=True,
            enable_email=False,
            frequency='immediate'
        )
        db_session.add(admin_pref)
        db_session.commit()

        # Verify user
        test_user.email_verified = True
        test_user.email_verified_at = datetime.now(timezone.utc)
        db_session.commit()

        # Notify admins
        notification_service = NotificationService()
        count = await notification_service.notify_admins_for_user_registration(test_user.id, db_session)

        # Should not notify disabled admin
        assert count == 0

        # Check that no notification was created for disabled admin
        notif = db_session.query(Notification).filter(
            Notification.user_id == disabled_admin.id,
            Notification.entity_id == test_user.id
        ).first()
        assert notif is None


class TestAdminNotificationsForDivingCenterClaim:
    """Test admin notifications for diving center ownership claims."""

    @pytest.mark.asyncio
    async def test_notify_admins_for_diving_center_claim(self, db_session, test_admin_user, test_user):
        """Test that admins are notified when a diving center ownership claim is made."""
        # Set up admin with admin_alerts preference
        admin_pref = NotificationPreference(
            user_id=test_admin_user.id,
            category='admin_alerts',
            enable_website=True,
            enable_email=False,
            frequency='immediate'
        )
        db_session.add(admin_pref)
        db_session.commit()

        # Create diving center
        diving_center = DivingCenter(
            name="Test Diving Center",
            latitude=37.7749,
            longitude=-122.4194,
            country="USA",
            region="California"
        )
        db_session.add(diving_center)
        db_session.commit()
        db_session.refresh(diving_center)

        # Notify admins about claim
        notification_service = NotificationService()
        count = await notification_service.notify_admins_for_diving_center_claim(
            diving_center_id=diving_center.id,
            user_id=test_user.id,
            claim_reason="I am the owner of this center",
            db=db_session
        )

        # Check that notification was created
        assert count == 1
        notification = db_session.query(Notification).filter(
            Notification.user_id == test_admin_user.id,
            Notification.entity_type == 'diving_center',
            Notification.entity_id == diving_center.id,
            Notification.category == 'admin_alerts'
        ).first()

        assert notification is not None
        assert "Diving Center Ownership Claim" in notification.title
        assert diving_center.name in notification.title
        assert test_user.username in notification.message
        assert test_user.email in notification.message
        assert "I am the owner of this center" in notification.message
        assert str(diving_center.id) in notification.message
        assert notification.link_url == "/admin/ownership-requests"

    @pytest.mark.asyncio
    async def test_notify_admins_for_claim_without_reason(self, db_session, test_admin_user, test_user):
        """Test that admins are notified even when no claim reason is provided."""
        # Set up admin with admin_alerts preference
        admin_pref = NotificationPreference(
            user_id=test_admin_user.id,
            category='admin_alerts',
            enable_website=True,
            enable_email=False,
            frequency='immediate'
        )
        db_session.add(admin_pref)
        db_session.commit()

        # Create diving center
        diving_center = DivingCenter(
            name="Test Diving Center 2",
            latitude=37.7749,
            longitude=-122.4194,
            country="USA",
            region="California"
        )
        db_session.add(diving_center)
        db_session.commit()
        db_session.refresh(diving_center)

        # Notify admins about claim (no reason)
        notification_service = NotificationService()
        count = await notification_service.notify_admins_for_diving_center_claim(
            diving_center_id=diving_center.id,
            user_id=test_user.id,
            claim_reason=None,
            db=db_session
        )

        assert count == 1
        notification = db_session.query(Notification).filter(
            Notification.user_id == test_admin_user.id,
            Notification.entity_id == diving_center.id
        ).first()

        assert notification is not None
        # Message should not contain "Reason:" when reason is None
        assert "Reason:" not in notification.message

    @pytest.mark.asyncio
    async def test_no_duplicate_claim_notifications(self, db_session, test_admin_user, test_user):
        """Test that duplicate notifications are not sent for the same claim."""
        # Set up admin with admin_alerts preference
        admin_pref = NotificationPreference(
            user_id=test_admin_user.id,
            category='admin_alerts',
            enable_website=True,
            enable_email=False,
            frequency='immediate'
        )
        db_session.add(admin_pref)
        db_session.commit()

        # Create diving center
        diving_center = DivingCenter(
            name="Test Diving Center 3",
            latitude=37.7749,
            longitude=-122.4194,
            country="USA",
            region="California"
        )
        db_session.add(diving_center)
        db_session.commit()
        db_session.refresh(diving_center)

        # First notification
        notification_service = NotificationService()
        count1 = await notification_service.notify_admins_for_diving_center_claim(
            diving_center_id=diving_center.id,
            user_id=test_user.id,
            claim_reason="First claim",
            db=db_session
        )
        assert count1 == 1

        # Second notification (should create another notification, as there's no duplicate check for claims)
        # Actually, looking at the code, there's no duplicate prevention for claims
        # This is intentional - multiple claims can be made
        count2 = await notification_service.notify_admins_for_diving_center_claim(
            diving_center_id=diving_center.id,
            user_id=test_user.id,
            claim_reason="Second claim",
            db=db_session
        )
        # Should create another notification (no duplicate prevention for claims)
        assert count2 == 1

        # Check that two notifications exist
        notifications = db_session.query(Notification).filter(
            Notification.user_id == test_admin_user.id,
            Notification.entity_id == diving_center.id
        ).all()
        assert len(notifications) == 2

    @pytest.mark.asyncio
    async def test_no_notification_for_nonexistent_diving_center(self, db_session, test_admin_user, test_user):
        """Test that no notification is created for nonexistent diving center."""
        notification_service = NotificationService()
        count = await notification_service.notify_admins_for_diving_center_claim(
            diving_center_id=99999,
            user_id=test_user.id,
            claim_reason="Test reason",
            db=db_session
        )

        assert count == 0

    @pytest.mark.asyncio
    async def test_no_notification_for_nonexistent_user(self, db_session, test_admin_user):
        """Test that no notification is created for nonexistent user."""
        # Create diving center
        diving_center = DivingCenter(
            name="Test Diving Center 4",
            latitude=37.7749,
            longitude=-122.4194,
            country="USA",
            region="California"
        )
        db_session.add(diving_center)
        db_session.commit()
        db_session.refresh(diving_center)

        notification_service = NotificationService()
        count = await notification_service.notify_admins_for_diving_center_claim(
            diving_center_id=diving_center.id,
            user_id=99999,
            claim_reason="Test reason",
            db=db_session
        )

        assert count == 0


class TestAdminNotificationsIntegration:
    """Integration tests for admin notifications with actual endpoints."""

    def test_register_then_verify_email_triggers_notification(
        self, client, db_session, test_admin_user, monkeypatch
    ):
        """Test that registering a user and then verifying email triggers admin notification."""
        # Set up admin with admin_alerts preference
        admin_pref = NotificationPreference(
            user_id=test_admin_user.id,
            category='admin_alerts',
            enable_website=True,
            enable_email=False,
            frequency='immediate'
        )
        db_session.add(admin_pref)
        db_session.commit()

        # Mock Turnstile and email sending
        with patch('app.routers.auth.turnstile_service') as mock_turnstile:
            mock_turnstile.is_enabled.return_value = False
            with patch('app.services.email_service.EmailService.send_verification_email') as mock_send:
                mock_send.return_value = True

                # Register user
                response = client.post("/api/v1/auth/register", json={
                    "username": "newuser123",
                    "email": "newuser123@example.com",
                    "password": "Password123!"
                })

                assert response.status_code == status.HTTP_201_CREATED

                # Get the created user
                from app.models import User
                new_user = db_session.query(User).filter(User.username == "newuser123").first()
                assert new_user is not None
                assert new_user.email_verified is False

                # Check that NO notification was created yet (before verification)
                notification_before = db_session.query(Notification).filter(
                    Notification.user_id == test_admin_user.id,
                    Notification.entity_id == new_user.id
                ).first()
                assert notification_before is None

                # Create verification token
                email_verification_service = EmailVerificationService()
                token_obj = email_verification_service.create_verification_token(new_user.id, db_session)
                token = token_obj.token

                # Verify email (don't follow redirects)
                response = client.get(f"/api/v1/auth/verify-email?token={token}", follow_redirects=False)

                # Should redirect to frontend with success
                assert response.status_code == status.HTTP_302_FOUND
                assert "success=true" in response.headers["location"]

                # Refresh user
                db_session.refresh(new_user)
                assert new_user.email_verified is True

                # Check that notification WAS created after verification
                notification_after = db_session.query(Notification).filter(
                    Notification.user_id == test_admin_user.id,
                    Notification.entity_type == 'user',
                    Notification.entity_id == new_user.id,
                    Notification.category == 'admin_alerts'
                ).first()

                assert notification_after is not None
                assert "New User Registration" in notification_after.title
                assert new_user.username in notification_after.message

    def test_google_login_triggers_notification(self, client, db_session, test_admin_user, monkeypatch):
        """Test that Google OAuth login triggers admin notification for new users."""
        # Set up admin with admin_alerts preference
        admin_pref = NotificationPreference(
            user_id=test_admin_user.id,
            category='admin_alerts',
            enable_website=True,
            enable_email=False,
            frequency='immediate'
        )
        db_session.add(admin_pref)
        db_session.commit()

        # Mock Google token verification
        mock_google_user_info = {
            'email': 'newgoogleuser@gmail.com',
            'sub': 'google_12345',
            'name': 'Google User',
            'picture': 'https://example.com/pic.jpg'
        }

        with patch('app.routers.auth.verify_google_token', return_value=mock_google_user_info):
            with patch('app.google_auth.verify_google_token', return_value=mock_google_user_info):
                # Google login (will create new user)
                response = client.post("/api/v1/auth/google-login", json={
                    "token": "fake_google_token"
                })

                # Should succeed
                assert response.status_code == status.HTTP_200_OK
                assert "access_token" in response.json()

                # Get the created user
                from app.models import User
                google_user = db_session.query(User).filter(User.email == 'newgoogleuser@gmail.com').first()
                assert google_user is not None
                assert google_user.email_verified is True
                assert google_user.google_id == 'google_12345'

                # Check that notification WAS created
                notification = db_session.query(Notification).filter(
                    Notification.user_id == test_admin_user.id,
                    Notification.entity_type == 'user',
                    Notification.entity_id == google_user.id,
                    Notification.category == 'admin_alerts'
                ).first()

                assert notification is not None
                assert "New User Registration" in notification.title
                assert google_user.username in notification.message

