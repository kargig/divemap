#!/usr/bin/env python3

import urllib.request
import json
import sys
import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend" / "src"

# 1. Fetch OpenAPI schema from backend
try:
    req = urllib.request.Request("http://localhost:8000/openapi.json")
    with urllib.request.urlopen(req) as response:
        openapi_data = json.loads(response.read().decode('utf-8'))
except Exception as e:
    print(f"Failed to fetch OpenAPI schema from backend: {e}")
    print("Ensure the backend is running at http://localhost:8000")
    sys.exit(1)

# 2. Extract backend routes from OpenAPI schema
backend_routes = []
paths = openapi_data.get("paths", {})

for path, methods in paths.items():
    for method in methods.keys():
        if method.lower() not in ("head", "options"):
            # Convert OpenAPI path params {id} to regex [^/]+
            # e.g., /api/v1/diving-centers/{diving_center_id} -> ^/api/v1/diving-centers/[^/]+/?$
            path_regex = re.sub(r'\{[^}]+\}', '[^/]+', path)
            
            # Allow optional trailing slash
            if path_regex.endswith('/'):
                path_regex = path_regex + '?'
            else:
                path_regex = path_regex + '/?'
                
            backend_routes.append({
                "method": method.lower(),
                "path": path,
                "regex": re.compile(f"^{path_regex}$")
            })

# 3. Scan frontend files
# Matches api.get('/path'), api.post(`/path/${id}`), etc. Stops at ?, ', ", or `
# The regex looks for:
# api.method( ' or " or `
# Then captures everything until ?, ', ", ` or newline
api_call_pattern = re.compile(r'api\.(get|post|put|patch|delete)\(\s*[\'"`]([^`\'"?\n]+)')

errors = []

for filepath in FRONTEND_DIR.rglob('*.[jt]s*'):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        matches = api_call_pattern.finditer(content)
        for match in matches:
            method = match.group(1).lower()
            raw_url = match.group(2)
            
            # Replace JS template variables ${var} with a dummy string that matches [^/]+
            cleaned_url = re.sub(r'\$\{[^}]+\}', 'SOME_PARAM', raw_url)
            
            # Check against backend routes
            matched = False
            for route in backend_routes:
                if route['method'] == method and route['regex'].match(cleaned_url):
                    matched = True
                    break
            
            if not matched:
                errors.append({
                    "file": filepath.relative_to(PROJECT_ROOT),
                    "method": method.upper(),
                    "url": raw_url,
                    "cleaned_url": cleaned_url
                })

# Print Results
if errors:
    print(f"❌ Found {len(errors)} API contract mismatches:\n")
    for err in errors:
        print(f"File: {err['file']}")
        print(f"Call: {err['method']} {err['url']}")
        print("-" * 40)
    sys.exit(1)
else:
    print("✅ All frontend API calls match a valid backend route!")
    sys.exit(0)
