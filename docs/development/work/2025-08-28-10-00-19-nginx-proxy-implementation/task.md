# Nginx Proxy Implementation

**Status:** Refining
**Created:** $(date -Iseconds)
**Agent PID:** $(echo $PPID)

## Original Todo
See `plan.md` for the original implementation plan and details.

## Description
Implement nginx as a reverse proxy for dev and prod to unify origin between frontend and backend, fix cross-origin refresh-token cookie issues, and route `/`, `/api`, `/docs`, and `/openapi.json` appropriately.

## Success Criteria
- [ ] Functional: Dev proxy serves frontend at http://localhost and backend at /api
- [ ] Functional: Refresh token cookies work in dev without CORS issues
- [ ] Functional: Prod proxy config with SSL and security headers
- [ ] Quality: Backend CORS reflects proxied origin only (dev/prod)
- [ ] Quality: No mixed-content or cookie warnings in browser console
- [ ] Documentation: docs updated (dev/prod configs, env vars, run instructions)

## Implementation Plan
- [ ] Create nginx dev config `nginx/dev.conf` (/, /api, /docs, /openapi.json)
- [ ] Update `docker-compose.dev.yml` to add nginx service and adjust ports
- [ ] Update frontend/backend env to use proxied origin
- [ ] Validate tokens: login, refresh, logout flows in dev
- [ ] Create nginx prod config `nginx/prod.conf` with SSL and headers
- [ ] Document deploy/run steps and update troubleshooting

## Automated test
- [ ] Script to curl `/api/health` via proxy and direct to ensure parity

## User test
- [ ] Login, navigate, token refresh, and logout without errors

## Review
- [ ] Bug that needs fixing
- [ ] Code that needs cleanup

## Notes
- Keep docker logs filtered with `docker logs --since` during validation
