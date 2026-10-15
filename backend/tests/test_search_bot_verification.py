"""Tests for search-bot CIDR allowlist + reverse-DNS verification."""

import ipaddress
import json
from concurrent.futures import Future
from unittest.mock import MagicMock, patch

import pytest

from app.search_bot_verification import (
    VerifyResult,
    clear_search_bot_caches,
    ip_in_search_bot_allowlist,
    is_verified_search_bot,
    looks_like_search_bot,
    parse_ip_range_payload,
    refresh_search_bot_ip_ranges,
    set_search_bot_ip_ranges_for_tests,
    verify_search_bot_ip,
)


@pytest.fixture(autouse=True)
def _reset_caches():
    clear_search_bot_caches()
    yield
    clear_search_bot_caches()


def test_looks_like_search_bot_ua_gate():
    assert looks_like_search_bot("Mozilla/5.0 (compatible; Googlebot/2.1)")
    assert looks_like_search_bot("Mozilla/5.0 (compatible; bingbot/2.0)")
    assert looks_like_search_bot("AdsBot-Google (+http://www.google.com/adsbot.html)")
    assert not looks_like_search_bot("Mozilla/5.0 (Windows NT 10.0; rv:109.0)")
    assert not looks_like_search_bot(None)
    assert not looks_like_search_bot("")


def test_parse_ip_range_payload():
    payload = {
        "creationTime": "2024-01-01T00:00:00",
        "prefixes": [
            {"ipv4Prefix": "66.249.64.0/19"},
            {"ipv6Prefix": "2001:4860:4801::/48"},
            {"ipv4Prefix": "not-a-cidr"},
            {},
        ],
    }
    nets = parse_ip_range_payload(payload)
    assert len(nets) == 2
    assert ipaddress.ip_address("66.249.66.1") in nets[0]


def test_ip_in_allowlist_naive_list():
    set_search_bot_ip_ranges_for_tests([
        ipaddress.ip_network("66.249.64.0/19"),
        ipaddress.ip_network("157.55.39.0/24"),
    ])
    assert ip_in_search_bot_allowlist("66.249.66.1") is True
    assert ip_in_search_bot_allowlist("157.55.39.10") is True
    assert ip_in_search_bot_allowlist("203.0.113.1") is False
    assert ip_in_search_bot_allowlist("not-an-ip") is False


def test_hot_path_cidr_hit_skips_without_dns():
    set_search_bot_ip_ranges_for_tests([ipaddress.ip_network("66.249.64.0/19")])

    with patch("app.search_bot_verification.schedule_search_bot_ip_range_refresh"):
        with patch("app.search_bot_verification._schedule_verify") as schedule_dns:
            assert is_verified_search_bot(
                "66.249.66.1",
                "Mozilla/5.0 (compatible; Googlebot/2.1)",
            ) is True
            schedule_dns.assert_not_called()


def test_hot_path_non_bot_ua_never_schedules_dns():
    with patch("app.search_bot_verification.schedule_search_bot_ip_range_refresh") as refresh:
        with patch("app.search_bot_verification._schedule_verify") as schedule:
            assert is_verified_search_bot("66.249.66.1", "Mozilla/5.0") is False
            schedule.assert_not_called()
            refresh.assert_not_called()


def test_hot_path_cache_miss_fails_open_and_schedules():
    with patch("app.search_bot_verification.schedule_search_bot_ip_range_refresh"):
        with patch("app.search_bot_verification._schedule_verify") as schedule:
            assert is_verified_search_bot(
                "66.249.66.1",
                "Mozilla/5.0 (compatible; Googlebot/2.1)",
            ) is False
            schedule.assert_called_once_with("66.249.66.1")


def test_hot_path_positive_cache_skips_without_dns():
    from app import search_bot_verification as mod

    with mod._cache_lock:
        mod._positive_cache["66.249.66.1"] = True

    with patch("app.search_bot_verification.schedule_search_bot_ip_range_refresh"):
        with patch("app.search_bot_verification._schedule_verify") as schedule:
            with patch("app.search_bot_verification.verify_search_bot_ip") as verify:
                assert is_verified_search_bot(
                    "66.249.66.1",
                    "Mozilla/5.0 (compatible; Googlebot/2.1)",
                ) is True
                schedule.assert_not_called()
                verify.assert_not_called()


def test_hot_path_negative_cache_fails_open_without_reschedule():
    from app import search_bot_verification as mod

    with mod._cache_lock:
        mod._negative_cache["203.0.113.10"] = False

    with patch("app.search_bot_verification.schedule_search_bot_ip_range_refresh"):
        with patch("app.search_bot_verification._schedule_verify") as schedule:
            assert is_verified_search_bot(
                "203.0.113.10",
                "Mozilla/5.0 (compatible; Googlebot/2.1)",
            ) is False
            schedule.assert_not_called()


def test_cidr_hit_overrides_negative_dns_cache():
    """Published CIDR list is authoritative over a stale DNS NOT_BOT cache."""
    from app import search_bot_verification as mod

    with mod._cache_lock:
        mod._negative_cache["66.249.66.1"] = False
    set_search_bot_ip_ranges_for_tests([ipaddress.ip_network("66.249.64.0/19")])

    with patch("app.search_bot_verification.schedule_search_bot_ip_range_refresh"):
        assert is_verified_search_bot(
            "66.249.66.1",
            "Mozilla/5.0 (compatible; Googlebot/2.1)",
        ) is True


