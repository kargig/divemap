"""
Tests for email unsubscribe functionality.

Tests unsubscribe token generation, validation, unsubscribe endpoints,
re-subscribe functionality, global opt-out, and edge cases.
"""

import pytest
import json
from fastapi import status
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
from app.models import User, UnsubscribeToken, NotificationPreference
from app.services.unsubscribe_token_service import unsubscribe_token_service


class TestUnsubscribeTokenService:
    """Test unsubscribe token service functions."""

    def test_generate_unsubscribe_token(self):
        """Test token generation creates unique tokens."""
        token1 = unsubscribe_token_service.generate_unsubscribe_token()
        token2 = unsubscribe_token_service.generate_unsubscribe_token()
        
        assert token1 != token2
        assert len(token1) > 32  # URL-safe base64 encoding
        assert isinstance(token1, str)

    def test_get_or_create_unsubscribe_token(self, db_session, test_user):
        """Test getting or creating an unsubscribe token."""
        token_obj = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        
        assert token_obj is not None
        assert token_obj.user_id == test_user.id
        assert token_obj.token is not None
        # Check expiration is in the future
        expires_at = token_obj.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        assert expires_at > datetime.now(timezone.utc)
        assert token_obj.last_used_at is None

    def test_get_or_create_returns_existing_token(self, db_session, test_user):
        """Test that existing valid token is returned."""
        # Create token
        token1 = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        
        # Get token again
        token2 = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        
        assert token1.id == token2.id
        assert token1.token == token2.token

    def test_get_or_create_replaces_expired_token(self, db_session, test_user):
        """Test that expired token is replaced with new one."""
        # Create expired token
        expired_token = UnsubscribeToken(
            user_id=test_user.id,
            token=unsubscribe_token_service.generate_unsubscribe_token(),
            expires_at=datetime.now(timezone.utc) - timedelta(days=1)
        )
        db_session.add(expired_token)
        db_session.commit()
        
        # Get or create should create new token
        new_token = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        
        assert new_token.id != expired_token.id
        assert new_token.token != expired_token.token
        # Ensure timezone-aware comparison
        expires_at = new_token.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        assert expires_at > datetime.now(timezone.utc)

    def test_validate_token_success(self, db_session, test_user):
        """Test validating a valid token."""
        token_obj = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        
        validated = unsubscribe_token_service.validate_token(token_obj.token, db_session)
        
        assert validated is not None
        assert validated.id == token_obj.id

    def test_validate_token_invalid(self, db_session):
        """Test validating an invalid token."""
        validated = unsubscribe_token_service.validate_token("invalid_token", db_session)
        
        assert validated is None

    def test_validate_token_expired(self, db_session, test_user):
        """Test validating an expired token (should NOT auto-refresh)."""
        # Create expired token
        expired_token = UnsubscribeToken(
            user_id=test_user.id,
            token=unsubscribe_token_service.generate_unsubscribe_token(),
            expires_at=datetime.now(timezone.utc) - timedelta(days=1)
        )
        db_session.add(expired_token)
        db_session.commit()
        
        # Validate should return None (not auto-refresh)
        validated = unsubscribe_token_service.validate_token(expired_token.token, db_session)
        
        assert validated is None

    def test_update_token_usage(self, db_session, test_user):
        """Test updating token usage timestamp."""
        token_obj = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        initial_used_at = token_obj.last_used_at
        
        unsubscribe_token_service.update_token_usage(token_obj, db_session)
        
        db_session.refresh(token_obj)
        assert token_obj.last_used_at is not None
        assert token_obj.last_used_at != initial_used_at

    def test_store_and_get_previous_preferences(self, db_session, test_user):
        """Test storing and retrieving previous preferences."""
        token_obj = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        
        preferences = {
            'new_dive_sites': {
                'enable_email': True,
                'enable_website': True,
                'frequency': 'immediate'
            }
        }
        
        unsubscribe_token_service.store_previous_preferences(token_obj, preferences, db_session)
        
        retrieved = unsubscribe_token_service.get_previous_preferences(token_obj)
        assert retrieved == preferences

    def test_refresh_token(self, db_session, test_user):
        """Test refreshing a token (creates new one)."""
        old_token = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        old_token_id = old_token.id
        old_token_value = old_token.token
        
        new_token = unsubscribe_token_service.refresh_token(test_user.id, db_session)
        
        assert new_token.id != old_token_id
        assert new_token.token != old_token_value
        
        # Old token should be deleted
        old_token_check = db_session.query(UnsubscribeToken).filter(UnsubscribeToken.id == old_token_id).first()
        assert old_token_check is None


