# Comprehensive Vite Migration Plan

This document outlines the meticulous plan to migrate the Divemap frontend from `react-scripts` (Create React App) to Vite. This migration aims to improve development speed, build performance, and modernise the dependency stack.

## ⚠️ Critical Constraints & Standards
- **Port:** Must maintain port `3000` for development to avoid breaking existing Docker/Network configurations.
- **Output:** Build output changes from `build/` to `dist/`. All infrastructure scripts must be updated.
- **Env Vars:** Prefix changes from `REACT_APP_` to `VITE_`.
- **Testing:** Zero tolerance for broken tests. Vitest must replace Jest with 100% feature parity.

---

## Phase 1: Dependencies & Cleanup (COMPLETED)
**Goal:** Replace CRA with Vite dependencies without breaking the project structure yet.

1.  **Uninstall CRA:**
    ```bash
    npm uninstall react-scripts
    ```
2.  **Install Vite Ecosystem:**
    ```bash
    npm install --save-dev vite @vitejs/plugin-react vite-plugin-svgr \
    vitest jsdom @testing-library/jest-dom @testing-library/react \
    @types/node
    ```
    *Note: `@types/node` is required for `path` resolution in `vite.config.js`.*

3.  **Dependency Verification:**
    - Run `npm list` to ensure no conflicting peer dependencies.
    - Check for legacy global packages.

## Phase 2: Configuration & Entry Point (COMPLETED)
**Goal:** Establish the Vite configuration and application entry point.

1.  **Move Entry HTML:**
    - `mv frontend/public/index.html frontend/index.html`
    - **Reason:** Vite serves `index.html` from the project root.

2.  **Update `index.html`:**
    - Remove all `%PUBLIC_URL%` occurrences (Vite handles this automatically).
    - Inject entry script in `<body>`: `<script type="module" src="/src/index.js"></script>`.

3.  **Create `vite.config.js`:**
    - **React Plugin:** Enable Fast Refresh.
    - **SVGR:** Configure `vite-plugin-svgr` to match CRA behavior (`export { ReactComponent as ... }`).
    - **JSX Support:** Configure `esbuild` loader to parse `.js` files as JSX (temporary bridge) or rename files to `.jsx` (preferred).
    - **Server Config:**
        ```javascript
        server: {
          host: true, // Needed for Docker
          port: 3000, // Maintain existing port
          watch: {
            usePolling: true // Needed for some Docker environments
          }
        }
        ```
    - **Build Config:** Output to `dist` (default) but ensure it's explicit.
    - **Resolve:** Setup alias `@` for `src` if currently used, or ensure relative paths resolve correctly.

## Phase 3: Codebase Adaptation (COMPLETED)
**Goal:** Update application code to work with Vite's ESM-based architecture.

1.  **Environment Variables:**
    - **Action:** Rename `.env`, `.env.development`, `.env.production` keys from `REACT_APP_` to `VITE_`.
    - **Code Update:** Replace `process.env.REACT_APP_` with `import.meta.env.VITE_`.
    - **Verification:** Search globally for `process.env` to ensure no stray references remain.

2.  **SVG Imports:**
    - **Action:** Update imports.
    - **Old:** `import { ReactComponent as Logo } from './logo.svg';`
    - **New:** `import Logo from './logo.svg?react';` (if using SVGR v4+) or verify plugin configuration for legacy compatibility.

3.  **Dynamic Imports:**
    - Verify any `require()` calls are converted to `import()`. Vite/Rollup requires ESM.

## Phase 4: Infrastructure & Build Script Updates (COMPLETED)
**Goal:** Ensure the containerized environment and helper scripts build and run correctly.

1.  **Build Scripts:**
    - **`scripts/build-with-static-assets.sh`:**
        - Change: `cp -r frontend/build/* nginx/frontend-build/` -> `cp -r frontend/dist/* nginx/frontend-build/`.
        - Update echo statements to reference `frontend/dist/`.
    - **`frontend/scripts/precompress-assets.sh`:**
        - Change all references of `build` directory to `dist`.
        - Ensure it correctly finds and compresses Vite-generated assets (Vite also uses content hashing).

2.  **Dockerfile.dev:**
    - Update command from `npm start` to `npm run dev` (or aliased start).
    - Ensure `VITE_` env vars are passed if baked in (dev usually uses volume mounted .env).

3.  **Dockerfile (Production):**
    - Update build command from `npm run build:prod` to `npm run build`.
    - **Environment Variables:** Rename `ARG REACT_APP_*` and `ENV REACT_APP_*` to `ARG VITE_*` and `ENV VITE_*`.
    - **Critical:** Change `COPY --from=build /app/build ./build` to `COPY --from=build /app/dist ./dist`.
    - Update `serve` command: `CMD ["serve", "-s", "dist", "-l", "8080"]`.

