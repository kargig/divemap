#!/usr/bin/env python3
"""
Dive Site Duplicate Audit Script

This script scans existing approved dive sites in the database via the Divemap API
to identify any existing sites that breach the new similarity/proximity check rule
(highly similar names located within 50km of each other).

It is designed to run against both local/development and production environments.

Environment Variables:
    DIVEMAP_URL: Base URL of the Divemap API (default: http://localhost:8000)
    DIVEMAP_PAT: Personal Access Token for authentication (optional)

Usage:
    export DIVEMAP_URL="http://localhost:8000"
    export DIVEMAP_PAT="dm_pat_..."
    python utils/audit_duplicate_dive_sites.py [OPTIONS]

Options:
    --base-url, -u URL          Base URL for the Divemap API (default: DIVEMAP_URL or http://localhost:8000)
    --pat, -t TOKEN             Personal Access Token (default: DIVEMAP_PAT or None)
    --output, -o FILE           Path to save the markdown audit report (e.g., audit_report.md)
    --page-size, -p N           Page size for fetching dive sites (default: 100)
"""

import os
import sys
import time
import datetime
import argparse
import math
import requests
import difflib
from typing import Optional, Dict, List, Tuple


def get_timestamp() -> str:
    """Get current timestamp for logging."""
    return datetime.datetime.now().strftime("%H:%M:%S")


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in kilometers between two points using Haversine formula."""
    R = 6371.0  # Earth radius in km

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = (math.sin(dlat / 2)**2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2)**2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def is_similar_name(name1: str, name2: str) -> bool:
    """
    Check if two dive site names are highly similar.
    Matches if:
    1. They are not explicitly distinguished by different directional words (e.g. "East" vs "West").
       If both names have different directional words, they are not similar.
       If only one name has a directional word, they are considered similar.
    2. The SequenceMatcher ratio is >= 0.70 (handling typos and suffix/prefix variations like Elphinstone vs Elphinstone Reef)
    3. One is a substring of the other and the shorter name is at least 4 characters long
    """
    import re
    import difflib

    n1 = name1.lower().strip()
    n2 = name2.lower().strip()
    if n1 == n2:
        return True

    # Check for directional distinctions
    DIRECTIONAL_WORDS = {"north", "south", "east", "west", "northeast", "northwest", "southeast", "southwest"}
    
    words1 = set(re.findall(r'\b[a-z]+\b', n1))
    words2 = set(re.findall(r'\b[a-z]+\b', n2))
    
    dirs1 = words1.intersection(DIRECTIONAL_WORDS)
    dirs2 = words2.intersection(DIRECTIONAL_WORDS)

    # If both have directional words and they are different, they are distinct sub-sites (no conflict)
    if dirs1 and dirs2 and dirs1 != dirs2:
        return False

    # Check SequenceMatcher ratio
    ratio = difflib.SequenceMatcher(None, n1, n2).ratio()
    if ratio >= 0.70:
        return True

    # Check substring match for names with meaningful length (>= 4 chars)
    shorter, longer = (n1, n2) if len(n1) < len(n2) else (n2, n1)
    if len(shorter) >= 4 and shorter in longer:
        return True

    return False


class DivemapAPI:
    """Client for fetching data from the Divemap API."""

    def __init__(self, base_url: str, pat: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.pat = pat
        self.session = requests.Session()

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.pat:
            headers["Authorization"] = f"Bearer {self.pat}"
        return headers

    def get_dive_sites(self, page_size: int = 100) -> List[Dict]:
        """Fetch all approved dive sites using pagination."""
        url = f"{self.base_url}/api/v1/dive-sites/"
        all_sites = []
        page = 1

        while True:
            try:
                params = {"page": page, "page_size": page_size}
                response = self.session.get(
                    url,
                    headers=self._get_headers(),
                    params=params,
                    timeout=30
                )

                if response.status_code == 401:
                    print(f"[{get_timestamp()}] ❌ Authentication failed: Please verify your PAT token.")
                    return []

                response.raise_for_status()
                data = response.json()

                # Depending on API format, it may be a direct list or dict with 'items' key
                if isinstance(data, dict):
                    sites = data.get("items", [])
                elif isinstance(data, list):
                    sites = data
                else:
                    sites = []

                if not sites:
                    break

                all_sites.extend(sites)
                print(f"[{get_timestamp()}] 📥 Fetched page {page}: {len(sites)} sites (total: {len(all_sites)})")

                if len(sites) < page_size:
                    break

                page += 1

            except requests.exceptions.RequestException as e:
                print(f"[{get_timestamp()}] ❌ Failed to fetch dive sites: {e}")
                if hasattr(e, 'response') and e.response is not None:
                    print(f"Response: {e.response.text}")
                break

        return all_sites


def run_audit(all_sites: List[Dict]) -> List[Tuple[Dict, Dict, float]]:
    """Scan all sites for duplicates using a high-performance Latitude Band Sweep-Line algorithm."""
    # Filter sites with valid coordinates
    valid_sites = [
        site for site in all_sites
        if site.get("latitude") is not None and site.get("longitude") is not None
    ]

    print(f"[{get_timestamp()}] 🔍 Auditing {len(valid_sites)} dive sites with valid coordinates...")

    # Sort sites by latitude to enable O(N log N) sweep-line optimization
    sites_sorted = sorted(valid_sites, key=lambda s: s['latitude'])
    breaching_pairs = []

    # 50km in latitude is roughly 50 / 111.1 = 0.45 degrees
    lat_threshold = 0.45

    for i in range(len(sites_sorted)):
        s1 = sites_sorted[i]
        for j in range(i + 1, len(sites_sorted)):
            s2 = sites_sorted[j]

            # Since sorted by latitude, we can stop early when latitude delta exceeds 50km
            if s2['latitude'] - s1['latitude'] > lat_threshold:
                break

            # Calculate actual Haversine distance
            dist = calculate_distance(s1['latitude'], s1['longitude'], s2['latitude'], s2['longitude'])
            if dist < 50.0:
                if is_similar_name(s1['name'], s2['name']):
                    breaching_pairs.append((s1, s2, dist))

    # Sort pairs by distance (closest first)
    breaching_pairs.sort(key=lambda x: x[2])
    return breaching_pairs


def main():
    parser = argparse.ArgumentParser(description="Audit Divemap database for duplicate dive site names.")
    parser.add_argument(
        "--base-url", "-u",
        default=os.getenv("DIVEMAP_URL", "http://localhost:8000"),
        help="Base URL for the Divemap API (default: DIVEMAP_URL or http://localhost:8000)"
    )
    parser.add_argument(
        "--pat", "-t",
        default=os.getenv("DIVEMAP_PAT"),
        help="Personal Access Token for authentication (default: DIVEMAP_PAT)"
    )
    parser.add_argument(
        "--output", "-o",
        help="Path to save the markdown audit report (e.g., audit_report.md)"
    )
    parser.add_argument(
        "--page-size", "-p",
        type=int,
        default=100,
        help="Page size for pagination (default: 100)"
    )

    args = parser.parse_args()

    print(f"[{get_timestamp()}] 🚀 Divemap Proximity & Name Similarity Audit")
    print(f"[{get_timestamp()}] 🌐 Target API: {args.base_url}")
    if args.pat:
        print(f"[{get_timestamp()}] 🔑 Authentication: PAT Token provided")
    else:
        print(f"[{get_timestamp()}] 🔑 Authentication: None (running as guest)")

    # Initialize client
    api = DivemapAPI(args.base_url, args.pat)

    # Fetch sites
    all_sites = api.get_dive_sites(args.page_size)
    if not all_sites:
        print("❌ No dive sites found or failed to fetch. Exiting.")
        sys.exit(1)

    # Run audit
    start_time = time.time()
    breaching_pairs = run_audit(all_sites)
    duration = time.time() - start_time

    print(f"\n[{get_timestamp()}] ✅ Audit complete in {duration:.2f}s!")
    print(f"[{get_timestamp()}] 🚨 Found {len(breaching_pairs)} pairs of dive sites breaching the duplicate rule.")

    # Display results
    if breaching_pairs:
        print("\n" + "="*80)
        print(f"{'SITE 1 (ID)':<30} | {'SITE 2 (ID)':<30} | {'DISTANCE':<12}")
        print("="*80)
        for s1, s2, dist in breaching_pairs[:20]:
            name1 = f"{s1['name']} ({s1['id']})"
            name2 = f"{s2['name']} ({s2['id']})"
            print(f"{name1:<30} | {name2:<30} | {dist:.2f} km")
        if len(breaching_pairs) > 20:
            print(f"... and {len(breaching_pairs) - 20} more pairs.")
        print("="*80)

    # Write report if requested
    if args.output:
        try:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(f"# Dive Site Duplicate Audit Report\n\n")
                f.write(f"- **Audit Execution Date:** {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"- **Target Environment:** {args.base_url}\n")
                f.write(f"- **Total Sites Scanned:** {len(all_sites)}\n")
                f.write(f"- **Breaching Pairs Detected:** {len(breaching_pairs)}\n\n")

                f.write("## Detailed Detection Log\n\n")
                if not breaching_pairs:
                    f.write("🎉 No duplicate pairs detected! Your database is completely clean.\n")
                else:
                    f.write("| ID | Site 1 | ID | Site 2 | Distance (km) | Coordinates 1 | Coordinates 2 |\n")
                    f.write("|---|---|---|---|---|---|---|\n")
                    for s1, s2, dist in breaching_pairs:
                        f.write(
                            f"| `{s1['id']}` | **{s1['name']}** "
                            f"| `{s2['id']}` | **{s2['name']}** "
                            f"| {dist:.2f} "
                            f"| `{s1['latitude']:.5f}, {s1['longitude']:.5f}` "
                            f"| `{s2['latitude']:.5f}, {s2['longitude']:.5f}` |\n"
                        )
            print(f"\n[{get_timestamp()}] 📝 Saved detailed markdown report to: {args.output}")
        except Exception as e:
            print(f"❌ Failed to save report: {e}")


if __name__ == "__main__":
    main()
