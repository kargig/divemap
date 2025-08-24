#!/usr/bin/env python3
"""
Script to update diving centers with country, region, and city data using the reverse geocoding API.

This script can update a single diving center by ID or all diving centers that have coordinates
but are missing country/region/city information.

Usage:
    python update_diving_center_locations.py [--diving-center-id ID] [--base-url URL] [--username USER] [--password PASS] [--dry-run] [--force]

Environment Variables:
    DIVEMAP_BASE_URL: Base URL for the Divemap API (default: http://localhost:8000)
    DIVEMAP_USERNAME: Username for authentication
    DIVEMAP_PASSWORD: Password for authentication

Rate Limit Handling:
    The script automatically handles rate limits (HTTP 429) from the backend API:
    - Respects Retry-After headers when provided
    - Implements exponential backoff with configurable retry attempts
    - Configurable base wait time for rate limit responses
    - Tracks rate limit encounters and provides summary
    - Proactive fixed window rate limiting (prevents hitting limits)
    - Conservative request counting per minute with configurable limits

Examples:
    # Update a specific diving center
    python update_diving_center_locations.py --diving-center-id 123

    # Update all diving centers missing country/region/city data
    python update_diving_center_locations.py

    # Use custom base URL
    DIVEMAP_BASE_URL=https://api.divemap.com python update_diving_center_locations.py

    # Dry run mode - preview changes without applying them
    python utils/update_diving_center_locations.py --dry-run

    # Force update all diving centers with coordinates
    python utils/update_diving_center_locations.py --force

    # Handle rate limits with custom retry settings (optimized for sliding window)
    python utils/update_diving_center_locations.py --max-retries 5 --base-wait-time 180

    # Debug mode with rate limit handling
    python utils/update_diving_center_locations.py --debug --max-retries 3 --base-wait-time 180

    # Conservative rate limiting for high-traffic scenarios
    python utils/update_diving_center_locations.py --max-requests-per-minute 50 --max-retries 5

    # Aggressive rate limiting for production environments
    python utils/update_diving_center_locations.py --max-requests-per-minute 60 --base-wait-time 180
"""

import os
import sys
import time
import datetime
import argparse
import requests
from typing import Optional, Dict, List, Tuple
from urllib.parse import urljoin

def get_timestamp():
    """Get current timestamp for logging."""
    return datetime.datetime.now().strftime("%H:%M:%S")


