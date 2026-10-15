"""
Verified search-bot detection for rate-limit exemption.

Hot path never blocks on HTTP or DNS:
  1. Bot-like User-Agent gate (spoofable; not proof)
  2. In-memory published CIDR allowlist (Google/Bing JSON)
  3. DNS verification result cache
  4. Else fail open (normal rate limiting) and schedule background DNS

JSON allowlists refresh in the background (startup + lazy when stale).
No cron required.

Official verification references:

  Google DNS method — reverse DNS, hostname under googlebot.com /
  google.com / googleusercontent.com, then forward confirm:
    https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests
  Google published crawler IP ranges (JSON / CIDR):
    https://developers.google.com/static/crawling/ipranges/common-crawlers.json
    https://developers.google.com/static/crawling/ipranges/special-crawlers.json
  Common crawler docs:
    https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers
  Historical DNS write-up:
    https://developers.google.com/search/blog/2006/09/how-to-verify-googlebot

  Bing DNS method — hostname ends with search.msn.com, then forward confirm:
    https://www.bing.com/webmasters/help/how-to-verify-bingbot-3905dc26
  Bing published IP ranges (refresh periodically; do not hardcode forever):
    https://www.bing.com/toolbox/bingbot.json
  Public check tool:
    https://www.bing.com/toolbox/verify-bingbot

Not implemented: Google user-triggered fetcher JSON feeds, Bing Verify API.
"""

from __future__ import annotations

import ipaddress
import json
import logging
import socket
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeoutError
from enum import Enum
from typing import List, Optional, Sequence

from cachetools import TTLCache

logger = logging.getLogger(__name__)

# Positive: confirmed Googlebot/Bingbot. Negative: confirmed not a bot.
_POSITIVE_TTL_SECONDS = 24 * 60 * 60
_NEGATIVE_TTL_SECONDS = 60 * 60
# Transient DNS errors: brief so a blip does not stick for an hour.
_ERROR_TTL_SECONDS = 60

_DNS_TIMEOUT_SECONDS = 2.0
_IP_RANGE_FETCH_TIMEOUT_SECONDS = 10.0
_IP_RANGE_REFRESH_SECONDS = 24 * 60 * 60
_MAX_IN_FLIGHT = 256

_IP_RANGE_URLS = (
    "https://developers.google.com/static/crawling/ipranges/common-crawlers.json",
    "https://developers.google.com/static/crawling/ipranges/special-crawlers.json",
    "https://www.bing.com/toolbox/bingbot.json",
)

# Cheap gate only — never treat UA as proof (docs warn it is spoofable).
_UA_TOKENS = (
    "googlebot",
    "bingbot",
    "msnbot",
    "adsbot-google",
    "google-inspectiontool",
    "storebot-google",
)

# Hostname suffixes from Google/Bing verify docs (trailing-dot stripped first).
# Covers crawl-*.googlebot.com, geo-crawl-*.geo.googlebot.com,
# rate-limited-proxy-*.google.com, and *.gae.googleusercontent.com.
_GOOGLE_SUFFIXES = (".googlebot.com", ".google.com", ".googleusercontent.com")
_BING_SUFFIXES = (".search.msn.com",)

IpNetwork = ipaddress.IPv4Network | ipaddress.IPv6Network


class VerifyResult(Enum):
    VERIFIED = "verified"
    NOT_BOT = "not_bot"
    ERROR = "error"


_positive_cache: TTLCache = TTLCache(maxsize=4096, ttl=_POSITIVE_TTL_SECONDS)
_negative_cache: TTLCache = TTLCache(maxsize=4096, ttl=_NEGATIVE_TTL_SECONDS)
_error_cache: TTLCache = TTLCache(maxsize=4096, ttl=_ERROR_TTL_SECONDS)
_cache_lock = threading.Lock()

_in_flight: set[str] = set()
_in_flight_lock = threading.Lock()

_cidr_networks: List[IpNetwork] = []
_cidr_loaded_at: Optional[float] = None
_cidr_lock = threading.Lock()
_cidr_refresh_in_flight = False
_cidr_refresh_lock = threading.Lock()

# Outer pool schedules work off the request path; inner pool lets us abandon
# slow DNS without touching process-global socket timeouts.
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="searchbot-bg")
_dns_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="searchbot-dns-op")


