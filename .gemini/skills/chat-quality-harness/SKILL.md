# Chat Quality Harness

## Description
This skill explains how to run the automated chat quality evaluation harness (`backend/evaluate_chat_quality.py`). This harness tests the Divemap chatbot against a set of predefined prompts to verify it returns relevant data sources and avoids "I don't know" responses when data is actually available. Use this when refactoring search logic, tuning LLM prompts, or adding new features to the chatbot.

## Usage
Use this skill when you need to:
- Verify that changes to the chatbot code haven't regressed search quality.
- Test if the chatbot correctly finds entities (dive sites, centers) for specific queries.
- Ensure the chatbot is returning data sources instead of "no information" messages.
- Benchmark response times.

## Prerequisites
- **Admin Credentials:** The harness requires an admin account to bypass rate limits. These should be available in a `local_testme` file in the project root (not committed to git).
- **Python Environment:** Requires the backend virtual environment.
- **Docker:** The backend and database must be running (`docker-compose up -d`).

## Instructions

### 1. Prepare Environment
Ensure the local development stack is running:
```bash
docker-compose up -d
```

### 2. Run the Harness
Use the following command to source your local admin credentials and run the evaluation script. This assumes you have a `local_testme` file with `ADMIN_USERNAME` and `ADMIN_PASSWORD` exports.

```bash
source local_testme && 
ADMIN_USERNAME=$ADMIN_USERNAME ADMIN_PASSWORD=$ADMIN_PASSWORD 
backend/divemap_venv/bin/python backend/evaluate_chat_quality.py
```

**Note:** The script will automatically log in as the admin user to bypass the standard `5/minute` rate limit, allowing for faster execution of the test suite.

### 3. Interpret Results
The script prints a summary table to the console:
- **SOURCES:** Number of data items (sites, centers, etc.) returned by the backend search logic.
- **STATUS:** `PASS` if sources > expected AND no negative phrases found. `FAIL` otherwise.
- **TIME:** Execution time for the request.

A detailed report is saved to `chat_quality_report.json`.
- Check `fail_reason` for failed tests.
- Inspect `response_snippet` to see what the bot actually said.
- Review `intent` to see how the LLM parsed the user's prompt (keywords, location, radius).

### 4. modifying the Harness
To add new test cases or adjust expectations, edit `backend/evaluate_chat_quality.py`:

```python
TEST_CASES = [
    # ... existing cases ...
    {"prompt": "your new test prompt", "type": "discovery", "expected_min_sources": 1},
]
```

- `type`: Matches the intent type (discovery, marine_life, gear_rental, etc.).
- `expected_min_sources`: Minimum number of database items expected in the response. Set to 0 for "chit_chat" or negative tests.
