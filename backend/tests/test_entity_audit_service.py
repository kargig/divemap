from types import SimpleNamespace

from app.models import EntityAuditLog
from app.services.entity_audit_service import (
    _infer_client_type,
    _sanitize_dict,
    log_entity_mutation,
)


def test_sanitize_dict_redaction():
    payload = {
        "name": "Secret Spot",
        "password": "my_password",
        "api_key": "secret_key_123",
        "token_hash": "abc123hash",
        "access_token": "jwt-raw-token",
        "refresh_token": "refresh-raw",
        "nested": {"smtp_password": "supersecret", "normal": "value"},
        "key": "smtp_password",
        "value": "literal-secret-value",
    }
    sanitized = _sanitize_dict(payload)
    assert sanitized["name"] == "Secret Spot"
    assert sanitized["password"] == "[REDACTED]"
    assert sanitized["api_key"] == "[REDACTED]"
    assert sanitized["token_hash"] == "[REDACTED]"
    assert sanitized["access_token"] == "[REDACTED]"
    assert sanitized["refresh_token"] == "[REDACTED]"
    assert sanitized["nested"]["smtp_password"] == "[REDACTED]"
    assert sanitized["nested"]["normal"] == "value"
    assert sanitized["value"] == "[REDACTED]"


def test_infer_client_type():
    assert _infer_client_type(None, "jwt") == "system"

    # Android app via user-agent
    req_android = SimpleNamespace(
        headers={"user-agent": "DivemapApp/1.0.0 Android"}, client=None
    )
    assert _infer_client_type(req_android, "jwt") == "android_app"

    # Android TWA via X-Requested-With
    req_twa = SimpleNamespace(
        headers={"x-requested-with": "com.divemap.twa"}, client=None
    )
    assert _infer_client_type(req_twa, "jwt") == "android_app"

    # PAT auth defaults to api_client
    req_pat = SimpleNamespace(headers={"user-agent": "Mozilla/5.0"}, client=None)
    assert _infer_client_type(req_pat, "pat") == "api_client"

    # Python / curl indicator
    req_curl = SimpleNamespace(headers={"user-agent": "curl/7.88.1"}, client=None)
    assert _infer_client_type(req_curl, "jwt") == "api_client"

    # Browser
    req_browser = SimpleNamespace(
        headers={
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        client=None,
    )
    assert _infer_client_type(req_browser, "jwt") == "web"


def test_log_entity_create(db_session, test_user):
    after = {
        "name": "Pytheas",
        "latitude": None,
        "longitude": None,
        "password": "secret",
    }
    log = log_entity_mutation(
        db=db_session,
        entity_type="dive_site",
        entity_id=485,
        action="create",
        user=test_user,
        after_state=after,
    )
    db_session.commit()
    db_session.refresh(log)

    assert log.action == "create"
    assert log.entity_type == "dive_site"
    assert log.entity_id == "485"
    assert log.user_id == test_user.id
    assert log.auth_method == "jwt"
    assert log.changes["snapshot"]["name"] == "Pytheas"
    assert log.changes["snapshot"]["password"] == "[REDACTED]"


def test_log_entity_update_diff(db_session, test_user):
    from app.auth import get_password_hash
    from app.models import PersonalAccessToken

    pat = PersonalAccessToken(
        user_id=test_user.id,
        name="CLI Bot",
        token_prefix="clibotprefix",
        token_hash=get_password_hash("dm_pat_clibotprefix12345"),
        is_active=True,
    )
    db_session.add(pat)
    db_session.commit()

    before = {"name": "Old Name", "max_depth": 20.0, "description": "Same"}
    after = {"name": "New Name", "max_depth": 25.0, "description": "Same"}

    mock_request = SimpleNamespace(
        state=SimpleNamespace(auth_method="pat", pat_id=pat.id, pat_name=pat.name),
        headers={"user-agent": "python-requests/2.31.0"},
        client=SimpleNamespace(host="192.168.1.50"),
    )

    log = log_entity_mutation(
        db=db_session,
        entity_type="dive_site",
        entity_id=485,
        action="update",
        user=test_user,
        request=mock_request,
        before_state=before,
        after_state=after,
    )
    db_session.commit()
    db_session.refresh(log)

    assert log.action == "update"
    assert log.auth_method == "pat"
    assert log.pat_id == pat.id
    assert log.pat_name == "CLI Bot"
    assert log.client_type == "api_client"
    assert log.ip_address == "192.168.1.50"
    assert log.changes["changed_fields"] == ["max_depth", "name"]
    assert log.changes["before"] == {"name": "Old Name", "max_depth": 20.0}
    assert log.changes["after"] == {"name": "New Name", "max_depth": 25.0}


def test_log_entity_update_diff_decimal_vs_float(db_session, test_user):
    from decimal import Decimal

    before = {
        "access_instructions": "by boat",
        "latitude": Decimal("37.59504999"),
        "longitude": Decimal("25.06810660"),
        "shore_direction": Decimal("197.09"),
    }
    after = {
        "access_instructions": "by boat or not",
        "latitude": 37.59504999,
        "longitude": 25.06810660,
        "shore_direction": 197.09,
    }

    log = log_entity_mutation(
        db=db_session,
        entity_type="dive_site",
        entity_id=184,
        action="update",
        before_state=before,
        after_state=after,
        user=test_user,
    )
    db_session.commit()
    db_session.refresh(log)

    # Only access_instructions changed, not the Decimal/float identical coordinates
    assert log.changes["changed_fields"] == ["access_instructions"]
    assert log.changes["before"] == {"access_instructions": "by boat"}
    assert log.changes["after"] == {"access_instructions": "by boat or not"}


def test_log_entity_delete_snapshot(db_session, test_user):
    before = {"name": "Deleted Dive", "max_depth": 18.0}
    log = log_entity_mutation(
        db=db_session,
        entity_type="dive",
        entity_id=202,
        action="delete",
        user=test_user,
        before_state=before,
    )
    db_session.commit()
    db_session.refresh(log)

    assert log.action == "delete"
    assert log.entity_type == "dive"
    assert log.changes["snapshot"] == {"name": "Deleted Dive", "max_depth": 18.0}


def test_log_entity_update_diff_secret_rotation(db_session, test_user):
    # Verifies that rotating a secret flags the field in changed_fields even when values are redacted
    before = {"api_key": "old_secret_111", "normal": "val"}
    after = {"api_key": "new_secret_222", "normal": "val"}

    log = log_entity_mutation(
        db=db_session,
        entity_type="setting",
        entity_id=99,
        action="update",
        user=test_user,
        before_state=before,
        after_state=after,
    )
    db_session.commit()
    db_session.refresh(log)

    assert log.changes["changed_fields"] == ["api_key"]
    assert log.changes["before"]["api_key"] == "[REDACTED]"
    assert log.changes["after"]["api_key"] == "[REDACTED]"


def test_log_entity_system_fallback(db_session):
    # System action with no user and no request
    log = log_entity_mutation(
        db=db_session,
        entity_type="setting",
        entity_id=1,
        action="update",
        user=None,
        request=None,
        before_state={"val": "old"},
        after_state={"val": "new"},
    )
    db_session.commit()
    db_session.refresh(log)

    assert log.auth_method == "system"
    assert log.user_id is None
    assert log.client_type == "system"
    assert log.changes["changed_fields"] == ["val"]
