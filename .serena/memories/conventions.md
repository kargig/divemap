# Conventions

## General
- **Tooling**: Use native/Serena tools for edits. Avoid `cat/echo/sed/grep` in shell for file mods.
- **Docker**: Always use Docker containers.
- **Git**: No `git add`. Feature branches `feature/[name]`. `commit-message.txt` for user.

## Backend
- **Environment**: Use `backend/divemap_venv`.
- **Validation**: Strict Pydantic schemas in `schemas.py`.
- **Performance**: `orjson` preferred. Constant data structures at module level. O(1) membership checks.
- **Tests**: Safe test script `mem:backend/core`.

## Frontend
- **Design**: `mem:mobile-first-design`.
- **Icons**: `mem:ui-icons`.
- **Validation**: Zod in `formHelpers.js`.
- **Performance**: Lazy loading, functional state updates, parallelize async calls.
- **Verification**: `mem:task_completion`.
