from fastapi.testclient import TestClient

from app.main import app


def test_add_security_headers_applied():
    client = TestClient(app)
    r = client.get("/")
    assert r.status_code == 200
    # Check security headers present
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "DENY"
    assert r.headers["X-XSS-Protection"].startswith("1;")
    assert "Content-Security-Policy" in r.headers
    csp_directives = r.headers["Content-Security-Policy"].split(";")
    script_src = next(
        (d.strip() for d in csp_directives if d.strip().startswith("script-src")), ""
    )
    allowed_script_sources = set(script_src.split())
    assert any(
        source == "https://www.googletagmanager.com"
        for source in allowed_script_sources
    )


def test_enhanced_security_logging_suspicious_chain(monkeypatch):
    client = TestClient(app)
    # Simulate long proxy chain
    headers = {
        "X-Forwarded-For": "10.0.0.1, 203.0.113.1, 203.0.113.2, 203.0.113.3, 203.0.113.4"
    }
    r = client.get("/", headers=headers)
    assert r.status_code == 200
