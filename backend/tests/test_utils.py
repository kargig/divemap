import types
from fastapi import Request

from app.utils import (
    get_client_ip,
    get_client_ip_with_headers,
    is_localhost_ip,
    is_private_ip,
    format_ip_for_logging,
    classify_match_type,
    calculate_unified_phrase_aware_score,
)


class DummyClient:
    def __init__(self, host=None, port=None):
        self.host = host
        self.port = port


class DummyRequest:
    def __init__(self, headers=None, client_host=None, client_port=None, method="GET", url="http://test/"):
        self.headers = headers or {}
        self.client = DummyClient(client_host, client_port) if client_host or client_port else None
        self.method = method
        # Starlette's Request.url is usually a URL object; for tests we can use str
        self.url = types.SimpleNamespace(__str__=lambda self: url)


def test_get_client_ip_prefers_fly_header():
    req = DummyRequest(headers={"Fly-Client-IP": "203.0.113.5", "X-Forwarded-For": "1.2.3.4, 5.6.7.8"})
    assert get_client_ip(req) == "203.0.113.5"


def test_get_client_ip_uses_x_forwarded_for_first_ip():
    req = DummyRequest(headers={"X-Forwarded-For": "198.51.100.9, 203.0.113.7"})
    assert get_client_ip(req) == "198.51.100.9"


def test_get_client_ip_falls_back_to_client_host():
    req = DummyRequest(headers={}, client_host="10.0.0.9", client_port=1234)
    assert get_client_ip(req) == "10.0.0.9"


def test_get_client_ip_with_headers_collects_expected():
    req = DummyRequest(headers={
        "X-Real-IP": "203.0.113.10",
        "X-Forwarded-For": "203.0.113.10, 198.51.100.2",
        "CF-Connecting-IP": "203.0.113.11",
        "True-Client-IP": "203.0.113.12",
        "X-Client-IP": "203.0.113.13",
        "X-Forwarded-Proto": "https",
        "X-Forwarded-Host": "example.com",
    }, client_host="127.0.0.1")
    info = get_client_ip_with_headers(req)
    # X-Real-IP takes precedence in our dummy since it appears before X-Forwarded-For in code
    assert info["client_ip"] in {"203.0.113.10", "203.0.113.11"}
    assert "X-Real-IP" in info["headers"]
    assert info["connection"]["client_host"] == "127.0.0.1"
    assert info["method"] == "GET"


def test_is_localhost_ip_variants():
    assert is_localhost_ip("127.0.0.1")
    assert is_localhost_ip("::1")
    assert is_localhost_ip("localhost")
    assert is_localhost_ip("0.0.0.0")
    assert is_localhost_ip("::")
    assert not is_localhost_ip("203.0.113.1")


def test_is_private_ip_ipv4_and_ipv6():
    assert is_private_ip("10.1.2.3")
    assert is_private_ip("192.168.1.2")
    assert is_private_ip("172.16.0.5")
    assert is_private_ip("fc00:abcd::1")
    assert is_private_ip("fd00:abcd::1")
    assert is_private_ip("fe80::1")
    assert is_private_ip("fdaa::1")
    assert not is_private_ip("203.0.113.10")
    assert not is_private_ip("-")


def test_format_ip_for_logging_masks_private_ipv4():
    assert format_ip_for_logging("10.1.2.3") == "10.1.*.*"
    assert format_ip_for_logging("10.1.2.3", include_private=True) == "10.1.2.3"
    assert format_ip_for_logging("127.0.0.1") == "localhost"
    assert format_ip_for_logging("-") == "unknown"


def test_classify_match_type_thresholds():
    assert classify_match_type(0.95) == "exact_phrase"
    assert classify_match_type(0.75) == "exact_words"
    assert classify_match_type(0.55) == "partial_words"
    assert classify_match_type(0.35) == "similar"
    assert classify_match_type(0.15) == "fuzzy"


def test_calculate_unified_phrase_aware_score_basic_paths():
    # Exact in name
    s1 = calculate_unified_phrase_aware_score("Blue Hole", "Amazing Blue Hole")
    assert s1 >= 1.0 or s1 > 0.9
    # Word-by-word and geographic bonuses
    s2 = calculate_unified_phrase_aware_score("anavissos", "Anavissos Reef", country="Greece", region="Attica", city="Anavissos")
    assert s2 > 0.3
    # Tag bonus
    s3 = calculate_unified_phrase_aware_score("wreck", "Random Site", tags=["Wreck", "Cave"])
    assert s3 > 0.2
    # Description bonus
    s4 = calculate_unified_phrase_aware_score("shark", "Random Site", description="Shark sightings common")
    assert s4 > 0.1


