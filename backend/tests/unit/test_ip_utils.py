import pytest
from app.utils import is_private_ip, get_client_ip
from unittest.mock import Mock

class TestIPUtils:
    """Test suite for IP address utility functions."""

    @pytest.mark.parametrize("ip,expected", [
        # IPv4 Private Ranges
        ("127.0.0.1", True),          # Loopback
        ("10.0.0.1", True),           # Class A Private
        ("192.168.1.1", True),        # Class C Private
        ("172.16.0.1", True),         # Class B Private (Start)
        ("172.31.255.255", True),     # Class B Private (End)
        ("169.254.0.1", True),        # Link-local
        
        # IPv4 Public IPs (that look similar to private)
        ("172.32.0.1", False),        # Outside Class B Private
        ("11.0.0.1", False),          # Outside Class A Private
        ("192.169.1.1", False),       # Outside Class C Private
        ("8.8.8.8", False),           # Google DNS
        ("1.1.1.1", False),           # Cloudflare DNS
        
        # IPv6 Private Ranges
        ("::1", True),                # Loopback
        ("fc00::1", True),            # ULA (Start)
        ("fd00::1", True),            # ULA (Typical)
        ("fdaa:23:bf61:a7b::2", True), # Fly.io Internal (ULA)
        ("fe80::1", True),            # Link-local
        
        # IPv6 Public IPs
        ("2001:4860:4860::8888", False), # Google DNS
        ("2606:4700:4700::1111", False), # Cloudflare DNS
        ("2a02:586:4b52:aa00::1", False), # ISP Public IP
        
        # Edge Cases
        ("", False),
        ("-", False),
        (None, False),
        ("invalid-ip", False),
        ("127.0.0.1:8000", True),     # IPv4 with port
        ("[::1]:8000", True),         # IPv6 with port
    ])
    def test_is_private_ip(self, ip, expected):
        """Test is_private_ip correctly identifies private and public IPs."""
        assert is_private_ip(ip) is expected

    def test_get_client_ip_priority(self):
        """Test get_client_ip header priority logic."""
        # 1. Fly-Client-IP priority
        req = Mock()
        req.headers = {
            "Fly-Client-IP": "1.1.1.1",
            "X-Forwarded-For": "2.2.2.2"
        }
        assert get_client_ip(req) == "1.1.1.1"

    def test_get_client_ip_x_forwarded_for_parsing(self):
        """Test parsing of X-Forwarded-For chain to find the correct public IP."""
        req = Mock()
        
        # Scenario 1: Spoofing Attempt (Attacker -> Real Client -> Proxy -> Internal)
        # Attacker sends XFF: "6.6.6.6" (Spoofed Public IP)
        # Real Client IP is 1.2.3.4 (Public)
        # Proxy adds Real Client IP to XFF -> "6.6.6.6, 1.2.3.4"
        # Internal adds Proxy IP -> "6.6.6.6, 1.2.3.4, 10.0.0.1"
        # We should iterate RIGHT to LEFT.
        # 1. 10.0.0.1 (Private) -> Skip
        # 2. 1.2.3.4 (Public) -> Return!
        # 3. 6.6.6.6 (Ignored)
        req.headers = {"X-Forwarded-For": "6.6.6.6, 1.2.3.4, 10.0.0.1"}
        assert get_client_ip(req) == "1.2.3.4"
        
        # Scenario 2: Fly.io Internal Routing (Internal -> Public Client)
        # XFF: fdaa..., 2a02...
        # Right to left:
        # 1. 2a02... (Public) -> Return
        req.headers = {"X-Forwarded-For": "fdaa:23:bf61::2, 2a02:586::1"}
        assert get_client_ip(req) == "2a02:586::1"
        
        # Scenario 3: Standard proxy chain (Client -> Proxy -> Internal)
        # XFF: 1.2.3.4, 10.0.0.1
        # Right to left:
        # 1. 10.0.0.1 (Private) -> Skip
        # 2. 1.2.3.4 (Public) -> Return
        req.headers = {"X-Forwarded-For": "1.2.3.4, 10.0.0.1"}
        assert get_client_ip(req) == "1.2.3.4"
        
        # Scenario 4: Only Private IPs (Internal traffic)
        # Should fallback to the first IP
        req.headers = {"X-Forwarded-For": "10.0.0.1, 192.168.1.1"}
        assert get_client_ip(req) == "10.0.0.1"

    def test_get_client_ip_fallbacks(self):
        """Test fallbacks when headers are missing."""
        req = Mock()
        req.headers = {}
        
        # Fallback to client.host
        req.client.host = "127.0.0.1"
        assert get_client_ip(req) == "127.0.0.1"
        
        # Fallback to "-"
        req.client = None
        req.remote_addr = None  # Explicitly set to None to avoid Mock creating a child mock
        assert get_client_ip(req) == "-"
