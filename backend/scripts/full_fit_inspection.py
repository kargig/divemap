import fitdecode
import sys
from collections import defaultdict

def detailed_inspect_fit(file_path):
    print(f"\n{'='*60}")
    print(f"FILE: {file_path}")
    print(f"{'='*60}")
    
    # Message types we want to see EVERY instance of
    EXHAUSTIVE_MSGS = {'dive_gas', 'dive_summary', 'dive_settings', 'session', 'device_info', 'activity', 'event'}
    
    # Store field names for other message types (summary view)
    summary_messages = defaultdict(set)
    summary_samples = {}

    with fitdecode.FitReader(file_path) as fit:
        for frame in fit:
            if frame.frame_type == fitdecode.FIT_FRAME_DATA:
                msg_name = frame.name
                
                if msg_name in EXHAUSTIVE_MSGS:
                    print(f"\n>>> MESSAGE: {msg_name}")
                    for field in frame.fields:
                        val = field.value
                        val_str = str(val)
                        if len(val_str) > 100: val_str = val_str[:97] + "..."
                        print(f"  - {field.name}: {val_str}")
                else:
                    for field in frame.fields:
                        summary_messages[msg_name].add(field.name)
                        if field.value is not None:
                            summary_samples[(msg_name, field.name)] = field.value

    print(f"\n\n{'='*60}")
    print("SUMMARY OF OTHER MESSAGES (One sample each)")
    print(f"{'='*60}")
    for msg in sorted(summary_messages.keys()):
        print(f"\n[{msg}]")
        for field_name in sorted(summary_messages[msg]):
            val = summary_samples.get((msg, field_name), "None")
            val_str = str(val)
            if len(val_str) > 60: val_str = val_str[:57] + "..."
            print(f"  - {field_name}: {val_str}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 inspect.py <file1.fit> [file2.fit ...]")
        sys.exit(1)
    
    for arg in sys.argv[1:]:
        detailed_inspect_fit(arg)
