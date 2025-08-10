from fastapi import Request
from typing import Optional


def get_client_ip(request: Request) -> str:
    """
    Get the client's real IP address checking headers in order of preference:
    1. Fly-Client-IP (Fly.io specific)
    2. CF-Connecting-IP (Cloudflare)
    3. X-Real-IP (Nginx, Apache)
    4. X-Forwarded-For (Standard proxy header)
    5. True-Client-IP (Akamai, Cloudflare)
    6. X-Client-IP (Custom proxy headers)
    7. request.client.host (Direct connection)
    8. request.remote_addr (Fallback)

    This function handles various proxy and load balancer configurations
    to ensure we get the actual client IP address for security, logging,
    and rate limiting purposes.

    Args:
        request: FastAPI Request object

    Returns:
        str: Client IP address or "-" if unable to determine

    Example:
        client_ip = get_client_ip(request)
        print(f"Request from IP: {client_ip}")
    """
    # Check Fly.io specific header first
    if 'Fly-Client-IP' in request.headers:
        return request.headers['Fly-Client-IP']

    # Check Cloudflare header
    elif 'CF-Connecting-IP' in request.headers:
        return request.headers['CF-Connecting-IP']

    # Check X-Real-IP header (common with Nginx, Apache)
    elif 'X-Real-IP' in request.headers:
        return request.headers['X-Real-IP']

    # Check X-Forwarded-For header (standard proxy header)
    elif 'X-Forwarded-For' in request.headers:
        # Get the first IP from the list (client's original IP)
        # X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2, ...
        # We ALWAYS take only the leftmost IP as the real client IP
        # This prevents IP spoofing and ensures consistent behavior
        forwarded_for = request.headers['X-Forwarded-For']
        # Split by comma and take the first (leftmost) IP
        first_ip = forwarded_for.split(',')[0].strip()
        return first_ip

    # Check True-Client-IP (Akamai, Cloudflare)
    elif 'True-Client-IP' in request.headers:
        return request.headers['True-Client-IP']

    # Check X-Client-IP (custom proxy headers)
    elif 'X-Client-IP' in request.headers:
        return request.headers['X-Client-IP']

    # Check request.client.host (FastAPI's client host)
    elif hasattr(request, 'client') and request.client and request.client.host:
        return request.client.host

    # Fallback to request.remote_addr if available
    elif hasattr(request, 'remote_addr') and request.remote_addr:
        return request.remote_addr

    # If all else fails, return a placeholder
    else:
        return "-"


def get_client_ip_with_headers(request: Request) -> dict:
    """
    Get the client's IP address along with all relevant headers for debugging.
    
    This function is useful for debugging proxy configurations and understanding
    how the client IP is being forwarded through various layers.
    
    Args:
        request: FastAPI Request object
        
    Returns:
        dict: Dictionary containing client IP and relevant headers
        
    Example:
        ip_info = get_client_ip_with_headers(request)
        print(f"Client IP: {ip_info['client_ip']}")
        print(f"Headers: {ip_info['headers']}")
    """
    client_ip = get_client_ip(request)
    
    # Collect relevant headers for debugging
    relevant_headers = {}
    header_names = [
        'Fly-Client-IP',
        'X-Real-IP', 
        'X-Forwarded-For',
        'X-Forwarded-Proto',
        'X-Forwarded-Host',
        'CF-Connecting-IP',  # Cloudflare
        'True-Client-IP',    # Akamai
        'X-Client-IP'        # Custom
    ]
    
    for header_name in header_names:
        if header_name in request.headers:
            relevant_headers[header_name] = request.headers[header_name]
    
    # Add client connection info
    connection_info = {}
    if hasattr(request, 'client') and request.client:
        connection_info['client_host'] = getattr(request.client, 'host', None)
        connection_info['client_port'] = getattr(request.client, 'port', None)
    
    return {
        'client_ip': client_ip,
        'headers': relevant_headers,
        'connection': connection_info,
        'method': request.method,
        'url': str(request.url)
    }


def is_localhost_ip(ip_address: str) -> bool:
    """
    Check if an IP address is a localhost address.
    
    Args:
        ip_address: IP address string to check
        
    Returns:
        bool: True if localhost, False otherwise
        
    Example:
        if is_localhost_ip(client_ip):
            print("Request from localhost")
    """
    localhost_ips = [
        "127.0.0.1",      # IPv4 localhost
        "::1",            # IPv6 localhost
        "localhost",      # Hostname
        "0.0.0.0",       # IPv4 unspecified
        "::",             # IPv6 unspecified
    ]
    
    return ip_address in localhost_ips


def is_private_ip(ip_address: str) -> bool:
    """
    Check if an IP address is in a private network range.
    
    Args:
        ip_address: IP address string to check
        
    Returns:
        bool: True if private IP, False otherwise
        
    Example:
        if is_private_ip(client_ip):
            print("Request from private network")
    """
    # Simple check for common private IP ranges
    # This is a basic implementation - for production use,
    # consider using ipaddress module for more robust checking
    
    if ip_address == "-" or not ip_address:
        return False
    
    # IPv4 private ranges
    if ip_address.startswith(("10.", "192.168.", "172.")):
        return True
    
    # IPv6 private ranges (simplified)
    if ip_address.startswith(("fc00:", "fd00:", "fe80:")):
        return True
    
    return False


def format_ip_for_logging(client_ip: str, include_private: bool = False) -> str:
    """
    Format IP address for logging, optionally masking private IPs.
    
    Args:
        client_ip: Client IP address
        include_private: Whether to include private IPs in full
        
    Returns:
        str: Formatted IP address for logging
        
    Example:
        log_ip = format_ip_for_logging(client_ip, include_private=False)
        logger.info(f"Request from {log_ip}")
    """
    if not client_ip or client_ip == "-":
        return "unknown"
    
    if is_localhost_ip(client_ip):
        return "localhost"
    
    if is_private_ip(client_ip) and not include_private:
        # Mask private IPs for privacy in logs
        if "." in client_ip:  # IPv4
            parts = client_ip.split(".")
            return f"{parts[0]}.{parts[1]}.*.*"
        else:  # IPv6
            return "private-ipv6"
    
    return client_ip 