import asyncio
import httpx
import json
import time
import subprocess
import sys
import os
import argparse
from datetime import datetime

# Configuration
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
API_PREFIX = "/api/v1"
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

# Test Cases
TEST_CASES = [
    {"prompt": "find dive sites near Peloponnese", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "what are some good dive sites in Egypt?", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "what are some good shore dive sites in Athens", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "wrecks near Makronisos", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "best diving in Crete", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "is there diving in Santorini?", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "show me sites with octopus", "type": "marine_life", "expected_min_sources": 1},
    {"prompt": "show me deep dives in Attica", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "weather for diving in Anavyssos tomorrow", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "how much to rent a tank in Athens?", "type": "gear_rental", "expected_min_sources": 1},
    {"prompt": "PADI courses in Greece", "type": "career_path", "expected_min_sources": 1},
    {"prompt": "what is the difference between PADI TEC45 and SSI XR?", "type": "comparison", "expected_min_sources": 1},
    {"prompt": "recommend a dive site for advanced divers near me", "type": "personal_recommendation", "expected_min_sources": 1},
    {"prompt": "dive sites near Porto Ennea", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "cave diving in Greece", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "history of the wreck Kyra Leni", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "diving centers in Paros", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "boat dives near Sounio", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "do you know any snorkeling spots in Naxos ?", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "where can I see monk seals in Greece?", "type": "marine_life", "expected_min_sources": 1},
    {"prompt": "what are some good shore dive sites in Athens", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "tell me a joke about diving", "type": "chit_chat", "expected_min_sources": 0},
]

async def login(client):
    if not ADMIN_USERNAME or not ADMIN_PASSWORD:
        print("[!] ADMIN_USERNAME or ADMIN_PASSWORD not set in environment.")
        return None
        
    print(f"[*] Logging in as {ADMIN_USERNAME}...")
    try:
        resp = await client.post(f"{API_PREFIX}/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        if resp.status_code != 200:
            print(f"[!] Login failed ({resp.status_code}): {resp.text}")
            return None
        
        return resp.json()["access_token"]
    except Exception as e:
        print(f"[!] Auth error: {e}")
        return None

async def run_tests(filter_prompt=None):
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=60.0) as client:
        token = await login(client)
        if not token:
            print("[!] Could not obtain auth token. Exiting.")
            sys.exit(1)
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Filter test cases if prompt provided
        cases_to_run = TEST_CASES
        if filter_prompt:
            cases_to_run = [case for case in TEST_CASES if filter_prompt.lower() in case["prompt"].lower()]
            if not cases_to_run:
                print(f"[!] No test cases matched filter: '{filter_prompt}'")
                return

        results = []
        print("\n[*] Starting Chat Quality Evaluation...")
        if filter_prompt:
            print(f"[*] Filter: '{filter_prompt}'")
        print("-" * 110)
        print(f"{'PROMPT':<45} | {'SOURCES':<8} | {'STATUS':<10} | {'TIME (s)':<8}")
        print("-" * 110)

        for case in cases_to_run:
            start_time = time.time()
            try:
                resp = await client.post(f"{API_PREFIX}/chat/message", json={
                    "message": case["prompt"],
                    "history": [],
                    "user_location": [37.9838, 23.7275] # Athens coordinates for "near me" tests
                }, headers=headers)
                
                duration = time.time() - start_time
                
                if resp.status_code == 200:
                    data = resp.json()
                    sources = data.get("sources", [])
                    response_text = data.get("response", "")
                    
                    # Quality Checks
                    sources_count = len(sources)
                    passed = True
                    fail_reason = ""
                    
                    # Check 1: Source Count (for discovery types)
                    if case["expected_min_sources"] > 0 and sources_count < case["expected_min_sources"]:
                        passed = False
                        fail_reason = f"Expected >={case['expected_min_sources']} sources, got {sources_count}"
                    
                    # Check 2: Negative phrases
                    negative_phrases = [
                        "I don't have specific", 
                        "No relevant results found", 
                        "I don't have a specific list",
                        "don't have information about dive sites in",
                        "don't have data on dive sites in"
                    ]
                    for phrase in negative_phrases:
                        if phrase.lower() in response_text.lower() and case["type"] != "chit_chat":
                            passed = False
                            fail_reason = f"Contains negative phrase: '{phrase}'"
                    
                    status_str = "PASS" if passed else "FAIL"
                    
                    print(f"{case['prompt'][:45]:<45} | {sources_count:<8} | {status_str:<10} | {duration:.2f}")
                    
                    results.append({
                        "prompt": case["prompt"],
                        "passed": passed,
                        "fail_reason": fail_reason,
                        "sources_count": sources_count,
                        "response_snippet": response_text[:150] + "...",
                        "duration": duration,
                        "intent": data.get("intent")
                    })
                else:
                    print(f"{case['prompt'][:45]:<45} | {'ERROR':<8} | {'HTTP ' + str(resp.status_code):<10} | {duration:.2f}")
                    results.append({
                        "prompt": case["prompt"],
                        "passed": False,
                        "fail_reason": f"HTTP {resp.status_code}: {resp.text}",
                        "sources_count": 0,
                        "duration": duration
                    })
                    
            except Exception as e:
                print(f"{case['prompt'][:45]:<45} | {'EXC':<8} | {'ERROR':<10} | {0.00}")
                results.append({
                    "prompt": case["prompt"],
                    "passed": False,
                    "fail_reason": f"Exception: {str(e)}",
                    "sources_count": 0,
                    "duration": 0
                })

        # Summary
        print("-" * 110)
        passed_count = sum(1 for r in results if r["passed"])
        print(f"Total: {len(results)} | Passed: {passed_count} | Failed: {len(results) - passed_count}")
        
        # Save detailed report with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_path = f"chat_quality_report_{timestamp}.json"
        
        # Also update the 'latest' report for easy access
        latest_report_path = "chat_quality_report.json"
        
        with open(report_path, "w") as f:
            json.dump(results, f, indent=2)
            
        with open(latest_report_path, "w") as f:
            json.dump(results, f, indent=2)
            
        print(f"[*] Detailed report saved to {report_path}")
        print(f"[*] Latest report also updated at {latest_report_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run chat quality evaluation harness.")
    parser.add_argument("--prompt", type=str, help="Filter test cases by prompt text (case-insensitive substring match).")
    args = parser.parse_args()
    
    asyncio.run(run_tests(args.prompt))
