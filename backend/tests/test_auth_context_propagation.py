from types import SimpleNamespace

import pytest
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import (
    get_current_user,
    get_password_hash,
    verify_pat,
    verify_pat_record,
)
from app.main import app
from app.models import PersonalAccessToken, User


# Test endpoint to inspect request.state directly through the FastAPI dependency stack
@app.get("/api/v1/test-auth-propagation")
def _test_auth_propagation_endpoint(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    return {
        "username": current_user.username,
        "auth_method": getattr(request.state, "auth_method", None),
        "pat_id": getattr(request.state, "pat_id", None),
        "pat_name": getattr(request.state, "pat_name", None),
    }


def test_jwt_auth_populates_request_state(client, auth_headers):
    # Calling an authenticated endpoint records auth_method = 'jwt'
    response = client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200

    # Verify directly via the test endpoint
    response = client.get("/api/v1/test-auth-propagation", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["auth_method"] == "jwt"
    assert data["pat_id"] is None
    assert data["pat_name"] is None


def test_pat_auth_populates_request_state(client, db_session, test_user):
    raw_token = "dm_pat_testtoken1234567890abcdef"
    pat = PersonalAccessToken(
        user_id=test_user.id,
        name="Automation Bot",
        token_prefix="testtoken123",
        token_hash=get_password_hash(raw_token),
        is_active=True,
    )
    db_session.add(pat)
    db_session.commit()

    headers = {"Authorization": f"Bearer {raw_token}"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200

    # Verify directly via the test endpoint
    response = client.get("/api/v1/test-auth-propagation", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["auth_method"] == "pat"
    assert data["pat_id"] == pat.id
    assert data["pat_name"] == "Automation Bot"


def test_verify_pat_record_and_delegation(db_session, test_user):
    raw_token = "dm_pat_delegatetest1234567890abcdef"
    pat = PersonalAccessToken(
        user_id=test_user.id,
        name="Delegation Bot",
        token_prefix="delegatetest"[:12],
        token_hash=get_password_hash(raw_token),
        is_active=True,
    )
    db_session.add(pat)
    db_session.commit()

    # verify_pat_record returns PersonalAccessToken
    record = verify_pat_record(raw_token, db_session)
    assert record is not None
    assert record.id == pat.id
    assert record.name == "Delegation Bot"

    # verify_pat delegates to verify_pat_record and returns User
    user = verify_pat(raw_token, db_session)
    assert user is not None
    assert user.id == test_user.id

    # Non-pat token returns None
    assert verify_pat_record("not_a_pat_token", db_session) is None
    assert verify_pat("not_a_pat_token", db_session) is None


@pytest.mark.asyncio
async def test_get_current_user_without_request_state(
    db_session, test_user, user_token
):
    # Test that objects without a state attribute do not crash get_current_user
    mock_request = object()
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=user_token)
    user = await get_current_user(mock_request, creds, db_session)
    assert user.id == test_user.id


@pytest.mark.asyncio
async def test_get_current_user_with_request_state(db_session, test_user, user_token):
    mock_request = SimpleNamespace(state=SimpleNamespace())
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=user_token)
    user = await get_current_user(mock_request, creds, db_session)
    assert user.id == test_user.id
    assert mock_request.state.auth_method == "jwt"
    assert mock_request.state.pat_id is None
    assert mock_request.state.pat_name is None


@pytest.mark.asyncio
async def test_get_current_user_optional_sets_guest_and_pat(db_session, test_user):
    from app.auth import get_current_user_optional

    guest_request = SimpleNamespace(state=SimpleNamespace())
    guest = await get_current_user_optional(guest_request, None, db_session)
    assert guest is None
    assert guest_request.state.auth_method == "guest"

    raw_token = "dm_pat_optionalpat1234567890abcdef"
    pat = PersonalAccessToken(
        user_id=test_user.id,
        name="Optional PAT",
        token_prefix="optionalpat1",
        token_hash=get_password_hash(raw_token),
        is_active=True,
    )
    db_session.add(pat)
    db_session.commit()

    pat_request = SimpleNamespace(state=SimpleNamespace())
    user = await get_current_user_optional(pat_request, raw_token, db_session)
    assert user is not None
    assert user.id == test_user.id
    assert pat_request.state.auth_method == "pat"
    assert pat_request.state.pat_id == pat.id
    assert pat_request.state.pat_name == "Optional PAT"
