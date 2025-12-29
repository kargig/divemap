#!/bin/bash
# Script to fix trailing whitespace in all relevant files or a specific file
# This script automatically removes trailing spaces and tabs

set -e

# Function to fix trailing whitespace in files
fix_whitespace() {
    local files="$1"
    local file_type="$2"
    
    if [ ! -z "$files" ]; then
        if [ "$file_type" != "Specified" ]; then
            echo "Fixing $file_type files..."
        fi
        for file in $files; do
            if [ -f "$file" ]; then
                # Create a backup
                cp "$file" "$file.bak"
                
                # Remove trailing whitespace using sed
                sed -i 's/[[:blank:]]*$//' "$file"
                
                # Check if file was modified
                if ! cmp -s "$file" "$file.bak"; then
                    echo "  ✅ Fixed: $file"
                    rm "$file.bak"
                else
                    if [ "$file_type" == "Specified" ] || [ "$file_type" == "Single" ]; then
                        echo "  ⏭️  No changes needed: $file"
                    else
                        # Optional: uncomment to see skipped files in batch mode
                        # echo "  ⏭️  No changes needed: $file"
                        :
                    fi
                    rm "$file.bak"
                fi
            fi
        done
    else
        if [ "$file_type" != "Specified" ]; then
            echo "No $file_type files found to fix."
        fi
    fi
}

# If a file argument is provided, only fix that file
if [ ! -z "$1" ]; then
    if [ -f "$1" ]; then
        echo "🧹 Fixing trailing whitespace in $1..."
        fix_whitespace "$1" "Specified"
        echo "✅ Done."
    else
        echo "❌ Error: File $1 not found."
        exit 1
    fi
    exit 0
fi

echo "🧹 Fixing trailing whitespace in project..."

# Define file patterns to fix
PYTHON_FILES=$(find . -name "*.py" -not -path "./venv/*" -not -path "./divemap_venv/*" -not -path "./htmlcov/*" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./backend/divemap_venv/*" -not -path "./frontend/node_modules/*" -not -path "*/divemap_venv/*" 2>/dev/null || true)
JS_FILES=$(find . -name "*.js" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./htmlcov/*" -not -path "./frontend/node_modules/*" -not -path "./backend/divemap_venv/*" -not -path "*/divemap_venv/*" 2>/dev/null || true)
JSX_FILES=$(find . -name "*.jsx" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./htmlcov/*" -not -path "./frontend/node_modules/*" -not -path "./backend/divemap_venv/*" -not -path "*/divemap_venv/*" 2>/dev/null || true)
MD_FILES=$(find . -name "*.md" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./htmlcov/*" -not -path "./frontend/node_modules/*" -not -path "./backend/divemap_venv/*" -not -path "*/divemap_venv/*" 2>/dev/null || true)
TXT_FILES=$(find . -name "*.txt" -not -path "./venv/*" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./htmlcov/*" -not -path "./frontend/node_modules/*" -not -path "./backend/divemap_venv/*" -not -path "*/divemap_venv/*" 2>/dev/null || true)

# Fix trailing whitespace in all file types
if [ ! -z "$PYTHON_FILES" ]; then
    fix_whitespace "$PYTHON_FILES" "Python"
else
    echo "No Python files found to fix."
fi

if [ ! -z "$JS_FILES" ]; then
    fix_whitespace "$JS_FILES" "JavaScript"
else
    echo "No JavaScript files found to fix."
fi

if [ ! -z "$JSX_FILES" ]; then
    fix_whitespace "$JSX_FILES" "JSX"
else
    echo "No JSX files found to fix."
fi

if [ ! -z "$MD_FILES" ]; then
    fix_whitespace "$MD_FILES" "Markdown"
else
    echo "No Markdown files found to fix."
fi

if [ ! -z "$TXT_FILES" ]; then
    fix_whitespace "$TXT_FILES" "Text"
else
    echo "No Text files found to fix."
fi

echo ""
echo "✅ Trailing whitespace fix completed!"
echo ""
echo "To verify the fix, run:"
echo "  ./utils/check_whitespace.sh"