def test_refresh_merges_feeds_and_keeps_previous_on_total_failure():
    set_search_bot_ip_ranges_for_tests([ipaddress.ip_network("10.0.0.0/8")])

    good = json.dumps({
        "prefixes": [{"ipv4Prefix": "66.249.64.0/19"}],
    }).encode()

    def fake_urlopen(request, timeout=None):
        url = request.full_url if hasattr(request, "full_url") else request
        if "common-crawlers" in str(url):
            cm = MagicMock()
            cm.read.return_value = good
            cm.__enter__.return_value = cm
            cm.__exit__.return_value = False
            return cm
        raise OSError("boom")

    with patch("urllib.request.urlopen", side_effect=fake_urlopen):
        count = refresh_search_bot_ip_ranges()

    assert count >= 1
    assert ip_in_search_bot_allowlist("66.249.66.1") is True
    assert ip_in_search_bot_allowlist("10.1.2.3") is False

    with patch("urllib.request.urlopen", side_effect=OSError("offline")):
        assert refresh_search_bot_ip_ranges() == 0
    # Previous successful list retained
    assert ip_in_search_bot_allowlist("66.249.66.1") is True


def test_verify_googlebot_success():
    with patch("socket.gethostbyaddr", return_value=("crawl-66-249-66-1.googlebot.com", [], ["66.249.66.1"])):
        with patch(
            "socket.getaddrinfo",
            return_value=[(None, None, None, None, ("66.249.66.1", 0))],
        ):
            assert verify_search_bot_ip("66.249.66.1") is VerifyResult.VERIFIED


def test_verify_bingbot_success():
    with patch("socket.gethostbyaddr", return_value=("msnbot-207-46-13-1.search.msn.com", [], ["207.46.13.1"])):
        with patch(
            "socket.getaddrinfo",
            return_value=[(None, None, None, None, ("207.46.13.1", 0))],
        ):
            assert verify_search_bot_ip("207.46.13.1") is VerifyResult.VERIFIED


def test_verify_google_geo_and_usercontent_hostnames():
    cases = (
        (
            "35.247.243.240",
            "geo-crawl-35-247-243-240.geo.googlebot.com",
        ),
        (
            "66.249.90.77",
            "rate-limited-proxy-66-249-90-77.google.com",
        ),
        (
            "203.0.113.50",
            "1-2-3-4.gae.googleusercontent.com",
        ),
    )
    for ip, hostname in cases:
        with patch("socket.gethostbyaddr", return_value=(hostname, [], [ip])):
            with patch(
                "socket.getaddrinfo",
                return_value=[(None, None, None, None, (ip, 0))],
            ):
                assert verify_search_bot_ip(ip) is VerifyResult.VERIFIED, hostname


def test_verify_spoofed_hostname_not_bot():
    with patch("socket.gethostbyaddr", return_value=("evil.example.com", [], ["203.0.113.1"])):
        assert verify_search_bot_ip("203.0.113.1") is VerifyResult.NOT_BOT


def test_verify_forward_mismatch_not_bot():
    with patch("socket.gethostbyaddr", return_value=("crawl.googlebot.com", [], ["66.249.66.1"])):
        with patch(
            "socket.getaddrinfo",
            return_value=[(None, None, None, None, ("198.51.100.1", 0))],
        ):
            assert verify_search_bot_ip("66.249.66.1") is VerifyResult.NOT_BOT


def test_verify_dns_failure_is_error_fail_open():
    import socket

    with patch("socket.gethostbyaddr", side_effect=socket.herror("not found")):
        assert verify_search_bot_ip("66.249.66.1") is VerifyResult.ERROR


def test_background_verify_caches_positive():
    from app import search_bot_verification as mod

    with patch(
        "app.search_bot_verification.verify_search_bot_ip",
        return_value=VerifyResult.VERIFIED,
    ):
        mod._background_verify("66.249.66.1")

    with patch("app.search_bot_verification.schedule_search_bot_ip_range_refresh"):
        assert is_verified_search_bot(
            "66.249.66.1",
            "Mozilla/5.0 (compatible; Googlebot/2.1)",
        ) is True


def test_schedule_verify_does_not_block_hot_path():
    """Submit returns a Future; hot path must not wait on it."""
    stalled = Future()

    mock_executor = MagicMock()
    mock_executor.submit.return_value = stalled

    with patch("app.search_bot_verification.schedule_search_bot_ip_range_refresh"):
        with patch("app.search_bot_verification._executor", mock_executor):
            assert is_verified_search_bot(
                "66.249.66.99",
                "Mozilla/5.0 (compatible; Googlebot/2.1)",
            ) is False
            mock_executor.submit.assert_called_once()
            assert not stalled.done()


def test_schedule_verify_respects_in_flight_cap():
    from app import search_bot_verification as mod

    mock_executor = MagicMock()
    with mod._in_flight_lock:
        for i in range(mod._MAX_IN_FLIGHT):
            mod._in_flight.add(f"198.51.100.{i}")

    with patch("app.search_bot_verification.schedule_search_bot_ip_range_refresh"):
        with patch("app.search_bot_verification._executor", mock_executor):
            assert is_verified_search_bot(
                "198.51.100.254",
                "Mozilla/5.0 (compatible; Googlebot/2.1)",
            ) is False
            # Queue was full, so no new task submitted
            mock_executor.submit.assert_not_called()


def test_custom_key_func_skips_verified_search_bot():
    from unittest.mock import Mock

    from fastapi import Request

    from app.limiter import custom_key_func

    request = Mock(spec=Request)
    request.client = Mock()
    request.client.host = "66.249.66.1"
    request.headers = {"user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)"}
    request.method = "GET"
    request.url = Mock()
    request.url.path = "/api/v1/dive-sites/32"
    request.remote_addr = None

    with patch("app.limiter.get_client_ip", return_value="66.249.66.1"):
        with patch("app.limiter.is_localhost_ip", return_value=False):
            with patch("app.limiter.is_verified_search_bot", return_value=True):
                assert custom_key_func(request) == "searchbot"
