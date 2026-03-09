import json
import os
import time
from openai import OpenAI

client = OpenAI(
    api_key="",
    base_url="https://api.deepseek.com"
)

old_file = "chat_quality_report_20260308_231703.json"
new_file = "chat_quality_report_20260310_001153.json"

with open(old_file) as f:
    old_data = {item['prompt']: item for item in json.load(f)}

with open(new_file) as f:
    new_data = {item['prompt']: item for item in json.load(f)}

prompts = list(set(old_data.keys()).intersection(set(new_data.keys())))

changed_prompts = []
for p in prompts:
    old_resp = old_data[p].get('response_text', '')
    new_resp = new_data[p].get('response_text', '')
    if old_resp != new_resp:
        changed_prompts.append((p, old_resp, new_resp))

print(f"Evaluating {len(changed_prompts)} prompts...")

report = ["# Qualitative Evaluation Report\n"]

old_better = 0
new_better = 0
tie = 0

for i, (p, old_resp, new_resp) in enumerate(changed_prompts, 1):
    print(f"Evaluating {i}/{len(changed_prompts)}: {p}")
    prompt_text = f"""
You are an expert evaluator for a scuba diving chatbot.
The user asked: "{p}"

Evaluate these two responses independently based on:
1. Clarity and formatting (use of markdown, bullet points).
2. Detail and accuracy of diving information.
3. Helpfulness and tone.
4. Contextual awareness (e.g., location, constraints).

Response A (Old Architecture):
{old_resp}

Response B (New Architecture):
{new_resp}

Which response is better overall? Answer with exactly "OLD", "NEW", or "TIE" on the first line, followed by a brief 2-3 sentence justification on the following lines.
"""
    try:
        completion = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "You are a helpful, expert evaluator."},
                {"role": "user", "content": prompt_text}
            ],
            temperature=0.0
        )
        result = completion.choices[0].message.content.strip()
        lines = result.split('\n')
        winner = lines[0].strip().upper()
        if 'OLD' in winner:
            old_better += 1
            winner_str = "Old Architecture"
        elif 'NEW' in winner:
            new_better += 1
            winner_str = "New Architecture"
        else:
            tie += 1
            winner_str = "Tie"

        justification = '\n'.join(lines[1:]).strip()

        report.append(f"## Q{i}: {p}")
        report.append(f"**Winner:** {winner_str}")
        report.append(f"**Justification:**\n{justification}\n")
    except Exception as e:
        print(f"Error evaluating {p}: {e}")
        time.sleep(2)

report.append(f"\n## Summary")
report.append(f"Out of {len(changed_prompts)} changed responses:")
report.append(f"- Old Architecture was better: {old_better}")
report.append(f"- New Architecture was better: {new_better}")
report.append(f"- Tie: {tie}")

with open("qualitative_evaluation_report.md", "w") as f:
    f.write("\n".join(report))

print("Done. Wrote qualitative_evaluation_report.md")