4.  **docker-compose.yml & docker-compose.prod.yml:**
    - Verify volume mappings.
    - Ensure environment variables passed in `environment:` blocks use `VITE_` prefix where applicable.

5.  **Nginx Configurations (`nginx/`):**
    - **dev.conf:** Ensure proxy passes to `http://frontend:3000` still work.
    - **prod.conf:** Vite assets are typically in `dist/assets/` (instead of `build/static/`). Verify `gzip_static` and `try_files` match the new structure.
    - **deploy.sh / Build Scripts:** Update any scripts checking for `build/` directory to check for `dist/`.

6.  **Documentation Updates:**
    - **`docs/maintenance/README.md`:** Update all references of `npm run build` and `frontend/build` to `frontend/dist`.
    - **`docs/development/content-hashed-assets-plan.md`:**
        - Update asset path patterns from `static/js/` to `assets/`.
        - Update build directory references from `build/` to `dist/`.
        - Update Cloudflare rule examples to match Vite's structure.

7.  **Fly.io Configuration (`fly.toml`):
    - Check for build secrets or env vars.
    - If `[build]` args are used, ensure they align with the new Dockerfile (rename `REACT_APP_` to `VITE_`).
    - Update `[env]` section to rename `REACT_APP_` vars to `VITE_`.

## Phase 5: Testing Infrastructure (Vitest) (COMPLETED)

**Goal:** Migrate the test suite from Jest to Vitest.

1.  **Configuration:** Add `test` object to `vite.config.js`:
    ```javascript
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.js',
    }
    ```

2.  **Setup File:** Update `src/setupTests.js` to import `@testing-library/jest-dom`.

3.  **Mocking:**
    - Replace `jest.mock()` with `vi.mock()`.
    - Replace `jest.fn()` with `vi.fn()`.
    - Global search/replace `jest` -> `vi`.

4.  **Script Update:** Set `"test": "vitest"` in `package.json`.

5.  **Test Utility Fixes:** Update `frontend/tests/test_nodejs_20_upgrade.js` to use `npm run build` instead of `npm run build:prod`.

## Phase 6: Verification & QA (COMPLETED)

**Goal:** Extensive validation before merging.

### Verification Checklist

1.  **Local Development:**
    - [x] `docker-compose up` starts successfully.
    - [x] App loads on `localhost:80` (via Nginx) and `localhost:3000` (direct).
    - [x] Hot Module Replacement (HMR) works (edit a file, see instant update).
    - [x] Environment variables load correctly (check API URLs, feature flags).

2.  **Production Build:**
    - [x] `npm run build` completes without errors.
    - [x] `dist/` folder contains optimized assets.
    - [x] `serve -s dist` (local preview) loads the app correctly.
    - [x] **Content Hashing:** Verify `dist/assets/` contains files with hashes (e.g., `index-D1234.js`).

3.  **Build Scripts:**
    - [x] `./scripts/build-with-static-assets.sh` completes and copies to `nginx/frontend-build/`.
    - [x] `frontend/scripts/precompress-assets.sh` creates `.gz` files in `dist/`.

4.  **Testing:**
    - [x] `npm run test` passes all unit tests.
    - [x] Snapshot tests updated (if any).
    - [x] E2E tests (Playwright/Cypress) pass against the Vite local server.

5.  **Docker & Deployment:**
    - [x] Production Docker image builds successfully.
    - [x] Nginx serves the `dist` index.html correctly.
    - [x] React Router works (refreshing on a sub-route doesn't 404 - Nginx `try_files` check).

## Phase 7: Rollback Plan

If critical issues arise during deployment:
1.  Revert the git branch.
2.  Re-deploy the previous Docker tag.
3.  Ensure `build/` artifact assumptions in any external CI/CD pipelines (like Fly.io or GitHub Actions) are reverted.

## Phase 8: External Service Updates (Cloudflare)

**Goal:** Adjust Cloudflare Edge rules to match Vite's directory structure.
1.  **Cache Rules:**
    - **Static Assets:** Update the rule that previously matched `/static/*` (CRA) to match `/assets/*` (Vite).
    - **Extension Matching:** Ensure extension-based rules (e.g., `*.js`, `*.css`) still apply. Vite often produces more granular chunks than CRA; ensure the Edge TTL is appropriate for these.

2.  **Environment Variables:**
    - If Cloudflare Pages or Workers are used for any part of the frontend, ensure the `REACT_APP_` -> `VITE_` renaming is applied there too.

3.  **Purge Cache:**
    - After the first Vite deployment, perform a **Purge Everything** or a targeted purge of `index.html` and the old `/static/` directory to ensure no stale manifests are served.
