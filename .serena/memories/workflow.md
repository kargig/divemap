# Development Workflow

1.  **Understand Task**: 
    - **REPO_MAP First**: ALWAYS read `REPO_MAP.md` as your first step to identify the relevant modules and services.
    - **Semantic Tools**: Read requirements and existing code using semantic tools (e.g., `mcp_serena_get_symbols_overview`, `mcp_serena_find_symbol`) rather than `cat`/`grep`.
2.  **File Modification**: When writing or editing code, ALWAYS use native tools (`write_file`, `replace`) or Serena tools (`mcp_serena_replace_content`, `mcp_serena_replace_symbol_body`, `mcp_serena_insert_after_symbol`, `mcp_serena_insert_before_symbol`). NEVER use shell commands like `cat << 'EOF'` or `echo`.
3.  **Plan**: Create a plan. Ask for clarification if needed.
    - **Maintenance Loop**: If you create a new directory, service, or significant component, include an update to `REPO_MAP.md` in your plan.
4.  **Branch**: Create a feature branch `feature/[task-name]`.
5.  **Implement**:
    - Backend: Use `backend/divemap_venv`. Add tests.
    - Frontend: Use `docker exec`. Verify with browser.
6.  **Verify**:
    - Backend: Run `./docker-test-github-actions.sh`.
    - Frontend: Run `make lint-frontend` and tests. MUST use `navigate_page` and `list_console_messages` to check browser console for runtime errors.
7.  **Commit**:
    - Prepare `commit-message.txt`.
    - Do NOT use `git add` or `git commit`.
    - Ask user to commit.
8.  **Finalize**: Ensure all checks pass and code is clean.