class TestUnsubscribeEndpoints:
    """Test unsubscribe API endpoints."""

    def test_unsubscribe_category_success(self, client, db_session, test_user):
        """Test successful category-specific unsubscribe."""
        # Create token
        token_obj = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        
        # Create preference with email enabled
        preference = NotificationPreference(
            user_id=test_user.id,
            category='new_dive_sites',
            enable_website=True,
            enable_email=True,
            frequency='immediate'
        )
        db_session.add(preference)
        db_session.commit()
        
        # Unsubscribe
        response = client.get(f"/api/v1/unsubscribe?token={token_obj.token}&category=new_dive_sites&format=json")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        
        # Check preference is disabled
        db_session.refresh(preference)
        assert preference.enable_email is False
        
        # Check token usage updated
        db_session.refresh(token_obj)
        assert token_obj.last_used_at is not None

    def test_unsubscribe_all_success(self, client, db_session, test_user):
        """Test successful global unsubscribe."""
        # Create token
        token_obj = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        
        # Create preferences with email enabled
        pref1 = NotificationPreference(
            user_id=test_user.id,
            category='new_dive_sites',
            enable_website=True,
            enable_email=True,
            frequency='immediate'
        )
        pref2 = NotificationPreference(
            user_id=test_user.id,
            category='new_dives',
            enable_website=True,
            enable_email=True,
            frequency='immediate'
        )
        db_session.add(pref1)
        db_session.add(pref2)
        db_session.commit()
        
        # Unsubscribe from all
        response = client.get(f"/api/v1/unsubscribe/all?token={token_obj.token}&format=json")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        
        # Check user opt-out flag
        db_session.refresh(test_user)
        assert test_user.email_notifications_opted_out is True
        assert test_user.email_opt_out_at is not None
        
        # Check all preferences disabled
        db_session.refresh(pref1)
        db_session.refresh(pref2)
        assert pref1.enable_email is False
        assert pref2.enable_email is False

    def test_unsubscribe_invalid_token(self, client):
        """Test unsubscribe with invalid token."""
        response = client.get("/api/v1/unsubscribe?token=invalid_token&format=json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_unsubscribe_expired_token(self, client, db_session, test_user):
        """Test unsubscribe with expired token (should NOT auto-refresh)."""
        # Create expired token
        expired_token = UnsubscribeToken(
            user_id=test_user.id,
            token=unsubscribe_token_service.generate_unsubscribe_token(),
            expires_at=datetime.now(timezone.utc) - timedelta(days=1)
        )
        db_session.add(expired_token)
        db_session.commit()
        
        response = client.get(f"/api/v1/unsubscribe?token={expired_token.token}&format=json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_resubscribe_category_success(self, client, db_session, test_user):
        """Test successful category-specific re-subscribe."""
        # Create token
        token_obj = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        
        # Create preference with email disabled
        preference = NotificationPreference(
            user_id=test_user.id,
            category='new_dive_sites',
            enable_website=True,
            enable_email=False,
            frequency='immediate'
        )
        db_session.add(preference)
        db_session.commit()
        
        # Store previous preferences
        previous_prefs = {
            'new_dive_sites': {
                'enable_email': True,
                'enable_website': True,
                'frequency': 'immediate'
            }
        }
        unsubscribe_token_service.store_previous_preferences(token_obj, previous_prefs, db_session)
        
        # Re-subscribe
        response = client.post(f"/api/v1/unsubscribe/resubscribe?token={token_obj.token}&category=new_dive_sites")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        
        # Check preference is enabled
        db_session.refresh(preference)
        assert preference.enable_email is True

    def test_resubscribe_all_success(self, client, db_session, test_user):
        """Test successful global re-subscribe."""
        # Create token
        token_obj = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        
        # Set global opt-out
        test_user.email_notifications_opted_out = True
        test_user.email_opt_out_at = datetime.now(timezone.utc)
        
        # Create preferences with email disabled
        pref1 = NotificationPreference(
            user_id=test_user.id,
            category='new_dive_sites',
            enable_website=True,
            enable_email=False,
            frequency='immediate'
        )
        db_session.add(pref1)
        db_session.commit()
        
        # Store previous preferences
        previous_prefs = {
            'new_dive_sites': {
                'enable_email': True,
                'enable_website': True,
                'frequency': 'immediate'
            }
        }
        unsubscribe_token_service.store_previous_preferences(token_obj, previous_prefs, db_session)
        
        # Re-subscribe to all
        response = client.post(f"/api/v1/unsubscribe/resubscribe?token={token_obj.token}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        
        # Check user opt-out flag cleared
        db_session.refresh(test_user)
        assert test_user.email_notifications_opted_out is False
        assert test_user.email_opt_out_at is None
        
        # Check preference is enabled
        db_session.refresh(pref1)
        assert pref1.enable_email is True

    def test_resubscribe_invalid_token(self, client):
        """Test re-subscribe with invalid token."""
        response = client.post("/api/v1/unsubscribe/resubscribe?token=invalid_token")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_unsubscribe_redirect(self, client, db_session, test_user):
        """Test unsubscribe redirects to frontend."""
        token_obj = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        
        response = client.get(f"/api/v1/unsubscribe?token={token_obj.token}&category=new_dive_sites", follow_redirects=False)
        
        assert response.status_code == status.HTTP_302_FOUND
        assert "unsubscribe" in response.headers["location"]
        assert "success=true" in response.headers["location"]

    def test_unsubscribe_confirm_endpoint(self, client, db_session, test_user):
        """Test unsubscribe confirmation endpoint."""
        token_obj = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        
        response = client.get(f"/api/v1/unsubscribe/confirm?token={token_obj.token}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["user_email"] == test_user.email
        assert data["token"] == token_obj.token


class TestGlobalOptOut:
    """Test global opt-out functionality."""

    def test_global_opt_out_prevents_email_notifications(self, db_session, test_user):
        """Test that global opt-out prevents email notifications."""
        from app.services.notification_service import NotificationService
        
        # Set global opt-out
        test_user.email_notifications_opted_out = True
        test_user.email_opt_out_at = datetime.now(timezone.utc)
        db_session.commit()
        
        # Create preference with email enabled
        preference = NotificationPreference(
            user_id=test_user.id,
            category='new_dive_sites',
            enable_website=True,
            enable_email=True,
            frequency='immediate'
        )
        db_session.add(preference)
        db_session.commit()
        
        # Check opt-out
        notification_service = NotificationService()
        is_opted_out = notification_service.check_email_opted_out(test_user.id, db_session)
        
        assert is_opted_out is True

    def test_preference_update_respects_global_opt_out(self, client, db_session, test_user, auth_headers):
        """Test that preference update fails if global opt-out is enabled."""
        # Set global opt-out
        test_user.email_notifications_opted_out = True
        test_user.email_opt_out_at = datetime.now(timezone.utc)
        db_session.commit()
        
        # Create preference
        preference = NotificationPreference(
            user_id=test_user.id,
            category='new_dive_sites',
            enable_website=True,
            enable_email=False,
            frequency='immediate'
        )
        db_session.add(preference)
        db_session.commit()
        
        # Try to enable email
        response = client.put(
            "/api/v1/notifications/preferences/new_dive_sites",
            headers=auth_headers,
            json={"enable_email": True}
        )
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "globally opted out" in response.json()["detail"].lower()


class TestUnsubscribeTimezoneHandling:
    """Test timezone handling in unsubscribe token service."""

    def test_get_or_create_token_with_naive_datetime(self, db_session, test_user):
        """Test that token service handles timezone-naive datetimes correctly."""
        # Create token with naive datetime (simulating database return)
        naive_expires = datetime.now() + timedelta(days=30)
        token_obj = UnsubscribeToken(
            user_id=test_user.id,
            token=unsubscribe_token_service.generate_unsubscribe_token(),
            expires_at=naive_expires
        )
        db_session.add(token_obj)
        db_session.commit()
        db_session.refresh(token_obj)
        
        # Get or create should handle naive datetime correctly
        result = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        
        # Should create new token or return existing (handles timezone correctly)
        assert result is not None
        expires_at = result.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        assert expires_at > datetime.now(timezone.utc)

    def test_validate_token_with_naive_datetime(self, db_session, test_user):
        """Test that validate_token handles timezone-naive datetimes correctly."""
        # Create token with naive datetime
        naive_expires = datetime.now() + timedelta(days=30)
        token_obj = UnsubscribeToken(
            user_id=test_user.id,
            token=unsubscribe_token_service.generate_unsubscribe_token(),
            expires_at=naive_expires
        )
        db_session.add(token_obj)
        db_session.commit()
        db_session.refresh(token_obj)
        
        # Validate should handle naive datetime correctly
        validated = unsubscribe_token_service.validate_token(token_obj.token, db_session)
        
        assert validated is not None
        assert validated.id == token_obj.id


class TestUnsubscribeEdgeCases:
    """Test edge cases for unsubscribe functionality."""

    def test_unsubscribe_category_without_preference(self, client, db_session, test_user):
        """Test unsubscribe when preference doesn't exist (should create disabled preference)."""
        token_obj = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        
        # No preference exists for this category
        preference = db_session.query(NotificationPreference).filter(
            NotificationPreference.user_id == test_user.id,
            NotificationPreference.category == 'new_dive_sites'
        ).first()
        assert preference is None
        
        # Unsubscribe
        response = client.get(f"/api/v1/unsubscribe?token={token_obj.token}&category=new_dive_sites&format=json")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        
        # Check preference was created with email disabled
        preference = db_session.query(NotificationPreference).filter(
            NotificationPreference.user_id == test_user.id,
            NotificationPreference.category == 'new_dive_sites'
        ).first()
        assert preference is not None
        assert preference.enable_email is False
        assert preference.enable_website is True  # Website notifications still enabled

    def test_resubscribe_without_previous_preferences(self, client, db_session, test_user):
        """Test re-subscribe when no previous preferences stored (should enable with defaults)."""
        token_obj = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        
        # Create preference with email disabled
        preference = NotificationPreference(
            user_id=test_user.id,
            category='new_dive_sites',
            enable_website=True,
            enable_email=False,
            frequency='immediate'
        )
        db_session.add(preference)
        db_session.commit()
        
        # No previous preferences stored
        # Re-subscribe should still work
        response = client.post(f"/api/v1/unsubscribe/resubscribe?token={token_obj.token}&category=new_dive_sites")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        
        # Check preference is enabled (default behavior)
        db_session.refresh(preference)
        assert preference.enable_email is True

    def test_unsubscribe_all_without_preferences(self, client, db_session, test_user):
        """Test global unsubscribe when user has no preferences."""
        token_obj = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        
        # No preferences exist
        preferences = db_session.query(NotificationPreference).filter(
            NotificationPreference.user_id == test_user.id
        ).all()
        assert len(preferences) == 0
        
        # Unsubscribe from all
        response = client.get(f"/api/v1/unsubscribe/all?token={token_obj.token}&format=json")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        
        # Check user opt-out flag
        db_session.refresh(test_user)
        assert test_user.email_notifications_opted_out is True
        assert test_user.email_opt_out_at is not None


class TestEmailServiceIntegration:
    """Test email service integration with unsubscribe links."""

    def test_send_notification_email_includes_unsubscribe_links(self, db_session, test_user, monkeypatch):
        """Test that send_notification_email includes unsubscribe links in template context."""
        from app.services.email_service import EmailService
        from unittest.mock import patch, MagicMock
        
        # Create token
        token_obj = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        
        # Mock template rendering
        with patch('app.services.email_service.EmailService._render_template') as mock_render:
            mock_render.return_value = "<html>Test email with unsubscribe links</html>"
            
            # Mock SES service
            with patch('app.services.email_service.SESService') as mock_ses_class:
                mock_ses = MagicMock()
                mock_ses_class.return_value = mock_ses
                mock_ses.send_email.return_value = True
                
                email_service = EmailService()
                
                # Send notification email
                success = email_service.send_notification_email(
                    user_email=test_user.email,
                    notification={
                        'title': 'Test Notification',
                        'message': 'Test message',
                        'link_url': '/test',
                        'category': 'new_dive_sites'
                    },
                    template_name='new_dive_site',
                    user_id=test_user.id,
                    db=db_session
                )
                
                assert success is True
                
                # Verify template was rendered with unsubscribe context
                assert mock_render.called
                call_args = mock_render.call_args
                # _render_template is called as: _render_template(template_name, context, extension)
                # So context is the second positional argument
                context = call_args[0][1]
                
                # Check unsubscribe links are in context
                assert 'unsubscribe_url' in context
                assert 'unsubscribe_all_url' in context
                assert 'unsubscribe_token' in context
                assert context['unsubscribe_token'] == token_obj.token
                assert 'category' in context
                assert context['category'] == 'new_dive_sites'

    def test_send_notification_email_with_prefetched_token(self, db_session, test_user, monkeypatch):
        """Test that send_notification_email uses pre-fetched unsubscribe token (Lambda path)."""
        from app.services.email_service import EmailService
        from unittest.mock import patch, MagicMock
        
        token_value = "prefetched_token_from_sqs"
        
        # Mock template rendering
        with patch('app.services.email_service.EmailService._render_template') as mock_render:
            mock_render.return_value = "<html>Test email</html>"
            
            # Mock SES service
            with patch('app.services.email_service.SESService') as mock_ses_class:
                mock_ses = MagicMock()
                mock_ses_class.return_value = mock_ses
                mock_ses.send_email.return_value = True
                
                email_service = EmailService()
                
                # Send notification email with pre-fetched token
                success = email_service.send_notification_email(
                    user_email=test_user.email,
                    notification={
                        'title': 'Test Notification',
                        'message': 'Test message',
                        'link_url': '/test',
                        'category': 'new_dive_sites'
                    },
                    template_name='new_dive_site',
                    unsubscribe_token=token_value  # Pre-fetched token
                )
                
                assert success is True
                
                # Verify template was rendered with pre-fetched token
                call_args = mock_render.call_args
                # _render_template is called as: _render_template(template_name, context, extension)
                # So context is the second positional argument
                context = call_args[0][1]
                assert context['unsubscribe_token'] == token_value

    def test_send_notification_email_excludes_unsubscribe_for_admin_alert(self, db_session, test_user, monkeypatch):
        """Test that admin_alert emails do NOT include unsubscribe links."""
        from app.services.email_service import EmailService
        from unittest.mock import patch, MagicMock
        
        # Mock template rendering
        with patch('app.services.email_service.EmailService._render_template') as mock_render:
            mock_render.return_value = "<html>Admin alert</html>"
            
            # Mock SES service
            with patch('app.services.email_service.SESService') as mock_ses_class:
                mock_ses = MagicMock()
                mock_ses_class.return_value = mock_ses
                mock_ses.send_email.return_value = True
                
                email_service = EmailService()
                
                # Send admin alert email
                success = email_service.send_notification_email(
                    user_email=test_user.email,
                    notification={
                        'title': 'Admin Alert',
                        'message': 'Admin notification',
                        'category': 'admin_alerts'
                    },
                    template_name='admin_alert',
                    user_id=test_user.id,
                    db=db_session
                )
                
                assert success is True
                
                # Verify template was rendered WITHOUT unsubscribe context
                call_args = mock_render.call_args
                # _render_template is called as: _render_template(template_name, context, extension)
                # So context is the second positional argument
                context = call_args[0][1]
                
                # Unsubscribe links should NOT be in context
                assert 'unsubscribe_url' not in context
                assert 'unsubscribe_all_url' not in context
                assert 'unsubscribe_token' not in context

    def test_send_notification_email_excludes_unsubscribe_for_verification(self, db_session, test_user, monkeypatch):
        """Test that email_verification emails do NOT include unsubscribe links."""
        from app.services.email_service import EmailService
        from unittest.mock import patch, MagicMock
        
        # Mock template rendering
        with patch('app.services.email_service.EmailService._render_template') as mock_render:
            mock_render.return_value = "<html>Verification email</html>"
            
            # Mock SES service
            with patch('app.services.email_service.SESService') as mock_ses_class:
                mock_ses = MagicMock()
                mock_ses_class.return_value = mock_ses
                mock_ses.send_email.return_value = True
                
                email_service = EmailService()
                
                # Send verification email
                success = email_service.send_verification_email(
                    user_email=test_user.email,
                    verification_token="test_token"
                )
                
                assert success is True
                
                # Verify template was rendered WITHOUT unsubscribe context
                call_args = mock_render.call_args
                # _render_template is called as: _render_template(template_name, context, extension)
                # So context is the second positional argument
                context = call_args[0][1]
                
                # Unsubscribe links should NOT be in context
                assert 'unsubscribe_url' not in context
                assert 'unsubscribe_all_url' not in context
                assert 'unsubscribe_token' not in context


class TestNotificationServiceIntegration:
    """Test notification service integration with unsubscribe tokens."""

    def test_queue_email_notification_includes_token(self, db_session, test_user, monkeypatch):
        """Test that _queue_email_notification includes unsubscribe token in SQS message."""
        from app.services.notification_service import NotificationService
        from app.models import Notification
        from unittest.mock import patch, MagicMock
        
        notification_service = NotificationService()
        
        # Create notification
        notification = Notification(
            user_id=test_user.id,
            category='new_dive_sites',
            title='Test Notification',
            message='Test message',
            link_url='/test',
            entity_type='dive_site',
            entity_id=1
        )
        db_session.add(notification)
        db_session.commit()
        db_session.refresh(notification)
        
        # Create preference
        preference = NotificationPreference(
            user_id=test_user.id,
            category='new_dive_sites',
            enable_website=True,
            enable_email=True,
            frequency='immediate'
        )
        db_session.add(preference)
        db_session.commit()
        
        # Mock SQS service
        with patch.object(notification_service.sqs_service, 'send_email_task') as mock_sqs:
            mock_sqs.return_value = True
            
            # Queue email notification
            success = notification_service._queue_email_notification(
                notification=notification,
                user=test_user,
                template_name='new_dive_site',
                db=db_session
            )
            
            assert success is True
            assert mock_sqs.called
            
            # Verify SQS message includes token and user_id
            call_args = mock_sqs.call_args
            assert call_args[1]['user_id'] == test_user.id
            assert call_args[1]['unsubscribe_token'] is not None
            assert len(call_args[1]['unsubscribe_token']) > 0

    def test_queue_email_notification_skips_opted_out_users(self, db_session, test_user):
        """Test that opted-out users don't get emails queued."""
        from app.services.notification_service import NotificationService
        from app.models import Notification
        
        notification_service = NotificationService()
        
        # Set global opt-out
        test_user.email_notifications_opted_out = True
        test_user.email_opt_out_at = datetime.now(timezone.utc)
        db_session.commit()
        
        # Create notification
        notification = Notification(
            user_id=test_user.id,
            category='new_dive_sites',
            title='Test Notification',
            message='Test message'
        )
        db_session.add(notification)
        db_session.commit()
        db_session.refresh(notification)
        
        # Queue email notification (should be skipped)
        success = notification_service._queue_email_notification(
            notification=notification,
            user=test_user,
            template_name='new_dive_site',
            db=db_session
        )
        
        assert success is False  # Should return False for opted-out users

    def test_queue_email_notification_direct_send_fallback(self, db_session, test_user, monkeypatch):
        """Test that direct email sending works when SQS is unavailable."""
        from app.services.notification_service import NotificationService
        from app.models import Notification
        from unittest.mock import patch, MagicMock
        
        notification_service = NotificationService()
        
        # Create notification
        notification = Notification(
            user_id=test_user.id,
            category='new_dive_sites',
            title='Test Notification',
            message='Test message',
            link_url='/test'
        )
        db_session.add(notification)
        db_session.commit()
        db_session.refresh(notification)
        
        # Create preference
        preference = NotificationPreference(
            user_id=test_user.id,
            category='new_dive_sites',
            enable_website=True,
            enable_email=True,
            frequency='immediate'
        )
        db_session.add(preference)
        db_session.commit()
        
        # Mock SQS to return False (unavailable)
        with patch.object(notification_service.sqs_service, 'send_email_task', return_value=False):
            # Mock email service
            with patch.object(notification_service.email_service, 'send_notification_email') as mock_email:
                mock_email.return_value = True
                
                # Queue email notification (should fallback to direct send)
                success = notification_service._queue_email_notification(
                    notification=notification,
                    user=test_user,
                    template_name='new_dive_site',
                    db=db_session
                )
                
                assert success is True
                assert mock_email.called
                
                # Verify email was sent directly
                call_args = mock_email.call_args
                assert call_args[1]['user_email'] == test_user.email
                assert call_args[1]['user_id'] == test_user.id
                assert call_args[1]['db'] == db_session
                
                # Check notification marked as sent
                db_session.refresh(notification)
                assert notification.email_sent is True
                assert notification.email_sent_at is not None

    def test_queue_email_notification_force_direct_email(self, db_session, test_user, monkeypatch):
        """Test that FORCE_DIRECT_EMAIL bypasses SQS and sends directly."""
        from app.services.notification_service import NotificationService
        from app.models import Notification
        from unittest.mock import patch, MagicMock
        
        # Set FORCE_DIRECT_EMAIL
        monkeypatch.setenv('FORCE_DIRECT_EMAIL', 'true')
        
        notification_service = NotificationService()
        
        # Create notification
        notification = Notification(
            user_id=test_user.id,
            category='new_dive_sites',
            title='Test Notification',
            message='Test message'
        )
        db_session.add(notification)
        db_session.commit()
        db_session.refresh(notification)
        
        # Create preference
        preference = NotificationPreference(
            user_id=test_user.id,
            category='new_dive_sites',
            enable_website=True,
            enable_email=True,
            frequency='immediate'
        )
        db_session.add(preference)
        db_session.commit()
        
        # Mock SQS (should not be called)
        with patch.object(notification_service.sqs_service, 'send_email_task') as mock_sqs:
            # Mock email service
            with patch.object(notification_service.email_service, 'send_notification_email') as mock_email:
                mock_email.return_value = True
                
                # Queue email notification
                success = notification_service._queue_email_notification(
                    notification=notification,
                    user=test_user,
                    template_name='new_dive_site',
                    db=db_session
                )
                
                assert success is True
                # SQS should not be called when FORCE_DIRECT_EMAIL is set
                assert not mock_sqs.called
                # Email should be sent directly
                assert mock_email.called


class TestSQSLambdaIntegration:
    """Test SQS and Lambda integration with unsubscribe tokens."""

    def test_sqs_message_includes_unsubscribe_token(self, db_session, test_user, monkeypatch):
        """Test that SQS message includes user_id and unsubscribe_token."""
        from app.services.sqs_service import SQSService
        from unittest.mock import patch, MagicMock
        
        # Set environment variables to make SQS service available
        monkeypatch.setenv('AWS_ACCESS_KEY_ID', 'test-key')
        monkeypatch.setenv('AWS_SECRET_ACCESS_KEY', 'test-secret')
        monkeypatch.setenv('AWS_SQS_QUEUE_URL', 'https://sqs.test.amazonaws.com/test-queue')
        monkeypatch.setenv('AWS_REGION', 'us-east-1')
        
        # Mock boto3 client creation
        with patch('app.services.sqs_service.boto3.client') as mock_boto_client:
            mock_sqs_client = MagicMock()
            mock_boto_client.return_value = mock_sqs_client
            mock_response = {'MessageId': 'test-message-id'}
            mock_sqs_client.send_message.return_value = mock_response
            
            sqs_service = SQSService()
            
            # Create token
            token_obj = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
            
            # Send email task
            success = sqs_service.send_email_task(
                notification_id=1,
                user_email=test_user.email,
                user_id=test_user.id,
                notification_data={'title': 'Test', 'message': 'Test', 'category': 'new_dive_sites'},
                unsubscribe_token=token_obj.token
            )
            
            assert success is True
            assert mock_sqs_client.send_message.called
            
            # Verify message body includes token and user_id
            call_args = mock_sqs_client.send_message.call_args
            message_body = json.loads(call_args[1]['MessageBody'])
            
            assert message_body['user_id'] == test_user.id
            assert message_body['unsubscribe_token'] == token_obj.token
            assert message_body['notification_id'] == 1
            assert message_body['user_email'] == test_user.email
            assert 'notification' in message_body

    def test_lambda_reads_token_from_sqs_message(self, monkeypatch):
        """Test that Lambda reads unsubscribe token from SQS message."""
        import sys
        import os
        import importlib.util
        
        # Import Lambda email processor (same approach as test_lambda_email_processor.py)
        lambda_path = os.path.join(os.path.dirname(__file__), '..', 'lambda')
        email_processor_path = os.path.join(lambda_path, "email_processor.py")
        
        spec = importlib.util.spec_from_file_location("email_processor", email_processor_path)
        email_processor = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(email_processor)
        
        process_email_notification = email_processor.process_email_notification
        
        # Mock backend API call
        with patch.object(email_processor, 'call_backend_api') as mock_api:
            mock_api.return_value = {
                'id': 1,
                'user_id': 1,
                'email_sent': False
            }
            
            # Mock email service
            with patch.object(email_processor, 'EmailService') as mock_email_class:
                mock_email_service = MagicMock()
                mock_email_class.return_value = mock_email_service
                mock_email_service.send_notification_email.return_value = True
                
                # Process email notification with token from SQS
                token_value = "token_from_sqs_message"
                success = process_email_notification(
                    notification_id=1,
                    user_email="test@example.com",
                    notification_data={
                        'title': 'Test',
                        'message': 'Test',
                        'category': 'new_dive_sites'
                    },
                    user_id=1,
                    unsubscribe_token=token_value
                )
                
                assert success is True
                
                # Verify email service was called with token
                assert mock_email_service.send_notification_email.called
                call_args = mock_email_service.send_notification_email.call_args
                # Check if token is passed (either as kwarg or in kwargs)
                assert call_args[1].get('unsubscribe_token') == token_value or \
                       (hasattr(call_args, 'kwargs') and call_args.kwargs.get('unsubscribe_token') == token_value)

    def test_lambda_fallback_when_token_missing(self, monkeypatch):
        """Test that Lambda handles missing token gracefully."""
        import sys
        import os
        import importlib.util
        
        # Import Lambda email processor (same approach as test_lambda_email_processor.py)
        lambda_path = os.path.join(os.path.dirname(__file__), '..', 'lambda')
        email_processor_path = os.path.join(lambda_path, "email_processor.py")
        
        spec = importlib.util.spec_from_file_location("email_processor", email_processor_path)
        email_processor = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(email_processor)
        
        process_email_notification = email_processor.process_email_notification
        
        # Mock backend API call
        with patch.object(email_processor, 'call_backend_api') as mock_api:
            mock_api.return_value = {
                'id': 1,
                'user_id': 1,
                'email_sent': False
            }
            
            # Mock email service
            with patch.object(email_processor, 'EmailService') as mock_email_class:
                mock_email_service = MagicMock()
                mock_email_class.return_value = mock_email_service
                mock_email_service.send_notification_email.return_value = True
                
                # Process email notification without token (old message format)
                success = process_email_notification(
                    notification_id=1,
                    user_email="test@example.com",
                    notification_data={
                        'title': 'Test',
                        'message': 'Test',
                        'category': 'new_dive_sites'
                    },
                    user_id=None,
                    unsubscribe_token=None
                )
                
                # Should still succeed, but email sent without unsubscribe links
                assert success is True
                assert mock_email_service.send_notification_email.called
                call_args = mock_email_service.send_notification_email.call_args
                # Token should be None
                assert call_args[1].get('unsubscribe_token') is None


class TestUnsubscribeCleanupAndAudit:
    """Test cleanup and audit logging functionality."""

    def test_cleanup_expired_tokens(self, db_session, test_user):
        """Test cleanup of expired unsubscribe tokens."""
        # Create a different user for the expired token to avoid unique constraint
        expired_user = User(
            username="expired_user",
            email="expired@example.com",
            password_hash="$2b$12$bkh2s0S1uAXrAMa5CewBwubJhyiZJTs1jEwy7I4R2Sn9q9cXW2BxO",
            enabled=True,
            email_verified=True
        )
        db_session.add(expired_user)
        db_session.commit()
        db_session.refresh(expired_user)
        
        # Create expired token for the expired user
        expired_token = UnsubscribeToken(
            user_id=expired_user.id,
            token=unsubscribe_token_service.generate_unsubscribe_token(),
            expires_at=datetime.now(timezone.utc) - timedelta(days=35)  # Expired 35 days ago
        )
        db_session.add(expired_token)
        db_session.commit()
        db_session.refresh(expired_token)
        
        # Store the expired token ID before cleanup (object will be deleted)
        expired_token_id = expired_token.id
        
        # Create valid token for test_user
        valid_token = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        db_session.commit()
        valid_token_id = valid_token.id
        
        # Cleanup tokens older than 30 days
        deleted_count = unsubscribe_token_service.cleanup_expired_tokens(db_session, days_old=30)
        
        # Should delete expired token
        assert deleted_count >= 1
        
        # Verify expired token is deleted (use stored ID, not the object)
        expired_check = db_session.query(UnsubscribeToken).filter(
            UnsubscribeToken.id == expired_token_id
        ).first()
        assert expired_check is None
        
        # Verify valid token still exists (use stored ID)
        valid_check = db_session.query(UnsubscribeToken).filter(
            UnsubscribeToken.id == valid_token_id
        ).first()
        assert valid_check is not None

    def test_log_unsubscribe_event(self, db_session, test_user, caplog):
        """Test that unsubscribe events are logged."""
        import logging
        from app.services.unsubscribe_token_service import logger as unsubscribe_logger
        
        # Set log level for the unsubscribe logger
        caplog.set_level(logging.INFO, logger=unsubscribe_logger.name)
        
        token_obj = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        
        # Log unsubscribe event
        unsubscribe_token_service.log_unsubscribe_event(
            user_id=test_user.id,
            category='new_dive_sites',
            token=token_obj.token,
            db=db_session
        )
        
        # Check log was created
        assert "Unsubscribe event" in caplog.text
        assert str(test_user.id) in caplog.text
        assert "new_dive_sites" in caplog.text
        assert token_obj.token[:10] in caplog.text

    def test_log_unsubscribe_event_global(self, db_session, test_user, caplog):
        """Test that global unsubscribe events are logged correctly."""
        import logging
        from app.services.unsubscribe_token_service import logger as unsubscribe_logger
        
        # Set log level for the unsubscribe logger
        caplog.set_level(logging.INFO, logger=unsubscribe_logger.name)
        
        token_obj = unsubscribe_token_service.get_or_create_unsubscribe_token(test_user.id, db_session)
        
        # Log global unsubscribe event
        unsubscribe_token_service.log_unsubscribe_event(
            user_id=test_user.id,
            category=None,  # Global unsubscribe
            token=token_obj.token,
            db=db_session
        )
        
        # Check log was created with "all"
        assert "Unsubscribe event" in caplog.text
        assert "Category: all" in caplog.text

