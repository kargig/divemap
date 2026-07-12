# Task Completion

Commands to run before considering a task finished.

## Backend
- Run tests: `cd backend && ./docker-test-github-actions.sh`
- Check logs for errors: `docker logs divemap_backend --since 5m`

## Frontend
- Run tests: `make test-frontend`
- Lint: `make lint-frontend` (Check `frontend-lint-errors.log`)
- **Browser Check**:
    - Navigate to affected pages.
    - Check browser console for errors (`list_console_messages`).
    - Verify responsive behavior on mobile viewports.

## Deployment Preparation
- If schema changed: Verify sequential migration naming in `backend/migrations/versions/`.
- If routes changed: Verify old URL redirects.
