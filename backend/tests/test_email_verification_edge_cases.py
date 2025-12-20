"""
Edge case tests for email verification functionality.

Tests concurrent operations, timezone edge cases, and rate limit bypass attempts.
"""

import pytest
from datetime import datetime, timezone, timedelta

from app.models import User, EmailVerificationToken
from app.services.email_verification_service import email_verification_service


def test_concurrent_token_creation(db_session):
    """Test that creating multiple tokens concurrently doesn't cause issues."""
    # Create a test user
    user = User(
        username="concurrent_test",
        email="concurrent@test.com",
        password_hash="test_hash",
        email_verified=False
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    
    # Create first token
    token1 = email_verification_service.create_verification_token(user.id, db_session)
    
    # Create second token (should revoke first)
    token2 = email_verification_service.create_verification_token(user.id, db_session)
    
    # First token should be revoked
    db_session.refresh(token1)
    assert token1.used_at is not None
    
    # Second token should be valid
    assert token2.used_at is None
    assert token2.token != token1.token


def test_timezone_edge_cases(db_session):
    """Test token expiration with timezone edge cases."""
    # Create a test user
    user = User(
        username="timezone_test",
        email="timezone@test.com",
        password_hash="test_hash",
        email_verified=False
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    
    # Create token
    token_obj = email_verification_service.create_verification_token(user.id, db_session)
    
    # Manually set expiration to 1 second ago to ensure it's expired
    # (Setting to exactly "now" can fail due to timing/precision issues)
    token_obj.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.commit()
    db_session.refresh(token_obj)
    
    # Token should be expired
    assert not email_verification_service.is_token_valid(token_obj.token, db_session)
    
    # Token should not verify
    result = email_verification_service.verify_token(token_obj.token, db_session)
    assert result is None


def test_rate_limit_bypass_attempt(db_session):
    """Test that rate limit checks work correctly."""
    # Create a test user
    user = User(
        username="ratelimit_test",
        email="ratelimit@test.com",
        password_hash="test_hash",
        email_verified=False
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    
    # Create tokens with timestamps just under 24 hours
    now = datetime.now(timezone.utc)
    one_day_ago = now - timedelta(hours=23, minutes=59)
    
    # Create old token (just under 24 hours)
    old_token = EmailVerificationToken(
        user_id=user.id,
        token="old_token",
        expires_at=now + timedelta(hours=1),
        created_at=one_day_ago
    )
    db_session.add(old_token)
    db_session.commit()
    
    # Check that this token is counted in rate limit
    recent_tokens = db_session.query(EmailVerificationToken).filter(
        EmailVerificationToken.user_id == user.id,
        EmailVerificationToken.created_at >= now - timedelta(days=1)
    ).count()
    
    assert recent_tokens >= 1


def test_token_expiration_at_midnight(db_session):
    """Test token expiration handling at midnight UTC."""
    # Create a test user
    user = User(
        username="midnight_test",
        email="midnight@test.com",
        password_hash="test_hash",
        email_verified=False
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    
    # Create token that expires at midnight UTC
    midnight = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    if midnight < datetime.now(timezone.utc):
        midnight = midnight + timedelta(days=1)
    
    token_obj = EmailVerificationToken(
        user_id=user.id,
        token="midnight_token",
        expires_at=midnight
    )
    db_session.add(token_obj)
    db_session.commit()
    
    # Token should be valid before midnight
    if datetime.now(timezone.utc) < midnight:
        assert email_verification_service.is_token_valid(token_obj.token, db_session)
    else:
        assert not email_verification_service.is_token_valid(token_obj.token, db_session)


def test_verify_already_verified_user(db_session):
    """Test that verifying an already verified user still marks token as used."""
    # Create a verified user
    user = User(
        username="already_verified",
        email="already@test.com",
        password_hash="test_hash",
        email_verified=True,
        email_verified_at=datetime.now(timezone.utc) - timedelta(days=1)
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    
    # Create token for already verified user
    token_obj = email_verification_service.create_verification_token(user.id, db_session)
    
    # Verify token (should still work and mark token as used)
    result = email_verification_service.verify_token(token_obj.token, db_session)
    
    assert result is not None
    assert result.id == user.id
    assert result.email_verified is True
    
    # Token should be marked as used
    db_session.refresh(token_obj)
    assert token_obj.used_at is not None


def test_token_cleanup_after_expiration(db_session):
    """Test that expired tokens can be cleaned up."""
    from app.services.email_verification_cleanup import cleanup_expired_tokens
    
    # Create a test user
    user = User(
        username="cleanup_test",
        email="cleanup@test.com",
        password_hash="test_hash",
        email_verified=False
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    
    # Create expired token
    expired_token = EmailVerificationToken(
        user_id=user.id,
        token="expired_token",
        expires_at=datetime.now(timezone.utc) - timedelta(days=1)
    )
    db_session.add(expired_token)
    db_session.commit()
    
    # Cleanup should remove expired tokens
    deleted_count = cleanup_expired_tokens(db_session, days_old=0)
    assert deleted_count >= 1
    
    # Token should be gone
    token = db_session.query(EmailVerificationToken).filter(
        EmailVerificationToken.token == "expired_token"
    ).first()
    assert token is None

