import re

def generate_report(input_file, output_file):
    file_counts = {}
    rule_counts = {}
    current_file = None

    try:
        with open(input_file, 'r') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                
                # Check if line is a file path (starts with / and contains src/divemap)
                if line.startswith('/') and 'src/divemap' in line:
                    current_file = line
                    # Normalize path to be relative to project root or frontend/ if possible
                    if '/frontend/' in current_file:
                        current_file = 'frontend/' + current_file.split('/frontend/', 1)[1]
                    file_counts[current_file] = 0
                
                # Check for warning/error line
                # Typical format: 87:82  warning  Empty block statement  no-empty
                elif current_file and (line.split(':')[0].strip().isdigit() or 'warning' in line or 'error' in line):
                    # It's a warning line
                    file_counts[current_file] += 1
                    
                    # Extract the rule name
                    # Split by whitespace. The rule name is typically the last element.
                    parts = line.split()
                    if len(parts) >= 3:
                        rule_name = parts[-1]
                        # Basic validation to ensure it looks like a rule name (usually has hyphens or slashes, no spaces)
                        # and ignore things that might be part of the message if parsing fails
                        if not rule_name.isdigit() and len(rule_name) > 2:
                            rule_counts[rule_name] = rule_counts.get(rule_name, 0) + 1

    except FileNotFoundError:
        print(f"Error: Input file '{input_file}' not found.")
        return

    # Sort Data
    sorted_files = sorted(file_counts.items(), key=lambda item: item[1], reverse=True)
    sorted_rules = sorted(rule_counts.items(), key=lambda item: item[1], reverse=True)
    
    total_warnings = sum(file_counts.values())

    with open(output_file, 'w') as f:
        f.write("Lint Warnings Report\n")
        f.write("====================\n\n")
        
        f.write(f"Total Warnings: {total_warnings}\n\n")

        # Section 1: Categories
        f.write("Warnings by Category (Rule)\n")
        f.write("---------------------------\n")
        f.write(f"{ 'Count':<10} | {'Rule Name'}\n")
        f.write(f"{'-'*10}-|-{'-'*50}\n")
        for rule, count in sorted_rules:
            f.write(f"{count:<10} | {rule}\n")
        
        f.write("\n\n")

        # Section 2: Files
        f.write("Warnings by File\n")
        f.write("----------------\n")
        f.write(f"{ 'Count':<10} | {'File Path'}\n")
        f.write(f"{'-'*10}-|-{'-'*60}\n")
        
        for file_path, count in sorted_files:
            if count > 0: # Only list files with warnings
                f.write(f"{count:<10} | {file_path}\n")

    print(f"Report generated: {output_file}")

if __name__ == "__main__":
    generate_report('frontend/lint-warnings_part2.txt', 'frontend/lint-report.txt')