def looks_like_search_bot(user_agent: Optional[str]) -> bool:
    if not user_agent:
        return False
    ua = user_agent.lower()
    return any(token in ua for token in _UA_TOKENS)


def _hostname_matches_search_bot(hostname: str) -> bool:
    host = hostname.lower().rstrip(".")
    return host.endswith(_GOOGLE_SUFFIXES) or host.endswith(_BING_SUFFIXES)


def _cache_get(ip: str) -> Optional[bool]:
    """Return True/False if cached; None on miss. Error cache counts as False."""
    with _cache_lock:
        if ip in _positive_cache:
            return True
        if ip in _negative_cache or ip in _error_cache:
            return False
    return None


def _cache_set(ip: str, result: VerifyResult) -> None:
    with _cache_lock:
        _positive_cache.pop(ip, None)
        _negative_cache.pop(ip, None)
        _error_cache.pop(ip, None)
        if result is VerifyResult.VERIFIED:
            _positive_cache[ip] = True
        elif result is VerifyResult.NOT_BOT:
            _negative_cache[ip] = False
        else:
            _error_cache[ip] = False


def parse_ip_range_payload(data: dict) -> List[IpNetwork]:
    """Parse a Google/Bing ipranges JSON object into ip_network entries."""
    networks: List[IpNetwork] = []
    for prefix in data.get("prefixes", []):
        cidr = prefix.get("ipv4Prefix") or prefix.get("ipv6Prefix")
        if not cidr:
            continue
        try:
            networks.append(ipaddress.ip_network(cidr, strict=False))
        except ValueError:
            logger.debug("Skipping invalid crawler CIDR %r", cidr)
    return networks


