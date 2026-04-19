#!/usr/bin/env python3
import requests
import time
import sys
import json
from typing import List, Dict

# The comprehensive list of known endpoints
ENDPOINTS = [
    "https://overpass.openstreetmap.fr/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter"
]

# Known coastline coordinate (Cape Sounion, Greece)
LAT, LNG = 37.6501, 24.0245
RADIUS = 1000
TIMEOUT = 15

HEADERS = {
    "User-Agent": "Divemap-Diagnostic/1.0 (https://github.com/kargig/divemap)",
    "Referer": "https://divemap.com",
    "Content-Type": "application/x-www-form-urlencoded"
}

QUERY = f'[out:json][timeout:{TIMEOUT}]; (way["natural"="coastline"](around:{RADIUS},{LAT},{LNG});); out geom;'

def test_endpoint(url: str) -> Dict:
    print(f"Testing {url:50} ", end="", flush=True)
    start_time = time.time()
    result = {
        "url": url,
        "status": "Unknown",
        "latency": 0,
        "valid_json": False,
        "has_data": False,
        "error": None
    }
    
    try:
        response = requests.post(url, data=QUERY, headers=HEADERS, timeout=TIMEOUT + 5)
        result["latency"] = time.time() - start_time
        result["status"] = str(response.status_code)
        
        if response.status_code == 200:
            try:
                data = response.json()
                result["valid_json"] = True
                result["has_data"] = len(data.get("elements", [])) > 0
            except json.JSONDecodeError:
                result["error"] = "Invalid JSON (likely HTML timeout error)"
        else:
            result["error"] = f"HTTP Error {response.status_code}"
            
    except requests.exceptions.Timeout:
        result["status"] = "TIMEOUT"
        result["latency"] = TIMEOUT + 5
    except Exception as e:
        result["status"] = "ERROR"
        result["error"] = str(e)
        
    if result["status"] == "200" and result["has_data"]:
        print(f"[\033[92mPASS\033[0m] {result['latency']:.2f}s")
    elif result["status"] == "200":
        print(f"[\033[93mEMPTY\033[0m] {result['latency']:.2f}s (No coastline data)")
    else:
        print(f"[\033[91mFAIL\033[0m] {result['status']} {result['error'] or ''}")
        
    return result

def main():
    print(f"--- Overpass API Diagnostic (Radius: {RADIUS}m around {LAT}, {LNG}) ---")
    results = []
    for url in ENDPOINTS:
        results.append(test_endpoint(url))
    
    print("\n--- Summary ---")
    # Sort by PASS > EMPTY > FAIL, then by latency
    sorted_results = sorted(results, key=lambda x: (
        0 if (x["status"] == "200" and x["has_data"]) else 1 if x["status"] == "200" else 2,
        x["latency"]
    ))
    
    for r in sorted_results:
        indicator = "✅" if (r["status"] == "200" and r["has_data"]) else "⚠️" if r["status"] == "200" else "❌"
        print(f"{indicator} {r['url']:50} {r['status']:8} {r['latency']:5.2f}s")

if __name__ == "__main__":
    main()
