#!/usr/bin/env python3
"""
Bulk update shore direction for dive sites using OpenStreetMap coastline data.

This script:
1. Authenticates to the API using username/password from environment variables or CLI args
2. Fetches all dive sites without shore_direction (or specific IDs if provided)
3. For each site, detects shore direction using the API endpoint
4. Updates the dive site with the detected values

Environment Variables:
    DIVEMAP_URL: Base URL of the Divemap API (e.g., http://localhost:8000)
    DIVEMAP_USERNAME: Username for authentication
    DIVEMAP_PASSWORD: Password for authentication

Usage:
    export DIVEMAP_URL="http://localhost:8000"
    export DIVEMAP_USERNAME="admin"
    export DIVEMAP_PASSWORD="password"
    python scripts/bulk_update_shore_direction.py [OPTIONS]

Options:
    --dry-run, -d              Show what would be updated without making changes
    --force, -f                 Skip confirmation prompt
    --ids IDS                   Comma-separated list of dive site IDs to process (e.g., 1,2,3)
    --base-url, -u URL          Base URL for the Divemap API (default: DIVEMAP_URL env var or http://localhost:8000)
    --username, -U USER         Username for authentication (default: DIVEMAP_USERNAME env var)
    --password, -P PASS         Password for authentication (default: DIVEMAP_PASSWORD env var)
    --debug, -D                 Enable debug logging in backend API calls
    --max-retries, -r N         Maximum number of retries for rate-limited requests (default: 3)
    --base-wait-time, -w SEC    Base wait time in seconds for rate limits (default: 120)
    --max-requests-per-minute, -m N  Maximum requests per minute (conservative limit, default: 60)

Rate Limit Handling:
    The script automatically handles rate limits (HTTP 429) from the backend API:
    - Respects Retry-After headers when provided
    - Implements exponential backoff with configurable retry attempts
    - Configurable base wait time for rate limit responses
    - Tracks rate limit encounters and provides summary
    - Proactive fixed window rate limiting (prevents hitting limits)
    - Conservative request counting per minute with configurable limits
    - Optimized for sliding window rate limiting (slowapi 0.1.9)

Examples:
    # Dry run to see what would be updated
    python scripts/bulk_update_shore_direction.py --dry-run

    # Update specific dive sites
    python scripts/bulk_update_shore_direction.py --ids 1,2,3

    # Force update without confirmation
    python scripts/bulk_update_shore_direction.py --force

    # Use custom base URL and credentials
    python scripts/bulk_update_shore_direction.py --base-url https://api.divemap.com --username admin --password pass

    # Handle rate limits with custom retry settings
    python scripts/bulk_update_shore_direction.py --max-retries 5 --base-wait-time 180

    # Conservative rate limiting for high-traffic scenarios
    python scripts/bulk_update_shore_direction.py --max-requests-per-minute 50 --max-retries 5

Note:
    - Requires admin user credentials (update endpoint requires admin)
    - Only processes dive sites without shore_direction that have coordinates (unless --ids is used)
    - Skips sites where no coastline is found nearby
"""

import os
import sys
import time
import datetime
import argparse
import requests
from typing import Optional, Dict, List
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


def get_timestamp():
    """Get current timestamp for logging."""
    return datetime.datetime.now().strftime("%H:%M:%S")


