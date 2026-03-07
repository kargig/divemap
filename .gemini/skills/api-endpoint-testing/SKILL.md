---
name: api-endpoint-testing
description: Standard procedure for testing authenticated FastAPI endpoints via curl in the CLI. Use this when verifying backend logic without a frontend, or when debugging authentication/permission issues.
---

# API Endpoint Testing

This skill defines the standard workflow for testing protected FastAPI endpoints directly from the command line using `curl`. This is essential for verifying backend changes in isolation.

## Prerequisites

-   Access to the running backend (usually `http://localhost:8000`).
-   Valid credentials. Check the `local_testme` file in the root directory if it exists, otherwise ask the user.
-   `jq` installed (highly recommended for JSON parsing).

## 1. Authentication (Get Token)

First, obtain a JWT access token. Always check `local_testme` for current credentials.

```bash
# 1. Retrieve credentials (manual check or automate)
# Example manual check:
# cat local_testme

# 2. Capture token in a variable
# Replace 'admin' and 'PASSWORD' with actual credentials
TOKEN=$(curl -s -X POST 'http://localhost:8000/api/v1/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"username": "admin", "password": "YOUR_PASSWORD"}' \
  | jq -r '.access_token')

# 3. Verify token exists
if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "Error: Failed to obtain token"
  exit 1
fi
echo "Token obtained: ${TOKEN:0:15}..."
```

*Note: If the endpoint uses `x-www-form-urlencoded` (standard OAuth2 form), change `-H` to `application/x-www-form-urlencoded` and `-d` to `username=admin&password=...`.*

## 2. Making Authenticated Requests

Use the `$TOKEN` in the `Authorization` header.

### GET Request
```bash
curl -s -X GET "http://localhost:8000/api/v1/users/me" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq .
```

### POST Request (JSON Body)
```bash
curl -s -X POST "http://localhost:8000/api/v1/chat/message" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Find dive sites near Athens",
    "user_location": [37.9838, 23.7275]
  }' | jq .
```

## 3. Debugging Tips

*   **401 Unauthorized**: Token is expired or missing. Re-login to get a fresh token.
*   **422 Unprocessable Entity**: The JSON body is invalid or missing required fields.
    *   *Check*: Did you pass a list `[]` instead of an object `{}`? Or vice-versa?
    *   *Check*: Are the field names correct?
*   **500 Internal Error**: Check backend logs immediately.
    *   `docker-compose logs --tail=50 backend`

## One-Liner for Quick Checks

If you just need to hit an endpoint quickly without setting variables:

```bash
# Edit username/password as needed
curl -s http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer $(curl -s -X POST 'http://localhost:8000/api/v1/auth/login' -H 'Content-Type: application/json' -d '{"username":"admin","password":"YOUR_PASSWORD"}' | jq -r .access_token)" \
  | jq .
```
