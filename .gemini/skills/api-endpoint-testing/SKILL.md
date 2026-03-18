---
name: api-endpoint-testing
description: Standard procedure for testing authenticated FastAPI endpoints via curl in the CLI. Use this when verifying backend logic without a frontend, or when debugging authentication/permission issues.
---

# API Endpoint Testing

This skill defines the standard workflow for testing protected FastAPI endpoints directly from the command line using `curl`. This is essential for verifying backend changes in isolation.

## Prerequisites

-   Access to the running backend (usually `http://localhost:8000`).
-   A **Personal Access Token (PAT)**. Create one in your Profile under **API Access**.
-   `jq` installed (highly recommended for JSON parsing).

## 1. Authentication (Personal Access Token)

Personal Access Tokens are the preferred way to interact with the API from the command line, as they bypass the Cloudflare Turnstile requirement mandatory for standard web logins.

```bash
# Set your token in a variable
# Replace with your actual token (starts with dm_pat_)
TOKEN="dm_pat_your_token_here"

# Verify the token works
curl -s -X GET "http://localhost:8000/api/v1/auth/me" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

## 2. Making Authenticated Requests

Use the `$TOKEN` in the `Authorization` header.

### GET Request
```bash
curl -s -X GET "http://localhost:8000/api/v1/dives/me" \
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

*   **401 Unauthorized**: Token is invalid, expired, or missing the `dm_pat_` prefix.
*   **400 Bad Request (Turnstile)**: You are trying to hit `/login` or `/register` directly without a Turnstile token. Use a PAT instead for CLI operations.
*   **422 Unprocessable Entity**: The JSON body is invalid or missing required fields.
*   **500 Internal Error**: Check backend logs immediately.
    *   `docker-compose logs --tail=50 backend`

## One-Liner for Quick Checks

```bash
curl -s http://localhost:8000/api/v1/auth/me -H "Authorization: Bearer $PAT_TOKEN" | jq .
```

