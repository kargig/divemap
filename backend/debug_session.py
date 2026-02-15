import asyncio
import httpx
import json
import os
import sys

# Configuration
# NOTE: This targets the production API as requested
BASE_URL = "https://divemap.gr" 
API_PREFIX = "/api/v1"
SESSION_ID = "52af2018-515b-4f46-bfab-45c044638115"

# Credentials (from environment)
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

async def login(client):
    if not ADMIN_USERNAME or not ADMIN_PASSWORD:
        print("[!] ADMIN_USERNAME or ADMIN_PASSWORD not set in environment.")
        return None
        
    print(f"[*] Logging in as {ADMIN_USERNAME} to {BASE_URL}...")
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

async def fetch_session_details(token):
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        headers = {"Authorization": f"Bearer {token}"}
        
        print(f"[*] Fetching session details for {SESSION_ID}...")
        try:
            resp = await client.get(f"{API_PREFIX}/admin/chat/sessions/{SESSION_ID}", headers=headers)
            
            if resp.status_code == 200:
                data = resp.json()
                
                print(f"[*] Session found for user: {data.get('user', {}).get('username', 'Unknown')}")
                print(f"[*] Total messages: {len(data.get('messages', []))}")
                
                # Find the specific user message mentioned
                target_prompt = "Can you check weather conditions for tomorrow morning around Athens, for a shore dive? Make a proposal for a dive spot according to weather conditions"
                
                found_target = False
                for i, msg in enumerate(data.get('messages', [])):
                    # Check if this message roughly matches the prompt (ignoring case/whitespace)
                    if msg['role'] == 'user' and target_prompt.lower() in msg['content'].lower():
                        found_target = True
                        print("\n" + "="*80)
                        print(f"TARGET MESSAGE FOUND (ID: {msg['id']})")
                        print(f"Content: {msg['content']}")
                        print(f"Debug Data (Intent):")
                        print(json.dumps(msg.get('debug_data'), indent=2))
                        
                        # Look at the NEXT message (Assistant response)
                        if i + 1 < len(data['messages']):
                            assistant_msg = data['messages'][i+1]
                            print("\n" + "-"*80)
                            print(f"ASSISTANT RESPONSE (ID: {assistant_msg['id']})")
                            print(f"Content:\n{assistant_msg['content']}")
                            print("\nDEBUG DATA (Sources & Context):")
                            # The assistant message debug_data usually contains the 'sources' used
                            print(json.dumps(assistant_msg.get('debug_data'), indent=2))
                            
                            # Analyze sources vs hallucinations
                            response_text = assistant_msg['content']
                            sources = assistant_msg.get('debug_data', {}).get('sources', [])
                            
                            # Check specific hallucinations mentioned
                            print("\nANALYSIS:")
                            check_hallucination(response_text, sources, "Varkiza", "/dive-sites/15")
                            check_hallucination(response_text, sources, "Kavouri", "/dive-sites/14")
                            
                        else:
                            print("[!] No assistant response found following this message.")
                        print("="*80 + "\n")
                        
                if not found_target:
                    print(f"[!] Target prompt not found in session.")
                    # Dump all messages just in case
                    print("All messages in session:")
                    for msg in data.get('messages', []):
                        print(f"[{msg['role']}] {msg['content'][:50]}...")

            else:
                print(f"[!] Failed to fetch session: {resp.status_code} - {resp.text}")
                
        except Exception as e:
            print(f"[!] API error: {e}")

def check_hallucination(text, sources, name, link):
    if link in text:
        print(f"[*] Found link '{link}' for '{name}' in response.")
        # Check if this ID exists in sources
        found_in_source = False
        source_name = "Unknown"
        
        # Extract ID from link
        try:
            site_id = int(link.split('/')[-1])
            for source in sources:
                if source.get('entity_type') == 'dive_site' and source.get('id') == site_id:
                    found_in_source = True
                    source_name = source.get('name')
                    break
            
            if found_in_source:
                if name.lower() in source_name.lower():
                    print(f"    - VALID: Source {site_id} is '{source_name}' matches text '{name}'")
                else:
                    print(f"    - MISMATCH: Source {site_id} is '{source_name}' BUT text says '{name}'")
            else:
                print(f"    - HALLUCINATION: ID {site_id} NOT found in sources!")
        except:
            print(f"    - Error parsing link ID")

async def main():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        token = await login(client)
        if token:
            await fetch_session_details(token)

if __name__ == "__main__":
    asyncio.run(main())
