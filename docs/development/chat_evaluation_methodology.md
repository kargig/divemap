# Chat Evaluation Methodology

This document outlines the standard operating procedure for evaluating changes to the Divemap agentic chat architecture. Because LLM outputs are inherently non-deterministic, we rely on a combination of automated quantitative testing and double-blind qualitative LLM-as-a-judge evaluation to ensure new features represent true improvements rather than regressions.

## Prerequisites
Ensure your environment is set up and your local backend is running (typically via Docker or local venv).
You must have a valid API key set in your `.env` file for the LLM judge to function. We currently use DeepSeek for evaluation:
```env
DEEPSEEK_API_KEY=your_api_key_here
```

## Step 1: Generate the Baseline (Old Architecture)
Before making architectural changes, you need to generate a baseline report of how the chatbot currently performs against the standardized test prompts.

Navigate to the `backend/` directory and run the test suite:
```bash
./divemap_venv/bin/python evaluate_chat_quality.py
```
This script acts as a simulated user. It hits the local chat API with ~40 standardized diving prompts (e.g., "what are some good dive sites in Egypt?").
It verifies that the chatbot successfully invoked tools, retrieved sources, and didn't throw errors.
**Output:** It generates a timestamped JSON file (e.g., `chat_quality_report_YYYYMMDD_HHMMSS.json`). Note this filename; it is your **Baseline File**.

## Step 2: Implement Changes
Make your code changes to `chat_service.py`, tool schemas, or executor logic. Run the standard unit tests to ensure nothing is fundamentally broken:
```bash
./docker-test-github-actions.sh
```

## Step 3: Generate the Target Report (New Architecture)
Run the evaluation suite again to capture how your new architecture handles the exact same prompts:
```bash
./divemap_venv/bin/python evaluate_chat_quality.py
```
**Output:** This generates a new timestamped JSON file. Note this filename; it is your **Target File**.

## Step 4: Quantitative Comparison
We need to see if the new architecture passes the same number of tests, how fast it is, and if there are any hard regressions.

1. Open `backend/analyze_chat_quality_diff.py` in your editor.
2. Update the filenames at the top of the file to match your Baseline and Target files:
   ```python
   old_file = "chat_quality_report_BASELINE.json"
   new_file = "chat_quality_report_TARGET.json"
   ```
3. Run the script:
   ```bash
   python3 analyze_chat_quality_diff.py
   ```
**Output:**
- Prints a terminal summary comparing Pass Rates, Latency, Improvements, and Regressions.
- Generates `blind_evaluation_sheet.md` and `blind_evaluation_key.json`. These files randomly shuffle the Old and New responses into "Response A" and "Response B" so human evaluators cannot be biased.

## Step 5: Qualitative LLM-as-a-Judge Evaluation
To determine which text responses are actually *better* in formatting, tone, and accuracy, we use an LLM as a judge.

1. Open `backend/evaluate_qualitative.py` in your editor.
2. Update the filenames at the top of the file to match your Baseline and Target files (same as Step 4).
3. Run the evaluation (this requires your `DEEPSEEK_API_KEY`):
   ```bash
   ./divemap_venv/bin/python evaluate_qualitative.py
   ```
**Output:**
This script feeds the randomized A/B responses to the LLM judge. The judge evaluates them based on:
1. Clarity and formatting (markdown, bullet points).
2. Detail and accuracy of diving information.
3. Helpfulness and tone.
4. Contextual awareness (location, constraints).

It outputs a comprehensive markdown report to `backend/qualitative_evaluation_report.md`.

## Step 6: Review the Results
Open `qualitative_evaluation_report.md`.
- At the bottom, you will see a summary (e.g., "New Architecture Wins: 28, Old Architecture Wins: 10").
- If the new architecture wins significantly, your changes are a success.
- If the old architecture wins in certain categories, review the LLM judge's "Justification" to understand what context or formatting was lost in your new code, and iterate!
