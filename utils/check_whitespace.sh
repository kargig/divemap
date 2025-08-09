#!/bin/bash
# Script to check for trailing whitespace in all relevant files
# This script is part of the pre-commit validation process

set -e

echo "🔍 Checking for trailing whitespace..."

# Define file patterns to check
PYTHON_FILES=$(find . -name "*.py" -not -path "./venv/*" -not -path "./divemap_venv/*" -not -path "./htmlcov/*" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./backend/divemap_venv/*" -not -path "./frontend/node_modules/*" -not -path "*/divemap_venv/*" 2>/dev/null || true)
JS_FILES=$(find . -name "*.js" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./htmlcov/*" -not -path "./frontend/node_modules/*" -not -path "./backend/divemap_venv/*" -not -path "*/divemap_venv/*" 2>/dev/null || true)
JSX_FILES=$(find . -name "*.jsx" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./htmlcov/*" -not -path "./frontend/node_modules/*" -not -path "./backend/divemap_venv/*" -not -path "*/divemap_venv/*" 2>/dev/null || true)
MD_FILES=$(find . -name "*.md" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./htmlcov/*" -not -path "./frontend/node_modules/*" -not -path "./backend/divemap_venv/*" -not -path "*/divemap_venv/*" 2>/dev/null || true)
TXT_FILES=$(find . -name "*.txt" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./htmlcov/*" -not -path "./frontend/node_modules/*" -not -path "./backend/divemap_venv/*" -not -path "*/divemap_venv/*" 2>/dev/null || true)

# Check for trailing whitespace
echo "Checking Python files..."
if [ ! -z "$PYTHON_FILES" ]; then
    PYTHON_ISSUES=$(grep -lE '[[:blank:]]+$' $PYTHON_FILES 2>/dev/null || true)
    if [ ! -z "$PYTHON_ISSUES" ]; then
        echo "  Found trailing whitespace in Python files:"
        for file in $PYTHON_ISSUES; do
            echo "    $file:"
            grep -nE '[[:blank:]]+$' "$file" 2>/dev/null | head -3 | sed 's/^/      /'
            if [ $(grep -cE '[[:blank:]]+$' "$file" 2>/dev/null || echo 0) -gt 3 ]; then
                echo "      ... and $(($(grep -cE '[[:blank:]]+$' "$file" 2>/dev/null || echo 0) - 3)) more lines"
            fi
        done
    fi
else
    PYTHON_ISSUES=""
    echo "  No Python files found"
fi

echo "Checking JavaScript files..."
if [ ! -z "$JS_FILES" ]; then
    JS_ISSUES=$(grep -lE '[[:blank:]]+$' $JS_FILES 2>/dev/null || true)
    if [ ! -z "$JS_ISSUES" ]; then
        echo "  Found trailing whitespace in JavaScript files:"
        for file in $JS_ISSUES; do
            echo "    $file:"
            grep -nE '[[:blank:]]+$' "$file" 2>/dev/null | head -3 | sed 's/^/      /'
            if [ $(grep -cE '[[:blank:]]+$' "$file" 2>/dev/null || echo 0) -gt 3 ]; then
                echo "      ... and $(($(grep -cE '[[:blank:]]+$' "$file" 2>/dev/null || echo 0) - 3)) more lines"
            fi
        done
    fi
else
    JS_ISSUES=""
    echo "  No JavaScript files found"
fi

echo "Checking JSX files..."
if [ ! -z "$JSX_FILES" ]; then
    JSX_ISSUES=$(grep -lE '[[:blank:]]+$' $JSX_FILES 2>/dev/null || true)
    if [ ! -z "$JSX_ISSUES" ]; then
        echo "  Found trailing whitespace in JSX files:"
        for file in $JSX_ISSUES; do
            echo "    $file:"
            grep -nE '[[:blank:]]+$' "$file" 2>/dev/null | head -3 | sed 's/^/      /'
            if [ $(grep -cE '[[:blank:]]+$' "$file" 2>/dev/null || echo 0) -gt 3 ]; then
                echo "      ... and $(($(grep -cE '[[:blank:]]+$' "$file" 2>/dev/null || echo 0) - 3)) more lines"
            fi
        done
    fi
else
    JSX_ISSUES=""
    echo "  No JSX files found"
fi

echo "Checking Markdown files..."
if [ ! -z "$MD_FILES" ]; then
    MD_ISSUES=$(grep -lE '[[:blank:]]+$' $MD_FILES 2>/dev/null || true)
    if [ ! -z "$MD_ISSUES" ]; then
        echo "  Found trailing whitespace in Markdown files:"
        for file in $MD_ISSUES; do
            echo "    $file:"
            grep -nE '[[:blank:]]+$' "$file" 2>/dev/null | head -3 | sed 's/^/      /'
            if [ $(grep -cE '[[:blank:]]+$' "$file" 2>/dev/null || echo 0) -gt 3 ]; then
                echo "      ... and $(($(grep -cE '[[:blank:]]+$' "$file" 2>/dev/null || echo 0) - 3)) more lines"
            fi
        done
    fi
else
    MD_ISSUES=""
    echo "  No Markdown files found"
fi

echo "Checking Text files..."
if [ ! -z "$TXT_FILES" ]; then
    TXT_ISSUES=$(grep -lE '[[:blank:]]+$' $TXT_FILES 2>/dev/null || true)
    if [ ! -z "$TXT_ISSUES" ]; then
        echo "  Found trailing whitespace in Text files:"
        for file in $TXT_ISSUES; do
            echo "    $file:"
            grep -nE '[[:blank:]]+$' "$file" 2>/dev/null | head -3 | sed 's/^/      /'
            if [ $(grep -cE '[[:blank:]]+$' "$file" 2>/dev/null || echo 0) -gt 3 ]; then
                echo "      ... and $(($(grep -cE '[[:blank:]]+$' "$file" 2>/dev/null || echo 0) - 3)) more lines"
            fi
        done
    fi
else
    TXT_ISSUES=""
    echo "  No Text files found"
fi

# Combine all issues
ALL_ISSUES=""
if [ ! -z "$PYTHON_ISSUES" ]; then
    ALL_ISSUES="$ALL_ISSUES$PYTHON_ISSUES"$'\n'
fi
if [ ! -z "$JS_ISSUES" ]; then
    ALL_ISSUES="$ALL_ISSUES$JS_ISSUES"$'\n'
fi
if [ ! -z "$JSX_ISSUES" ]; then
    ALL_ISSUES="$ALL_ISSUES$JSX_ISSUES"$'\n'
fi
if [ ! -z "$MD_ISSUES" ]; then
    ALL_ISSUES="$ALL_ISSUES$MD_ISSUES"$'\n'
fi
if [ ! -z "$TXT_ISSUES" ]; then
    ALL_ISSUES="$ALL_ISSUES$TXT_ISSUES"$'\n'
fi

# Check if any issues were found
if [ ! -z "$ALL_ISSUES" ]; then
    echo "❌ Trailing whitespace found in the following files:"
    echo "$ALL_ISSUES" | sort | uniq
    echo ""
    echo "To fix trailing whitespace, run:"
    echo "  ./utils/fix_whitespace.sh"
    echo ""
    echo "Or manually remove trailing whitespace from the files listed above."
    exit 1
else
    echo "✅ No trailing whitespace found!"
    exit 0
fi
