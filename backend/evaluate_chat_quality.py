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
ADMIN_PAT = os.getenv("ADMIN_PAT")

# Test Cases
# Ordered by complexity: Simple intents -> Basic Tools -> Complex Discovery -> Calculators -> Agentic Multi-Step/Clarification
TEST_CASES = [
    # Tier 1: Simple Knowledge & Chit-Chat
    {"prompt": "tell me a joke about diving", "type": "chit_chat", "expected_min_sources": 0},
    {"prompt": "what are the requirements for the Rescue Diver certification?", "type": "knowledge", "expected_min_sources": 1},
    {"prompt": "what comes after Open Water in SSI?", "type": "career_path", "expected_min_sources": 1},
    {"prompt": "PADI courses in Greece", "type": "career_path", "expected_min_sources": 1},
    {"prompt": "what is the difference between PADI TEC45 and SSI XR?", "type": "comparison", "expected_min_sources": 1},

    # Tier 2: Single Tool Execution (Direct Mapping)
    {"prompt": "show me sites with octopus", "type": "marine_life", "expected_min_sources": 1},
    {"prompt": "where can I see monk seals in Greece?", "type": "marine_life", "expected_min_sources": 1},
    {"prompt": "dive sites with turtles near Zakynthos", "type": "marine_life", "expected_min_sources": 1},
    {"prompt": "how much to rent a tank in Attica?", "type": "gear_rental", "expected_min_sources": 1},
    {"prompt": "cost to rent BCD in Naxos", "type": "gear_rental", "expected_min_sources": 1},
    {"prompt": "diving centers in Paros", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "where can I find a PADI diving center in Athens?", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "diving centers offering nitrox in Crete", "type": "discovery", "expected_min_sources": 1},

    # Tier 3: Discovery with Filters (Spatial/Text Parsing)
    {"prompt": "find dive sites near Peloponnese", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "what are some good dive sites in Egypt?", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "is there diving in Santorini?", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "history of the wreck Kyra Leni", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "what are some good shore dive sites in Athens", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "show me deep dives in Attica", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "cave diving in Greece", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "boat dives near Sounio", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "wrecks near Makronisos", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "do you know any snorkeling spots in Naxos ?", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "best diving in Crete", "type": "discovery", "expected_min_sources": 1},

    # Tier 4: Complex Spatial & Contextual Queries (Agentic Heavy)
    {"prompt": "dive sites near Porto Ennea", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "where can I find brain corals in the Red Sea ?", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "give me a list of 10 dive sites in the South of Athens", "type": "discovery", "expected_min_sources": 2},
    {"prompt": "give me a list of 5 dive sites east of Attica", "type": "discovery", "expected_min_sources": 3},
    {"prompt": "find dive sites in the south of Attica near Anavyssos", "type": "discovery", "expected_min_sources": 2},
    {"prompt": "give me dive sites in the south of Anavyssos", "type": "discovery", "expected_min_sources": 1},
    {"prompt": "What are nearby dive sites to legrena car wrecks ?", "type": "discovery", "expected_min_sources": 5},

    # Tier 5: Physics Calculators (Parameter Mapping & Engine)
    {"prompt": "What is the MOD for 32% Nitrox?", "type": "calculator", "expected_min_sources": 1},
    {"prompt": "Calculate my SAC rate if I used 50 bar from a 12L tank in 30 mins at 15m depth.", "type": "calculator", "expected_min_sources": 1},
    {"prompt": "What is the best nitrox mix for a dive to 30 meters?", "type": "calculator", "expected_min_sources": 1},
    {"prompt": "Calculate minimum gas reserve for a 30m dive, 10 min duration, SAC 15, tank 12L.", "type": "calculator", "expected_min_sources": 1},

    # Tier 6: Ambiguity & Multi-Step Logic (The true test of the loop)
    {"prompt": "weather for diving in Anavyssos tomorrow", "type": "weather", "expected_min_sources": 1},
    {"prompt": "is it safe to dive at Kyra Leni tomorrow at 10:00?", "type": "weather", "expected_min_sources": 1},
    {"prompt": "recommend a dive site for advanced divers near me", "type": "personal_recommendation", "expected_min_sources": 1},
    {"prompt": "Find me a dive site.", "type": "clarification", "expected_min_sources": 0},
    {"prompt": "I want to rent gear.", "type": "clarification", "expected_min_sources": 0},
]

async def login(client):
    """Authenticate with the API using a Personal Access Token."""
    if not ADMIN_PAT:
        print("[!] ADMIN_PAT not set in environment. CLI authentication requires a Personal Access Token.")
        print("[*] Create one in your Profile under API Access.")
        return None

    print("[*] Using Personal Access Token (PAT) for authentication...")
    return ADMIN_PAT

async def run_tests(filter_prompt=None, filter_type=None):
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=60.0) as client:
        token = await login(client)
        if not token:
            print("[!] Could not obtain auth token. Exiting.")
            sys.exit(1)

        headers = {"Authorization": f"Bearer {token}"}

        # Filter test cases if prompt or type provided
        cases_to_run = TEST_CASES
        if filter_prompt:
            cases_to_run = [case for case in cases_to_run if filter_prompt.lower() in case["prompt"].lower()]
            if not cases_to_run:
                print(f"[!] No test cases matched prompt filter: '{filter_prompt}'")
                return
        if filter_type:
            cases_to_run = [case for case in cases_to_run if case.get("type") == filter_type]
            if not cases_to_run:
                print(f"[!] No test cases matched type filter: '{filter_type}'")
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
                        if phrase.lower() in response_text.lower() and case["type"] not in ["chit_chat", "clarification"]:
                            passed = False
                            fail_reason = f"Contains negative phrase: '{phrase}'"

                    status_str = "PASS" if passed else "FAIL"

                    print(f"{case['prompt'][:45]:<45} | {sources_count:<8} | {status_str:<10} | {duration:.2f}")

                    results.append({
                        "prompt": case["prompt"],
                        "passed": passed,
                        "fail_reason": fail_reason,
                        "sources_count": sources_count,
                        "sources": sources,
                        "response_text": response_text,
                        "base_url": BASE_URL,
                        "duration": duration,
                        "intent": data.get("intermediate_steps")[0]["tool_args"] if data.get("intermediate_steps") else None
                    })
                else:
                    print(f"{case['prompt'][:45]:<45} | {'ERROR':<8} | {'HTTP ' + str(resp.status_code):<10} | {duration:.2f}")
                    results.append({
                        "prompt": case["prompt"],
                        "passed": False,
                        "fail_reason": f"HTTP {resp.status_code}: {resp.text}",
                        "sources_count": 0,
                        "sources": [],
                        "response_text": "",
                        "base_url": BASE_URL,
                        "duration": duration
                    })

            except Exception as e:
                print(f"{case['prompt'][:45]:<45} | {'EXC':<8} | {'ERROR':<10} | {0.00}")
                results.append({
                    "prompt": case["prompt"],
                    "passed": False,
                    "fail_reason": f"Exception: {str(e)}",
                    "sources_count": 0,
                    "sources": [],
                    "response_text": "",
                    "base_url": BASE_URL,
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
    parser.add_argument("--type", type=str, help="Filter test cases by type (e.g., 'calculator', 'discovery', 'weather').")
    args = parser.parse_args()

    asyncio.run(run_tests(args.prompt, args.type))