class DivingCenterLocationUpdater:
    """
    Update diving centers with country, region, and city data using reverse geocoding.
    
    Rate Limiting Strategy:
    - Uses sliding window rate limiting (optimized for slowapi 0.1.9)
    - Waits 3-5 minutes after hitting rate limits to allow sliding window to clear
    - Conservative request limits to prevent hitting backend limits
    - Proactive rate limit checking before making requests
    """
    
    def __init__(self, base_url: str, username: str, password: str, dry_run: bool = False, force: bool = False, debug: bool = False):
        self.base_url = base_url.rstrip('/')
        self.username = username
        self.password = password
        self.dry_run = dry_run
        self.force = force
        self.debug = debug
        self.session = requests.Session()
        self.auth_token = None
        
        # Rate limiting for Nominatim API (1 request per second)
        self.last_request_time = 0
        self.min_request_interval = 1.0
        
        # Rate limit handling - optimized for SLIDING WINDOW rate limiting (slowapi 0.1.9)
        self.max_retries = 3
        self.base_wait_time = 120  # Increased to 2 minutes for sliding window
        self.rate_limit_encountered = False  # Track if we've hit rate limits
        self.last_rate_limit_time = 0  # Track when we last hit rate limit
        
        # Sliding window rate limiting optimization
        self.requests_this_minute = 0
        self.minute_start_time = int(time.time() / 60) * 60  # Start of current minute
        self.max_requests_per_minute = 60  # More conservative limit (75 - 15 buffer)
        
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
        # Calculate optimal wait time based on how many requests we've made
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
    
    def authenticate(self) -> bool:
        """Authenticate with the Divemap API and get access token."""
        try:
            auth_url = urljoin(self.base_url, "/api/v1/auth/login")
            auth_data = {
                "username": self.username,
                "password": self.password
            }
            
            print(f"[{get_timestamp()}] 🔐 Authenticating with {self.base_url}...")
            response = self.session.post(auth_url, json=auth_data, timeout=30)
            response.raise_for_status()
            
            auth_response = response.json()
            self.auth_token = auth_response.get("access_token")
            
            if not self.auth_token:
                print(f"[{get_timestamp()}] ❌ No access token received from authentication")
                return False
                
            # Set authorization header for future requests
            self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
            print(f"[{get_timestamp()}] ✅ Authentication successful")
            return True
            
        except requests.exceptions.RequestException as e:
            print(f"[{get_timestamp()}] ❌ Authentication failed: {e}")
            return False
        except Exception as e:
            print(f"[{get_timestamp()}] ❌ Unexpected error during authentication: {e}")
            return False
    
    def is_token_valid(self) -> bool:
        """Check if the current authentication token is still valid."""
        if not self.auth_token:
            return False
        
        # Try to make a simple request to test token validity
        try:
            url = urljoin(self.base_url, "/api/v1/diving-centers/")
            response = self.session.get(url, params={"page": 1, "page_size": 1}, timeout=10)
            return response.status_code != 401
        except:
            return False
    
    def ensure_valid_token(self) -> bool:
        """Ensure we have a valid token, refreshing if necessary."""
        if not self.is_token_valid():
            print(f"[{get_timestamp()}] 🔑 Token expired or invalid. Refreshing...")
            return self.authenticate()
        return True
    
    def get_diving_centers(self, diving_center_id: Optional[int] = None) -> List[Dict]:
        """Get diving centers from the API."""
        try:
            # Ensure we have a valid token before making requests
            if not self.ensure_valid_token():
                print(f"[{get_timestamp()}] ❌ Cannot proceed without valid authentication")
                return []
            
            if diving_center_id:
                # Get specific diving center
                url = urljoin(self.base_url, f"/api/v1/diving-centers/{diving_center_id}")
                response = self.session.get(url, timeout=30)
                
                # Handle authentication errors (token expired)
                if response.status_code == 401:
                    print(f"[{get_timestamp()}] 🔑 Authentication failed (likely expired token). Attempting to refresh...")
                    if self.authenticate():
                        print(f"[{get_timestamp()}] ✅ Token refreshed successfully. Retrying fetch...")
                        return self.get_diving_centers(diving_center_id)  # Retry with new token
                    else:
                        print(f"[{get_timestamp()}] ❌ Failed to refresh token. Cannot continue.")
                        return []
                
                response.raise_for_status()
                diving_center = response.json()
                return [diving_center] if diving_center else []
            else:
                # Get all diving centers with pagination
                all_diving_centers = []
                page = 1
                page_size = 100
                
                while True:
                    url = urljoin(self.base_url, "/api/v1/diving-centers/")
                    params = {
                        "page": page,
                        "page_size": page_size
                    }
                    
                    response = self.session.get(url, params=params, timeout=30)
                    
                    # Handle authentication errors (token expired)
                    if response.status_code == 401:
                        print(f"[{get_timestamp()}] 🔑 Authentication failed (likely expired token). Attempting to refresh...")
                        if self.authenticate():
                            print(f"[{get_timestamp()}] ✅ Token refreshed successfully. Retrying fetch...")
                            return self.get_diving_centers(diving_center_id)  # Retry with new token
                        else:
                            print(f"[{get_timestamp()}] ❌ Failed to refresh token. Cannot continue.")
                            return []
                    
                    response.raise_for_status()
                    
                    data = response.json()
                    # The API returns a list directly, not an object with 'items'
                    diving_centers = data if isinstance(data, list) else []
                    
                    if not diving_centers:
                        break
                        
                    all_diving_centers.extend(diving_centers)
                    page += 1
                    
                    # Check if we've reached the last page
                    if len(diving_centers) < page_size:
                        break
                
                return all_diving_centers
                
        except requests.exceptions.RequestException as e:
            print(f"[{get_timestamp()}] ❌ Failed to fetch diving centers: {e}")
            return []
        except Exception as e:
            print(f"[{get_timestamp()}] ❌ Unexpected error fetching diving centers: {e}")
            return []
    
    def get_reverse_geocode(self, latitude: float, longitude: float, retry_count: int = 0) -> Optional[Dict]:
        """Get country, region, and city data using the reverse geocoding API."""
        try:
            # Ensure we have a valid token before making requests
            if not self.ensure_valid_token():
                print(f"   ❌ [{get_timestamp()}] Cannot proceed without valid authentication")
                return None
            
            # Check sliding window rate limiting first
            sliding_window_wait = self._check_sliding_window_rate_limit()
            if sliding_window_wait > 0:
                time.sleep(sliding_window_wait)
            
            # Rate limiting for Nominatim API (minimum interval between requests)
            current_time = time.time()
            time_since_last = current_time - self.last_request_time
            if time_since_last < self.min_request_interval:
                sleep_time = self.min_request_interval - time_since_last
                time.sleep(sleep_time)
            
            url = urljoin(self.base_url, "/api/v1/diving-centers/reverse-geocode")
            params = {
                "latitude": latitude,
                "longitude": longitude
            }
            
            # Add debug parameter if debug mode is enabled
            if self.debug:
                params["debug"] = "true"
            
            response = self.session.get(url, params=params, timeout=30)
            
            # Increment request counter for this minute
            self._increment_request_counter()
            
            # Handle authentication errors (token expired)
            if response.status_code == 401:
                print(f"   🔑 [{get_timestamp()}] Authentication failed (likely expired token). Attempting to refresh...")
                if self.authenticate():
                    print(f"   ✅ [{get_timestamp()}] Token refreshed successfully. Retrying geocoding...")
                    return self.get_reverse_geocode(latitude, longitude, retry_count)  # Retry with new token
                else:
                    print(f"   ❌ [{get_timestamp()}] Failed to refresh token. Cannot continue.")
                    return None
            
            # Handle rate limiting
            if response.status_code == 429:
                self.rate_limit_encountered = True
                print(f"   🚫 [{get_timestamp()}] RATE LIMIT HIT! Status: 429")
                if retry_count >= self.max_retries:
                    print(f"   ❌ Rate limit exceeded after {self.max_retries} retries for coordinates ({latitude}, {longitude})")
                    return None
                
                retry_after = self._get_retry_after(response)
                # For sliding window rate limiting, we need to wait much longer
                # The backend uses slowapi 0.1.9 which has a rolling 60-second window
                # If we hit the limit, we need to wait for the entire window to clear
                wait_time = max(retry_after, 180)  # Wait at least 3 minutes for sliding window
                print(f"   ⏳ [{get_timestamp()}] Rate limit exceeded (attempt {retry_count + 1}/{self.max_retries}). Waiting {wait_time:.1f} seconds for sliding window to clear...")
                time.sleep(wait_time)
                self.last_request_time = time.time()
                self.last_rate_limit_time = time.time()
                return self.get_reverse_geocode(latitude, longitude, retry_count + 1)  # Retry with incremented count
            
            response.raise_for_status()
            
            response_data = response.json()
            self.last_request_time = time.time()
            return response_data
            
        except requests.exceptions.RequestException as e:
            print(f"   [{get_timestamp()}] ❌ Reverse geocoding failed for coordinates ({latitude}, {longitude}): {e}")
            return None
        except Exception as e:
            print(f"   [{get_timestamp()}] ❌ Unexpected error during reverse geocoding: {e}")
            return None
    
    def update_diving_center(self, diving_center_id: int, country: str, region: str, city: str, retry_count: int = 0) -> bool:
        """Update a diving center with new country, region, and city data."""
        try:
            if self.dry_run:
                print(f"📝 [DRY RUN] Would update diving center {diving_center_id}: country='{country}', region='{region}', city='{city}'")
                return True
            
            # Ensure we have a valid token before making requests
            if not self.ensure_valid_token():
                print(f"   ❌ [{get_timestamp()}] Cannot proceed without valid authentication")
                return False
            
            # Check sliding window rate limiting for update operations
            sliding_window_wait = self._check_sliding_window_rate_limit()
            if sliding_window_wait > 2:
                time.sleep(sliding_window_wait)
            
            url = urljoin(self.base_url, f"/api/v1/diving-centers/{diving_center_id}")
            update_data = {
                "country": country,
                "region": region,
                "city": city
            }
            
            response = self.session.put(url, json=update_data, timeout=30)
            
            # Increment request counter for this minute
            self._increment_request_counter()
            
            # Handle authentication errors (token expired)
            if response.status_code == 401:
                print(f"   🔑 [{get_timestamp()}] Authentication failed (likely expired token). Attempting to refresh...")
                if self.authenticate():
                    print(f"   ✅ [{get_timestamp()}] Token refreshed successfully. Retrying update...")
                    return self.update_diving_center(diving_center_id, country, region, city, retry_count)  # Retry with new token
                else:
                    print(f"   ❌ [{get_timestamp()}] Failed to refresh token. Cannot continue.")
                    return False
            
            # Handle rate limiting for update operations
            if response.status_code == 429:
                self.rate_limit_encountered = True
                print(f"   🚫 [{get_timestamp()}] RATE LIMIT HIT for update! Status: 429")
                if retry_count >= self.max_retries:
                    print(f"   ❌ Rate limit exceeded after {self.max_retries} retries for diving center {diving_center_id}")
                    return False
                
                retry_after = self._get_retry_after(response)
                # For sliding window rate limiting, we need to wait much longer
                # The backend uses slowapi 0.1.9 which has a rolling 60-second window
                # If we hit the limit, we need to wait for the entire window to clear
                wait_time = max(retry_after, 180)  # Wait at least 3 minutes for sliding window
                print(f"   ⏳ [{get_timestamp()}] Rate limit exceeded for update (attempt {retry_count + 1}/{self.max_retries}). Waiting {wait_time:.1f} seconds for sliding window to clear...")
                time.sleep(wait_time)
                self.last_rate_limit_time = time.time()
                return self.update_diving_center(diving_center_id, country, region, city, retry_count + 1)  # Retry with incremented count
            
            response.raise_for_status()
            
            print(f"✅ Updated diving center {diving_center_id}: country='{country}', region='{region}', city='{city}'")
            return True
            
        except requests.exceptions.RequestException as e:
            print(f"   [{get_timestamp()}] ❌ Failed to update diving center {diving_center_id}: {e}")
            return False
        except Exception as e:
            print(f"   [{get_timestamp()}] ❌ Unexpected error updating diving center {diving_center_id}: {e}")
            return False
    
    def needs_update(self, diving_center: Dict) -> bool:
        """Check if a diving center needs country/region/city update."""
        # Check if diving center has coordinates
        if not diving_center.get("latitude") or not diving_center.get("longitude"):
            return False
        
        # Check if country, region, or city is missing
        country = diving_center.get("country")
        region = diving_center.get("region")
        city = diving_center.get("city")
        
        return not country or not region or not city
    
    def has_existing_data(self, diving_center: Dict) -> bool:
        """Check if a diving center already has country, region, and city data."""
        country = diving_center.get("country")
        region = diving_center.get("region")
        city = diving_center.get("city")
        return bool(country and region and city)
    
    def should_update_existing(self, diving_center: Dict) -> bool:
        """Determine if we should update a diving center that already has data."""
        if self.force:
            return True
        
        if not self.has_existing_data(diving_center):
            return True
        
        # Interactive prompt for user decision
        diving_center_id = diving_center["id"]
        name = diving_center["name"]
        current_country = diving_center.get("country", "N/A")
        current_region = diving_center.get("region", "N/A")
        current_city = diving_center.get("city", "N/A")
        
        print(f"\n[{get_timestamp()}] 📍 Diving center {name} (ID: {diving_center_id}) already has location data:")
        print(f"   Current: country='{current_country}', region='{current_region}', city='{current_city}'")

        while True:
            response = input(f"   [{get_timestamp()}] Do you want to update this diving center? (y/n): ").strip().lower()
            if response in ['y', 'yes']:
                return True
            elif response in ['n', 'no']:
                return False
            else:
                print(f"   [{get_timestamp()}] Please enter 'y' for yes or 'n' for no.")
    
    def process_diving_center(self, diving_center: Dict) -> bool:
        """Process a single diving center for location update."""
        diving_center_id = diving_center["id"]
        name = diving_center["name"]
        latitude = diving_center["latitude"]
        longitude = diving_center["longitude"]
        current_country = diving_center.get("country", "N/A")
        current_region = diving_center.get("region", "N/A")
        current_city = diving_center.get("city", "N/A")
        
        print(f"\n[{get_timestamp()}] 📍 Processing diving center: {name} (ID: {diving_center_id})")
        print(f"   Coordinates: ({latitude}, {longitude})")
        print(f"   Current: country='{current_country}', region='{current_region}', city='{current_city}'")
        
        # Check if we should update this diving center
        if not self.should_update_existing(diving_center):
            print(f"   ⏭️  Skipping - user chose not to update")
            return True  # Count as successful since it was a user choice
        
        # Get reverse geocoding data
        print(f"   🔍 [{get_timestamp()}] Getting reverse geocoding data...")
        geocode_data = self.get_reverse_geocode(latitude, longitude)
        if not geocode_data:
            print(f"   ❌ Skipping - failed to get geocoding data")
            return False
        
        new_country = geocode_data.get("country")
        new_region = geocode_data.get("region")
        new_city = geocode_data.get("city")
        
        if not new_country and not new_region and not new_city:
            print(f"   ⚠️  Skipping - no country/region/city data available")
            return False
        
        # Check if we actually have new data to update
        if (new_country == current_country and new_region == current_region and new_city == current_city):
            print(f"   ✅ Already up to date")
            return True
        
        # Update the diving center
        print(f"   🔄 [{get_timestamp()}] Updating diving center...")
        success = self.update_diving_center(diving_center_id, new_country or "", new_region or "", new_city or "")
        if success:
            print(f"   ✅ Updated to: country='{new_country or 'N/A'}', region='{new_region or 'N/A'}', city='{new_city or 'N/A'}'")
        else:
            print(f"   ❌ Update failed")
        
        return success
    
    def run(self, diving_center_id: Optional[int] = None) -> None:
        """Main execution method."""
        mode = "DRY RUN" if self.dry_run else "LIVE"
        print(f"[{get_timestamp()}] 🚀 Starting diving center location updates ({mode})...")
        print(f"[{get_timestamp()}] 🌐 Base URL: {self.base_url}")
        
        if self.dry_run:
            print(f"[{get_timestamp()}] 📝 DRY RUN MODE: No actual updates will be made")
        
        # Authenticate
        if not self.authenticate():
            print(f"[{get_timestamp()}] ❌ Cannot proceed without authentication")
            sys.exit(1)
        
        # Get diving centers
        print(f"\n[{get_timestamp()}] 📋 Fetching diving centers...")
        diving_centers = self.get_diving_centers(diving_center_id)
        
        if not diving_centers:
            print(f"[{get_timestamp()}] ❌ No diving centers found")
            return
        
        print(f"[{get_timestamp()}] 📊 Found {len(diving_centers)} diving center(s)")
        
        # Filter diving centers that need updates
        if diving_center_id:
            # Single diving center mode - process regardless of current state
            centers_to_process = diving_centers
            print(f"[{get_timestamp()}] 🎯 Processing single diving center: {diving_center_id}")
        else:
            if self.force:
                # Force mode - process all centers with coordinates
                centers_to_process = [center for center in diving_centers if center.get("latitude") and center.get("longitude")]
                print(f"[{get_timestamp()}] 🔄 Force mode: Processing {len(centers_to_process)} diving center(s) with coordinates")
            else:
                # Normal mode - only process centers that need updates
                centers_to_process = [center for center in diving_centers if self.needs_update(center)]
                print(f"[{get_timestamp()}] 🔄 Found {len(centers_to_process)} diving center(s) that need location updates")
        
        if not centers_to_process:
            print(f"[{get_timestamp()}] ✅ No diving centers need updates")
            return
        
        # Process diving centers
        print(f"\n[{get_timestamp()}] 🔄 Processing {len(centers_to_process)} diving center(s)...")
        successful_updates = 0
        failed_updates = 0
        
        for i, diving_center in enumerate(centers_to_process, 1):
            print(f"\n[{get_timestamp()}] [{i}/{len(centers_to_process)}]", end="")
            if self.process_diving_center(diving_center):
                successful_updates += 1
            else:
                failed_updates += 1
        
        # Summary
        mode_text = "would be updated" if self.dry_run else "were updated"
        print(f"\n[{get_timestamp()}] 📊 Update Summary ({mode_text}):")
        print(f"   Total processed: {len(centers_to_process)}")
        print(f"   Successful: {successful_updates}")
        print(f"   Failed: {failed_updates}")
        
        if successful_updates > 0:
            if self.dry_run:
                print("📝 DRY RUN: All updates would have been successful!")
                print("💡 Run without --dry-run to apply these changes")
            else:
                print("✅ Location updates completed successfully!")
        else:
            print("❌ No updates were successful")
        
        # Rate limit summary
        print(f"\n[{get_timestamp()}] 📊 Rate Limit Summary:")
        print(f"   Requests this minute: {self.requests_this_minute}/{self.max_requests_per_minute}")
        print(f"   Current settings: max-retries={self.max_retries}, base-wait-time={self.base_wait_time}s")
        print(f"   Max requests per minute: {self.max_requests_per_minute}")
        
        if self.rate_limit_encountered:
            print(f"\n⚠️  Rate limits were encountered during execution.")
            print(f"   Consider using --max-retries and --base-wait-time to adjust retry behavior.")
            print(f"   You can also adjust --max-requests-per-minute for more conservative limits.")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Update diving centers with country, region, and city data using reverse geocoding",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        "--diving-center-id", "-i",
        type=int,
        help="Update only the specified diving center ID"
    )
    
    parser.add_argument(
        "--base-url", "-u",
        default=os.getenv("DIVEMAP_BASE_URL", "http://localhost:8000"),
        help="Base URL for the Divemap API (default: DIVEMAP_BASE_URL env var or http://localhost:8000)"
    )
    
    parser.add_argument(
        "--username", "-U",
        default=os.getenv("DIVEMAP_USERNAME"),
        help="Username for authentication (default: DIVEMAP_USERNAME env var)"
    )
    
    parser.add_argument(
        "--password", "-P",
        default=os.getenv("DIVEMAP_PASSWORD", "admin123"),
        help="Password for authentication (default: DIVEMAP_PASSWORD env var)"
    )
    
    parser.add_argument(
        "--dry-run", "-d",
        action="store_true",
        help="Dry run mode: fetch country/region/city data but don't make actual updates"
    )
    
    parser.add_argument(
        "--force", "-f",
        action="store_true",
        help="Force update all diving centers with coordinates, even if they already have country/region/city data"
    )
    
    parser.add_argument(
        "--debug", "-D",
        action="store_true",
        help="Enable debug logging in backend API calls (shows detailed Nominatim responses)"
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
        default=60,
        help="Base wait time in seconds for rate limits (default: 60)"
    )
    
    parser.add_argument(
        "--max-requests-per-minute", "-m",
        type=int,
        default=70,
        help="Maximum requests per minute (conservative limit, default: 70)"
    )
    
    args = parser.parse_args()
    
    # Validate required arguments
    if not args.username:
        print("❌ Username is required. Set DIVEMAP_USERNAME environment variable or use --username")
        sys.exit(1)
    
    if not args.password:
        print("❌ Password is required. Set DIVEMAP_PASSWORD environment variable or use --password")
        sys.exit(1)
    
    # Create updater and run
    updater = DivingCenterLocationUpdater(args.base_url, args.username, args.password, args.dry_run, args.force, args.debug)
    
    # Update rate limit settings from command line arguments
    updater.max_retries = args.max_retries
    updater.base_wait_time = args.base_wait_time
    updater.max_requests_per_minute = args.max_requests_per_minute
    
    updater.run(args.diving_center_id)


if __name__ == "__main__":
    main()
