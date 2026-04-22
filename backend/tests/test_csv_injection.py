import pytest
from app.routers.dives.dives_import import sanitize_csv_cell

def test_formula_injection_protection():
    # Test common injection prefixes
    assert sanitize_csv_cell("=1+1") == "'=1+1"
    assert sanitize_csv_cell("+SUM(A1:A10)") == "'+SUM(A1:A10)"
    assert sanitize_csv_cell("-42") == "'-42"
    assert sanitize_csv_cell("@something") == "'@something"
    
    # Test that normal values are NOT escaped
    assert sanitize_csv_cell("Normal value") == "Normal value"
    assert sanitize_csv_cell("123") == "123"
    assert sanitize_csv_cell("Text with = in middle") == "Text with = in middle"
