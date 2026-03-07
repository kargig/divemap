---
name: serena
description: Guide for using Serena effectively. Use when performing complex coding tasks, understanding codebase architecture, or needing semantic code navigation and editing capabilities.
---

# Serena Usage Guide

Serena is a powerful coding agent designed for resource-efficient, semantic code manipulation. It excels at understanding code structure without needing to read entire files, making it highly token-efficient for large codebases.

## Core Philosophy: Token Efficiency & Semantic Understanding

**Do not read entire files unless absolutely necessary.**

Instead, use Serena's symbolic tools to:
1.  **Survey**: Get a high-level overview of a file's structure (`get_symbols_overview`).
2.  **Target**: Locate specific functions, classes, or methods (`find_symbol`).
3.  **Contextualize**: Understand how symbols are used (`find_referencing_symbols`).
4.  **Edit**: precise modifications at the symbol level (`replace_symbol_body`) or file level (`replace_content`).

## Workflow: The Serena Loop

1.  **Onboard/Activate**: Ensure the project is active (`activate_project`) and onboarded (`onboarding`). Read project memories (`read_memory`) to get context.
2.  **Understand**:
    *   Use `get_symbols_overview` to map out a file.
    *   Use `find_symbol` to locate specific definitions.
    *   Use `find_referencing_symbols` to see usage patterns.
    *   Use `grep_search` or `find_file` if you don't know the symbol name.
3.  **Plan**: Formulate a strategy based on the semantic understanding.
4.  **Act**:
    *   **Symbolic Edit**: Use `replace_symbol_body` to rewrite a function/class entirely. This is safer for large changes.
    *   **Insertion**: Use `insert_after_symbol` or `insert_before_symbol` to add new methods or classes.
    *   **File Edit**: Use `replace_content` (regex) for small tweaks inside a symbol or for non-code files.
5.  **Verify**: Use tests (`run_shell_command`) and linting to ensure correctness.

## Tool Selection Guide

| Task | Recommended Tool | Why? |
| :--- | :--- | :--- |
| **Understand a file** | `get_symbols_overview` | Returns structure (classes, methods) without body content. Cheap & fast. |
| **Read a specific function** | `find_symbol` (include_body=True) | Returns only the code you need. |
| **Find where a function is used** | `find_referencing_symbols` | Returns locations and context of usage. Essential for refactoring. |
| **Rename a class/function** | `rename_symbol` | Semantic rename across the entire codebase. Safer than regex. |
| **Rewrite a function** | `replace_symbol_body` | Replaces the entire definition. Clean and less error-prone than regex. |
| **Small fix inside a function** | `replace_content` | Use regex/string replacement for minor edits. |
| **Add a new method** | `insert_after_symbol` | Inserts code cleanly after an existing symbol. |
| **Search generally** | `grep_search` | Find text patterns when symbol names are unknown. |
| **Save project context** | `write_memory` | Store important facts (tech stack, conventions) for future sessions. |

## Advanced Usage

For complex refactoring or feature implementation workflows, see [references/workflows.md](references/workflows.md).
