# Serena Workflows

## Refactoring a Class

1.  **Analyze**: Use `get_symbols_overview` on the target file.
2.  **Target**: Use `find_symbol` with `include_body=True` for the class and its methods.
3.  **Trace**: Use `find_referencing_symbols` to see where the class and its methods are used.
4.  **Refactor**:
    *   For major changes, use `replace_symbol_body` to rewrite methods or the entire class definition.
    *   Use `rename_symbol` to rename the class or methods safely across all files.
5.  **Clean Up**: Use `replace_content` for any minor adjustments or comment updates.

## Implementing a New Feature

1.  **Plan**: Understand requirements and locate relevant existing code (`search_for_pattern`, `find_file`).
2.  **Insert**:
    *   Use `insert_after_symbol` to add new methods to existing classes.
    *   Use `insert_before_symbol` to add new imports or helper functions at the top of a file.
3.  **Integrate**: Modify existing code to call the new feature using `replace_content` or `replace_symbol_body`.
4.  **Verify**: Run tests (`run_shell_command`) and linting to ensure no regressions.

## Debugging

1.  **Locate**: Use `grep_search` to find error messages or relevant code snippets.
2.  **Inspect**: Use `read_file` (with line ranges) or `find_symbol` to read the problematic code.
3.  **Understand Usage**: Use `find_referencing_symbols` to see how the problematic code is called.
4.  **Fix**: Apply fixes using `replace_content` (for small fixes) or `replace_symbol_body` (for logic rewrites).
5.  **Verify**: Rerun the failing test case to confirm the fix.

## Memory Management

1.  **Onboard**: Run `onboarding` for new projects to generate initial memories.
2.  **Read Context**: Use `read_memory` to fetch project conventions, tech stack, and commands.
3.  **Update**: Use `write_memory` to save new important information (e.g., "Always use X library for Y task") or update existing memories.
