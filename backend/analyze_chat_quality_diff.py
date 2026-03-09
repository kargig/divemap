import json
import statistics
import random

old_file = "chat_quality_report_20260308_231703.json"
new_file = "chat_quality_report_20260310_001153.json"

with open(old_file) as f:
    old_data = {item['prompt']: item for item in json.load(f)}

with open(new_file) as f:
    new_data = {item['prompt']: item for item in json.load(f)}

prompts = list(set(old_data.keys()).intersection(set(new_data.keys())))

# Quantitative
old_passed = sum(1 for p in prompts if old_data[p].get('passed', False))
new_passed = sum(1 for p in prompts if new_data[p].get('passed', False))

old_durations = [old_data[p].get('duration', 0) for p in prompts]
new_durations = [new_data[p].get('duration', 0) for p in prompts]

print("=== Quantitative Analysis ===")
print(f"Total Prompts: {len(prompts)}")
print(f"Old Passed: {old_passed}/{len(prompts)} ({old_passed/len(prompts)*100:.1f}%)")
print(f"New Passed: {new_passed}/{len(prompts)} ({new_passed/len(prompts)*100:.1f}%)")
print(f"Old Avg Duration: {statistics.mean(old_durations):.2f}s")
print(f"New Avg Duration: {statistics.mean(new_durations):.2f}s")

# Changes in pass/fail
regressions = []
improvements = []
for p in prompts:
    o_pass = old_data[p].get('passed', False)
    n_pass = new_data[p].get('passed', False)
    if o_pass and not n_pass:
        regressions.append(p)
    elif not o_pass and n_pass:
        improvements.append(p)

print(f"\nImprovements (Failed -> Passed): {len(improvements)}")
for p in improvements:
    print(f"  - {p} (Old fail reason: {old_data[p].get('fail_reason')})")

print(f"\nRegressions (Passed -> Failed): {len(regressions)}")
for p in regressions:
    print(f"  - {p} (New fail reason: {new_data[p].get('fail_reason')})")

# Prepare blind evaluation sheet
eval_sheet = []
eval_key = {}
changed_count = 0

for i, p in enumerate(prompts):
    old_resp = old_data[p].get('response_text', '')
    new_resp = new_data[p].get('response_text', '')
    
    if old_resp == new_resp:
        continue # Identical, no need to evaluate
        
    changed_count += 1
    responses = [("Old", old_resp), ("New", new_resp)]
    random.shuffle(responses)
    
    eval_key[f"Q{i+1}"] = {
        "A": responses[0][0],
        "B": responses[1][0]
    }
    
    eval_sheet.append(f"## Q{i+1}: {p}")
    eval_sheet.append(f"### Response A")
    eval_sheet.append(responses[0][1])
    eval_sheet.append(f"\n### Response B")
    eval_sheet.append(responses[1][1])
    eval_sheet.append(f"\n---\n")

with open("blind_evaluation_sheet.md", "w") as f:
    f.write("\n".join(eval_sheet))

with open("blind_evaluation_key.json", "w") as f:
    json.dump(eval_key, f, indent=2)

print(f"\nGenerated blind evaluation sheet for {changed_count} questions with differences.")