def _fetch_ip_range_json(url: str) -> dict:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "DivemapSearchBotVerification/1.0"},
    )
    with urllib.request.urlopen(request, timeout=_IP_RANGE_FETCH_TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def refresh_search_bot_ip_ranges() -> int:
    """
    Fetch published crawler CIDR lists and replace the in-memory allowlist.

    Returns the number of networks loaded. On total failure, leaves the
    previous list intact (fail open to DNS / rate limiting).
    """
    networks: List[IpNetwork] = []
    errors = 0
    for url in _IP_RANGE_URLS:
        try:
            payload = _fetch_ip_range_json(url)
            networks.extend(parse_ip_range_payload(payload))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as exc:
            errors += 1
            logger.warning("Failed to refresh search-bot IP ranges from %s: %s", url, exc)

    if not networks:
        logger.warning(
            "Search-bot IP range refresh produced no networks (%s/%s feeds failed); keeping previous list",
            errors,
            len(_IP_RANGE_URLS),
        )
        return 0

    with _cidr_lock:
        global _cidr_networks, _cidr_loaded_at
        _cidr_networks = networks
        _cidr_loaded_at = time.monotonic()

    logger.info(
        "Loaded %s search-bot CIDR prefixes (%s feeds ok)",
        len(networks),
        len(_IP_RANGE_URLS) - errors,
    )
    return len(networks)


def _ip_ranges_are_stale() -> bool:
    with _cidr_lock:
        if _cidr_loaded_at is None:
            return True
        return (time.monotonic() - _cidr_loaded_at) >= _IP_RANGE_REFRESH_SECONDS


def _background_refresh_ip_ranges() -> None:
    global _cidr_refresh_in_flight
    try:
        refresh_search_bot_ip_ranges()
    except Exception:
        logger.debug("background search-bot IP range refresh failed", exc_info=True)
    finally:
        with _cidr_refresh_lock:
            _cidr_refresh_in_flight = False


def schedule_search_bot_ip_range_refresh(*, force: bool = False) -> None:
    """Schedule a non-blocking IP-range refresh if stale (or force=True)."""
    global _cidr_refresh_in_flight
    if not force and not _ip_ranges_are_stale():
        return
    with _cidr_refresh_lock:
        if _cidr_refresh_in_flight:
            return
        _cidr_refresh_in_flight = True
    try:
        _executor.submit(_background_refresh_ip_ranges)
    except Exception:
        with _cidr_refresh_lock:
            _cidr_refresh_in_flight = False


def start_search_bot_ip_range_refresh() -> None:
    """Fire-and-forget refresh for app startup (does not block lifespan)."""
    schedule_search_bot_ip_range_refresh(force=True)


def ip_in_search_bot_allowlist(ip: str) -> bool:
    """True if IP is in the loaded published CIDR list. False if empty/invalid."""
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    with _cidr_lock:
        networks: Sequence[IpNetwork] = tuple(_cidr_networks)
    for network in networks:
        if addr in network:
            return True
    return False


def set_search_bot_ip_ranges_for_tests(networks: List[IpNetwork]) -> None:
    """Test helper: install an allowlist without HTTP."""
    with _cidr_lock:
        global _cidr_networks, _cidr_loaded_at
        _cidr_networks = list(networks)
        _cidr_loaded_at = time.monotonic() if networks else None


def _verify_search_bot_ip_blocking(ip: str) -> VerifyResult:
    # Google/Bing docs: reverse DNS → check hostname domain → forward confirm.
    try:
        hostname, _, _ = socket.gethostbyaddr(ip)
    except (socket.herror, socket.gaierror, OSError, TimeoutError):
        return VerifyResult.ERROR

    if not _hostname_matches_search_bot(hostname):
        return VerifyResult.NOT_BOT

    try:
        infos = socket.getaddrinfo(hostname, None)
    except (socket.gaierror, OSError, TimeoutError):
        return VerifyResult.ERROR

    resolved = {info[4][0] for info in infos}
    if ip in resolved:
        return VerifyResult.VERIFIED
    return VerifyResult.NOT_BOT


def verify_search_bot_ip(ip: str) -> VerifyResult:
    """
    Reverse DNS + forward confirm per Google/Bing verify docs (see module doc).

    ERROR on resolve failure/timeout (fail open). NOT_BOT when DNS works but
    the host is not a known crawler. VERIFIED only after forward confirm.
    Intended for background use; do not call on the request hot path.
    """
    try:
        future = _dns_executor.submit(_verify_search_bot_ip_blocking, ip)
        return future.result(timeout=_DNS_TIMEOUT_SECONDS)
    except FuturesTimeoutError:
        return VerifyResult.ERROR
    except Exception:
        logger.debug("search bot DNS verify failed for %s", ip, exc_info=True)
        return VerifyResult.ERROR


def _background_verify(ip: str) -> None:
    try:
        result = verify_search_bot_ip(ip)
        _cache_set(ip, result)
        if result is VerifyResult.VERIFIED:
            logger.info("Verified search bot IP %s via DNS", ip)
    except Exception:
        logger.debug("background search bot verify error for %s", ip, exc_info=True)
        _cache_set(ip, VerifyResult.ERROR)
    finally:
        with _in_flight_lock:
            _in_flight.discard(ip)


def _schedule_verify(ip: str) -> None:
    with _in_flight_lock:
        if ip in _in_flight:
            return
        if len(_in_flight) >= _MAX_IN_FLIGHT:
            logger.debug("search bot verify queue full (%s in flight); skipping %s", len(_in_flight), ip)
            return
        _in_flight.add(ip)
    try:
        _executor.submit(_background_verify, ip)
    except Exception:
        with _in_flight_lock:
            _in_flight.discard(ip)


def is_verified_search_bot(ip: str, user_agent: Optional[str]) -> bool:
    """
    Hot-path check: UA gate + CIDR allowlist + DNS cache. Never blocks on I/O.

    Cascade:
      CIDR hit → skip rate limit
      DNS positive cache → skip rate limit
      else → schedule background DNS (and JSON refresh if stale), rate-limit
    """
    if not ip or ip == "-":
        return False
    if not looks_like_search_bot(user_agent):
        return False

    schedule_search_bot_ip_range_refresh()

    if ip_in_search_bot_allowlist(ip):
        return True

    cached = _cache_get(ip)
    if cached is True:
        return True
    if cached is False:
        return False

    _schedule_verify(ip)
    return False


def clear_search_bot_caches() -> None:
    """Test helper: wipe verification caches, in-flight set, and CIDR allowlist."""
    with _cache_lock:
        _positive_cache.clear()
        _negative_cache.clear()
        _error_cache.clear()
    with _in_flight_lock:
        _in_flight.clear()
    with _cidr_lock:
        global _cidr_networks, _cidr_loaded_at
        _cidr_networks = []
        _cidr_loaded_at = None
    with _cidr_refresh_lock:
        global _cidr_refresh_in_flight
        _cidr_refresh_in_flight = False
