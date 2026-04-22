import pytest
from app.routers.dives.dives_import import protect_csv_formula, sanitize_csv_cell

def test_protect_csv_formula():
    assert protect_csv_formula("=SUM(1,2)") == "'=SUM(1,2)"
    assert protect_csv_formula("+123") == "'+123"
    assert protect_csv_formula("-456") == "'-456"
    assert protect_csv_formula("@something") == "'@something"
    assert protect_csv_formula("Regular text") == "Regular text"
    assert protect_csv_formula("") == ""
    assert protect_csv_formula(None) is None

def test_sanitize_csv_cell():
    # XSS prevention
    assert sanitize_csv_cell("<script>alert(1)</script>Hello") == "Hello"
    # Formula protection
    assert sanitize_csv_cell("=1+1") == "'=1+1"
    # Normal value
    assert sanitize_csv_cell("Normal value") == "Normal value"
    assert sanitize_csv_cell("") == ""
    assert sanitize_csv_cell(None) is None