class DivemapAPI:
    """Client for interacting with Divemap API."""

    def __init__(self, base_url: str, username: str, password: str, debug: bool = False,
                 max_retries: int = 3, base_wait_time: int = 120, max_requests_per_minute: int = 60):
        self.base_url = base_url.rstrip('/')
        self.username = username
        self.password = password
        self.debug = debug
        self.access_token: Optional[str] = None
        self.session = requests.Session()

        # Rate limit handling - optimized for SLIDING WINDOW rate limiting (slowapi 0.1.9)
        self.max_retries = max_retries
        self.base_wait_time = base_wait_time
        self.rate_limit_encountered = False
        self.last_rate_limit_time = 0

        # Sliding window rate limiting optimization
        self.requests_this_minute = 0
        self.minute_start_time = int(time.time() / 60) * 60
        self.max_requests_per_minute = max_requests_per_minute
        self.last_request_time = 0
        self.min_request_interval = 1.0

        # Configure retry strategy (but we handle 429 manually)
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[500, 502, 503, 504],  # Removed 429, handle manually
            allowed_methods=["GET", "POST", "PUT"]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

    def _get_headers(self) -> Dict[str, str]:
        """Get headers with authentication token."""
        headers = {"Content-Type": "application/json"}
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        return headers

    def _get_retry_after(self, response: requests.Response) -> float:
        """Extract retry-after time from response headers or use default."""
        try:
            retry_after = response.headers.get('Retry-After')
            if retry_after:
                # Try to parse as seconds
                try:
                    return float(retry_after)
                except ValueError:
                    # If it's a date, calculate seconds until then
                    from email.utils import parsedate_to_datetime
                    retry_date = parsedate_to_datetime(retry_after)
                    now = datetime.datetime.now(datetime.timezone.utc)
                    return max(0, (retry_date - now).total_seconds())
        except Exception:
            pass

        # For sliding window rate limiting (slowapi 0.1.9), we need to wait longer
        # The rolling 60-second window means we need to wait for it to clear
        current_time = time.time()
        time_since_last_rate_limit = current_time - self.last_rate_limit_time

        # If this is our first rate limit or it's been a while, wait 3 minutes
        if self.last_rate_limit_time == 0 or time_since_last_rate_limit > 300:  # 5 minutes
            return 180  # 3 minutes
        else:
            # If we're hitting rate limits repeatedly, wait longer
            return 300  # 5 minutes

    def _check_sliding_window_rate_limit(self) -> float:
        """Check sliding window rate limiting and return wait time if needed."""
        current_time = time.time()
        current_minute = int(current_time / 60) * 60

        # If we're in a new minute, reset the counter
        if current_minute > self.minute_start_time:
            print(f"[{get_timestamp()}] 🕐 New minute detected, resetting request counter from {self.requests_this_minute} to 0")
            self.requests_this_minute = 0
            self.minute_start_time = current_minute

        # Check if we're approaching the limit
        if self.requests_this_minute >= self.max_requests_per_minute:
            # Calculate time until next minute
            time_until_next_minute = 60 - (current_time - current_minute)
            wait_time = max(time_until_next_minute, self.min_request_interval)
            print(f"[{get_timestamp()}] ⏳ Rate limit threshold reached ({self.requests_this_minute}/{self.max_requests_per_minute}). Waiting {wait_time:.1f}s until next minute...")
            return wait_time

        return 0  # No wait needed

    def _increment_request_counter(self):
        """Increment the request counter for the current minute."""
        self.requests_this_minute += 1

    def is_token_valid(self) -> bool:
        """Check if the current authentication token is still valid."""
        if not self.access_token:
            return False

        # Try to make a simple request to test token validity
        try:
            url = f"{self.base_url}/api/v1/dive-sites/"
            response = self.session.get(url, headers=self._get_headers(), params={"page": 1, "page_size": 1}, timeout=10)
            return response.status_code != 401
        except:
            return False

    def ensure_valid_token(self) -> bool:
        """Ensure we have a valid token, refreshing if necessary."""
        if not self.is_token_valid():
            print(f"[{get_timestamp()}] 🔑 Token expired or invalid. Refreshing...")
            return self.login()
        return True

    def login(self) -> bool:
        """Authenticate and get access token."""
        url = f"{self.base_url}/api/v1/auth/login"
        payload = {
            "username": self.username,
            "password": self.password
        }

        try:
            print(f"[{get_timestamp()}] 🔐 Authenticating with {self.base_url}...")
            response = self.session.post(url, json=payload, timeout=10)
            response.raise_for_status()
            data = response.json()
            self.access_token = data.get("access_token")
            if not self.access_token:
                print(f"[{get_timestamp()}] ❌ No access token in response: {data}")
                return False
            # Set authorization header for future requests
            self.session.headers.update({"Authorization": f"Bearer {self.access_token}"})
            print(f"[{get_timestamp()}] ✅ Authentication successful")
            return True
        except requests.exceptions.RequestException as e:
            print(f"[{get_timestamp()}] ❌ Authentication failed: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response: {e.response.text}")
            return False

    def get_dive_sites(self, page_size: int = 100) -> List[Dict]:
        """Get all dive sites using pagination."""
        # Ensure we have a valid token before making requests
        if not self.ensure_valid_token():
            print(f"[{get_timestamp()}] ❌ Cannot proceed without valid authentication")
            return []

        url = f"{self.base_url}/api/v1/dive-sites/"
        all_sites = []
        page = 1

        while True:
            try:
                # Check sliding window rate limiting first
                sliding_window_wait = self._check_sliding_window_rate_limit()
                if sliding_window_wait > 0:
                    time.sleep(sliding_window_wait)

                params = {"page": page, "page_size": page_size}
                response = self.session.get(
                    url,
                    headers=self._get_headers(),
                    params=params,
                    timeout=30
                )

                # Increment request counter for this minute
                self._increment_request_counter()

                # Handle authentication errors (token expired)
                if response.status_code == 401:
                    print(f"[{get_timestamp()}] 🔑 Authentication failed (likely expired token). Attempting to refresh...")
                    if self.login():
                        print(f"[{get_timestamp()}] ✅ Token refreshed successfully. Retrying fetch...")
                        return self.get_dive_sites(page_size)  # Retry with new token
                    else:
                        print(f"[{get_timestamp()}] ❌ Failed to refresh token. Cannot continue.")
                        return []

                # Handle rate limiting
                if response.status_code == 429:
                    self.rate_limit_encountered = True
                    print(f"[{get_timestamp()}] 🚫 RATE LIMIT HIT! Status: 429")
                    retry_after = self._get_retry_after(response)
                    wait_time = max(retry_after, 180)  # Wait at least 3 minutes for sliding window
                    print(f"[{get_timestamp()}] ⏳ Rate limit exceeded. Waiting {wait_time:.1f} seconds for sliding window to clear...")
                    time.sleep(wait_time)
                    self.last_rate_limit_time = time.time()
                    continue  # Retry this page

                response.raise_for_status()
                sites = response.json()

                if not sites:
                    break

                all_sites.extend(sites)
                print(f"  Fetched page {page}: {len(sites)} dive sites (total: {len(all_sites)})")

                # Check if we got fewer than requested (last page)
                if len(sites) < page_size:
                    break

                # Move to next page
                page += 1

            except requests.exceptions.RequestException as e:
                print(f"[{get_timestamp()}] ❌ Failed to fetch dive sites: {e}")
                if hasattr(e, 'response') and e.response is not None:
                    print(f"Response: {e.response.text}")
                break

        return all_sites

    def detect_shore_direction(self, dive_site_id: int, retry_count: int = 0) -> Optional[Dict]:
        """Detect shore direction for a dive site."""
        # Ensure we have a valid token before making requests
        if not self.ensure_valid_token():
            print(f"   [{get_timestamp()}] ❌ Cannot proceed without valid authentication")
            return None

        # Check sliding window rate limiting first
        sliding_window_wait = self._check_sliding_window_rate_limit()
        if sliding_window_wait > 0:
            time.sleep(sliding_window_wait)

        url = f"{self.base_url}/api/v1/dive-sites/{dive_site_id}/detect-shore-direction"

        try:
            response = self.session.post(
                url,
                headers=self._get_headers(),
                timeout=30
            )

            # Increment request counter for this minute
            self._increment_request_counter()

            # Handle authentication errors (token expired)
            if response.status_code == 401:
                print(f"   [{get_timestamp()}] 🔑 Authentication failed (likely expired token). Attempting to refresh...")
                if self.login():
                    print(f"   [{get_timestamp()}] ✅ Token refreshed successfully. Retrying detection...")
                    return self.detect_shore_direction(dive_site_id, retry_count)  # Retry with new token
                else:
                    print(f"   [{get_timestamp()}] ❌ Failed to refresh token. Cannot continue.")
                    return None

            # Handle rate limiting
            if response.status_code == 429:
                self.rate_limit_encountered = True
                print(f"   [{get_timestamp()}] 🚫 RATE LIMIT HIT! Status: 429")
                if retry_count >= self.max_retries:
                    print(f"   [{get_timestamp()}] ❌ Rate limit exceeded after {self.max_retries} retries for site {dive_site_id}")
                    return None

                retry_after = self._get_retry_after(response)
                wait_time = max(retry_after, 180)  # Wait at least 3 minutes for sliding window
                print(f"   [{get_timestamp()}] ⏳ Rate limit exceeded (attempt {retry_count + 1}/{self.max_retries}). Waiting {wait_time:.1f} seconds for sliding window to clear...")
                time.sleep(wait_time)
                self.last_rate_limit_time = time.time()
                return self.detect_shore_direction(dive_site_id, retry_count + 1)  # Retry with incremented count

            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            if hasattr(e, 'response') and e.response is not None:
                if e.response.status_code == 404:
                    return None  # No coastline found
                if e.response.status_code == 400:
                    print(f"   [{get_timestamp()}] ⚠️  WARNING: Site {dive_site_id} missing coordinates")
                    return None
            print(f"   [{get_timestamp()}] ❌ Failed to detect shore direction for site {dive_site_id}: {e}")
            return None

    def update_dive_site(self, dive_site_id: int, shore_direction_data: Dict, retry_count: int = 0) -> bool:
        """Update dive site with shore direction data."""
        # Ensure we have a valid token before making requests
        if not self.ensure_valid_token():
            print(f"   [{get_timestamp()}] ❌ Cannot proceed without valid authentication")
            return False

        # Check sliding window rate limiting for update operations
        sliding_window_wait = self._check_sliding_window_rate_limit()
        if sliding_window_wait > 2:
            time.sleep(sliding_window_wait)

        url = f"{self.base_url}/api/v1/dive-sites/{dive_site_id}"

        # Prepare update payload
        payload = {
            "shore_direction": shore_direction_data.get("shore_direction"),
            "shore_direction_confidence": shore_direction_data.get("confidence"),
            "shore_direction_method": shore_direction_data.get("method"),
            "shore_direction_distance_m": shore_direction_data.get("distance_to_coastline_m")
        }

        try:
            response = self.session.put(
                url,
                headers=self._get_headers(),
                json=payload,
                timeout=30
            )

            # Increment request counter for this minute
            self._increment_request_counter()

            # Handle authentication errors (token expired)
            if response.status_code == 401:
                print(f"   [{get_timestamp()}] 🔑 Authentication failed (likely expired token). Attempting to refresh...")
                if self.login():
                    print(f"   [{get_timestamp()}] ✅ Token refreshed successfully. Retrying update...")
                    return self.update_dive_site(dive_site_id, shore_direction_data, retry_count)  # Retry with new token
                else:
                    print(f"   [{get_timestamp()}] ❌ Failed to refresh token. Cannot continue.")
                    return False

            # Handle rate limiting for update operations
            if response.status_code == 429:
                self.rate_limit_encountered = True
                print(f"   [{get_timestamp()}] 🚫 RATE LIMIT HIT for update! Status: 429")
                if retry_count >= self.max_retries:
                    print(f"   [{get_timestamp()}] ❌ Rate limit exceeded after {self.max_retries} retries for dive site {dive_site_id}")
                    return False

                retry_after = self._get_retry_after(response)
                wait_time = max(retry_after, 180)  # Wait at least 3 minutes for sliding window
                print(f"   [{get_timestamp()}] ⏳ Rate limit exceeded for update (attempt {retry_count + 1}/{self.max_retries}). Waiting {wait_time:.1f} seconds for sliding window to clear...")
                time.sleep(wait_time)
                self.last_rate_limit_time = time.time()
                return self.update_dive_site(dive_site_id, shore_direction_data, retry_count + 1)  # Retry with incremented count

            response.raise_for_status()
            return True
        except requests.exceptions.RequestException as e:
            print(f"   [{get_timestamp()}] ❌ Failed to update dive site {dive_site_id}: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"  Response: {e.response.text}")
            return False


def main():
    """Main execution function."""
    # Parse command line arguments
    parser = argparse.ArgumentParser(
        description="Bulk update shore direction for dive sites using OpenStreetMap coastline data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Environment Variables:
    DIVEMAP_URL: Base URL of the Divemap API (e.g., http://localhost:8000)
    DIVEMAP_USERNAME: Username for authentication
    DIVEMAP_PASSWORD: Password for authentication

Examples:
    # Dry run to see what would be updated
    python scripts/bulk_update_shore_direction.py --dry-run

    # Update specific dive sites
    python scripts/bulk_update_shore_direction.py --ids 1,2,3

    # Force update without confirmation
    python scripts/bulk_update_shore_direction.py --force
        """
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be updated without making changes"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Skip confirmation prompt"
    )
    parser.add_argument(
        "--ids",
        type=str,
        help="Comma-separated list of dive site IDs to process (e.g., 1,2,3)"
    )
    parser.add_argument(
        "--base-url", "-u",
        default=os.getenv("DIVEMAP_URL", "http://localhost:8000"),
        help="Base URL for the Divemap API (default: DIVEMAP_URL env var or http://localhost:8000)"
    )
    parser.add_argument(
        "--username", "-U",
        default=os.getenv("DIVEMAP_USERNAME"),
        help="Username for authentication (default: DIVEMAP_USERNAME env var)"
    )
    parser.add_argument(
        "--password", "-P",
        default=os.getenv("DIVEMAP_PASSWORD"),
        help="Password for authentication (default: DIVEMAP_PASSWORD env var)"
    )
    parser.add_argument(
        "--debug", "-D",
        action="store_true",
        help="Enable debug logging in backend API calls"
    )
    parser.add_argument(
        "--max-retries", "-r",
        type=int,
        default=3,
        help="Maximum number of retries for rate-limited requests (default: 3)"
    )
    parser.add_argument(
        "--base-wait-time", "-w",
        type=int,
        default=120,
        help="Base wait time in seconds for rate limits (default: 120)"
    )
    parser.add_argument(
        "--max-requests-per-minute", "-m",
        type=int,
        default=60,
        help="Maximum requests per minute (conservative limit, default: 60)"
    )

    args = parser.parse_args()

    # Validate required arguments
    if not args.username:
        print("❌ Username is required. Set DIVEMAP_USERNAME environment variable or use --username")
        sys.exit(1)

    if not args.password:
        print("❌ Password is required. Set DIVEMAP_PASSWORD environment variable or use --password")
        sys.exit(1)

    base_url = args.base_url
    username = args.username
    password = args.password

    print(f"[{get_timestamp()}] 🚀 Divemap Bulk Shore Direction Update")
    if args.dry_run:
        print(f"[{get_timestamp()}] 📝 DRY RUN MODE - No changes will be made")
    print(f"[{get_timestamp()}] 🌐 Base URL: {base_url}")
    print(f"[{get_timestamp()}] 👤 Username: {username}")
    if args.ids:
        print(f"[{get_timestamp()}] 🎯 Selected IDs: {args.ids}")
    print()

    # Initialize API client
    api = DivemapAPI(
        base_url, username, password,
        debug=args.debug,
        max_retries=args.max_retries,
        base_wait_time=args.base_wait_time,
        max_requests_per_minute=args.max_requests_per_minute
    )

    # Authenticate
    if not api.login():
        sys.exit(1)

    # Get dive sites
    if args.ids:
        # Parse comma-separated IDs
        try:
            selected_ids = [int(id.strip()) for id in args.ids.split(',')]
        except ValueError:
            print(f"ERROR: Invalid ID format: {args.ids}")
            print("IDs must be comma-separated integers (e.g., 1,2,3)")
            sys.exit(1)

        print(f"Fetching {len(selected_ids)} selected dive sites...")
        all_sites = api.get_dive_sites()
        # Filter to selected IDs
        sites_to_update = [
            site for site in all_sites
            if site["id"] in selected_ids
            and site.get("latitude") is not None
            and site.get("longitude") is not None
        ]

        # Check for missing IDs
        found_ids = {site["id"] for site in sites_to_update}
        missing_ids = set(selected_ids) - found_ids
        if missing_ids:
            print(f"WARNING: Could not find dive sites with IDs: {', '.join(map(str, missing_ids))}")

    else:
        # Get all dive sites
        print("Fetching dive sites...")
        all_sites = api.get_dive_sites()
        print(f"✓ Found {len(all_sites)} total dive sites")

        # Filter sites without shore_direction and with coordinates
        sites_to_update = [
            site for site in all_sites
            if site.get("shore_direction") is None
            and site.get("latitude") is not None
            and site.get("longitude") is not None
        ]

        print(f"✓ Found {len(sites_to_update)} dive sites without shore_direction")

    print()

    if not sites_to_update:
        print("No dive sites to process. Exiting.")
        return

    # Confirm before proceeding (unless --force or --dry-run)
    if not args.force and not args.dry_run:
        print(f"Ready to update {len(sites_to_update)} dive sites.")
        response = input("Continue? (yes/no): ")
        if response.lower() not in ['yes', 'y']:
            print("Aborted.")
            return

    print()
    if args.dry_run:
        print("DRY RUN: Starting bulk update simulation...")
    else:
        print("Starting bulk update...")
    print()

    # Statistics
    success_count = 0
    failed_count = 0
    skipped_count = 0
    start_time = time.time()

    # Process each dive site
    for i, site in enumerate(sites_to_update, 1):
        site_id = site["id"]
        site_name = site.get("name", f"Site {site_id}")
        lat = site.get("latitude")
        lng = site.get("longitude")

        # Calculate progress
        progress_percent = (i / len(sites_to_update)) * 100
        elapsed_time = time.time() - start_time
        if i > 1:
            avg_time_per_site = elapsed_time / (i - 1)
            remaining_sites = len(sites_to_update) - i
            estimated_remaining = avg_time_per_site * remaining_sites
            remaining_minutes = int(estimated_remaining // 60)
            remaining_seconds = int(estimated_remaining % 60)
            time_str = f" (ETA: {remaining_minutes}m {remaining_seconds}s)"
        else:
            time_str = ""

        print()
        print(f"[{get_timestamp()}] ═══ Progress: {i}/{len(sites_to_update)} ({progress_percent:.1f}%){time_str} ═══")
        print(f"[{get_timestamp()}] Processing: {site_name} (ID: {site_id})")
        print(f"   Location: {lat}, {lng}")

        # Detect shore direction
        detection_result = api.detect_shore_direction(site_id)

        if not detection_result:
            print(f"   [{get_timestamp()}] ✗ Could not detect shore direction (no coastline found or error)")
            skipped_count += 1
            # Show running stats
            print(f"   [{get_timestamp()}] 📊 Stats: ✓ {success_count} | ✗ {failed_count} | ⏭️  {skipped_count}")
            # Small delay to avoid rate limiting
            time.sleep(0.5)
            continue

        shore_direction = detection_result.get("shore_direction")
        confidence = detection_result.get("confidence")
        distance = detection_result.get("distance_to_coastline_m")

        print(f"   [{get_timestamp()}] ✓ Detected: {shore_direction}° (confidence: {confidence}, distance: {distance:.1f}m)")

        if args.dry_run:
            print(f"   [{get_timestamp()}] [DRY RUN] Would update with: shore_direction={shore_direction}°, confidence={confidence}, distance={distance:.1f}m")
            success_count += 1
        else:
            # Update dive site
            if api.update_dive_site(site_id, detection_result):
                print(f"   [{get_timestamp()}] ✓ Updated successfully")
                success_count += 1
            else:
                print(f"   [{get_timestamp()}] ✗ Update failed")
                failed_count += 1

        # Show running stats after each site
        print(f"   [{get_timestamp()}] 📊 Stats: ✓ {success_count} | ✗ {failed_count} | ⏭️  {skipped_count}")

        # Small delay to avoid rate limiting (only if not already handled by sliding window)
        if not args.dry_run:
            # Check if we need to wait for rate limiting
            sliding_window_wait = api._check_sliding_window_rate_limit()
            if sliding_window_wait > 0:
                print(f"   [{get_timestamp()}] ⏳ Waiting {sliding_window_wait:.1f}s for rate limit...")
                time.sleep(sliding_window_wait)
            else:
                # Minimum interval between requests
                current_time = time.time()
                time_since_last = current_time - api.last_request_time
                if time_since_last < api.min_request_interval:
                    sleep_time = api.min_request_interval - time_since_last
                    time.sleep(sleep_time)
        else:
            # Shorter delay for dry-run (no actual API calls for updates)
            time.sleep(0.5)

    # Calculate total time
    total_time = time.time() - start_time
    total_minutes = int(total_time // 60)
    total_seconds = int(total_time % 60)

    # Print summary
    print()
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    if args.dry_run:
        print("DRY RUN MODE - No changes were made")
    print(f"Total sites processed: {len(sites_to_update)}")
    print(f"Successfully {'would be updated' if args.dry_run else 'updated'}: {success_count}")
    print(f"Failed: {failed_count}")
    print(f"Skipped (no coastline found): {skipped_count}")
    print(f"Total time: {total_minutes}m {total_seconds}s")
    if len(sites_to_update) > 0:
        avg_time = total_time / len(sites_to_update)
        print(f"Average time per site: {avg_time:.1f}s")
    print("=" * 70)

    # Rate limit summary
    print(f"\n[{get_timestamp()}] 📊 Rate Limit Summary:")
    print(f"   Requests this minute: {api.requests_this_minute}/{api.max_requests_per_minute}")
    print(f"   Current settings: max-retries={api.max_retries}, base-wait-time={api.base_wait_time}s")
    print(f"   Max requests per minute: {api.max_requests_per_minute}")

    if api.rate_limit_encountered:
        print(f"\n⚠️  Rate limits were encountered during execution.")
        print(f"   Consider using --max-retries and --base-wait-time to adjust retry behavior.")
        print(f"   You can also adjust --max-requests-per-minute for more conservative limits.")


if __name__ == "__main__":
    main()

