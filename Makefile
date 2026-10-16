# Divemap Deployment Makefile
# 
# Usage:
#   make deploy          - Deploy backend, frontend, and nginx
#   make deploy-backend  - Deploy only the backend
#   make deploy-frontend - Deploy only the frontend
#   make deploy-nginx    - Deploy only the nginx proxy
#   make test           - Run all tests (backend and frontend)
#   make test-backend   - Run backend tests
#   make test-frontend  - Run frontend tests
#   make purge-cache    - Purge Cloudflare cache for divemap.gr
#   make help           - Show this help message

# Load environment variables from .env
-include .env
export

SHELL := /bin/bash

.PHONY: help deploy deploy-backend deploy-frontend deploy-nginx test test-backend test-frontend purge-cache check-api-contracts db-snapshot db-restore db-status db-snapshots db-switch lint-backend lint-backend-fix lint-frontend lint-nginx backend-sync backend-lock

# Default target
help:
	@echo "Divemap Deployment Makefile"
	@echo ""
	@echo "Available targets:"
	@echo "  deploy          - Deploy backend, frontend, and nginx"
	@echo "  deploy-backend  - Deploy only the backend"
	@echo "  deploy-frontend - Deploy only the frontend"
	@echo "  deploy-nginx    - Deploy only the nginx proxy"
	@echo "  test            - Run all tests (backend and frontend)"
	@echo "  test-backend    - Run backend tests"
	@echo "  test-frontend   - Run frontend tests"
	@echo "  lint-backend    - Run backend linting and format check with Ruff"
	@echo "  lint-backend-fix - Fix backend linting issues and format with Ruff"
	@echo "  lint-frontend   - Run frontend linting and formatting"
	@echo "  lint-nginx      - Lint Nginx configuration files"
	@echo "  purge-cache     - Purge Cloudflare cache for divemap.gr"
	@echo "  check-api-contracts - Verify frontend API calls match backend routes"
	@echo "  db-snapshot     - Snapshot MySQL database state for branch (optional: rev=... branch=...)"
	@echo "  db-restore      - Restore MySQL database snapshot (optional: rev=... branch=...)"
	@echo "  db-status       - Show DB Alembic revision and snapshot sync status"
	@echo "  db-snapshots    - List all saved branch database snapshots"
	@echo "  db-switch       - Snapshot current, checkout target, restore target DB if snapshot exists (branch=<name>)"
	@echo "  help            - Show this help message"
	@echo ""

# Deploy backend, frontend, and nginx
deploy: deploy-backend deploy-frontend deploy-nginx
	@echo "✅ Backend, frontend, and nginx deployed successfully!"
	@echo "🌐 Frontend: https://divemap-frontend.fly.dev/"
	@echo "🔧 Backend: https://divemap-backend.fly.dev/"
	@echo "🔄 Nginx Proxy: https://divemap.fly.dev/"

# Deploy only the backend
deploy-backend:
	@echo "🚀 Deploying backend..."
	@cd backend && fly deploy
	@echo "✅ Backend deployed successfully!"

# Deploy only the frontend
deploy-frontend:
	@echo "🚀 Deploying frontend..."
	@cd frontend && ./deploy.sh .env.production
	@echo "✅ Frontend deployed successfully!"

# Deploy only the nginx proxy
deploy-nginx:
	@echo "🚀 Deploying nginx proxy..."
	@cd nginx && fly deploy
	@echo "✅ Nginx proxy deployed successfully!"

# Run all tests
test: test-backend test-frontend
	@echo "✅ All tests completed successfully!"

# Run backend tests
test-backend:
	@echo "🧪 Running backend tests..."
	@cd backend && source divemap_venv/bin/activate && export PYTHONPATH="$$(pwd)/divemap_venv/lib/python3.13/site-packages:$$PYTHONPATH" && python -m pytest tests/ -v
	@echo "✅ Backend tests completed!"

# Run frontend tests
test-frontend:
	@echo "🧪 Running frontend tests..."
	@cd frontend && npm test
	@echo "✅ Frontend tests completed!"

# Generate content for AI crawlers (llms.txt)
generate-llm-content:
	@echo "🤖 Generating LLM content in backend..."
	@docker-compose exec -T backend python generate_static_content.py --force
	@echo "✅ LLM content generated in backend/llm_content/"

# Run backend linting and format check with Ruff
lint-backend:
	@echo "🧹 Checking backend linting with Ruff..."
	@cd backend && (if [ -f divemap_venv/bin/ruff ]; then ./divemap_venv/bin/ruff check app; else ruff check app; fi)
	@echo "🧹 Checking backend formatting with Ruff..."
	@cd backend && (if [ -f divemap_venv/bin/ruff ]; then ./divemap_venv/bin/ruff format --check app || echo "ℹ️ Formatting differences detected. Run 'make lint-backend-fix' to format."; else ruff format --check app || echo "ℹ️ Formatting differences detected."; fi)
	@echo "✅ Backend linting complete."

# Fix backend linting issues and format code with Ruff
lint-backend-fix:
	@echo "🛠️ Fixing backend lint errors and formatting with Ruff..."
	@cd backend && (if [ -f divemap_venv/bin/ruff ]; then ./divemap_venv/bin/ruff check --fix app && ./divemap_venv/bin/ruff format app; else ruff check --fix app && ruff format app; fi)

# Sync backend virtualenv with uv
backend-sync:
	@echo "📦 Syncing backend dependencies with uv..."
	@cd backend && UV_PROJECT_ENVIRONMENT=divemap_venv uv sync --frozen
	@echo "✅ Backend dependencies synced."

# Lock backend dependencies with uv and export requirements.txt
backend-lock:
	@echo "🔒 Updating uv.lock and exporting requirements.txt..."
	@cd backend && uv lock && uv export --frozen --no-dev --no-hashes -o requirements.txt && uv export --frozen --all-groups --no-hashes -o requirements-dev.txt
	@echo "✅ Lockfile and requirements updated."

# Run frontend linting and formatting, saving errors to a log file
lint-frontend:
	@echo "🧹 Running frontend format and lint:fix..."
	@docker exec divemap_frontend npm run format > /dev/null 2>&1 || true
	@docker exec divemap_frontend npm run lint:fix -- --quiet > frontend-lint-errors.log 2>&1 || if [ $$(wc -l < frontend-lint-errors.log) -gt 2 ]; then echo "❌ Linting failed:"; cat frontend-lint-errors.log; exit 1; fi
	@echo "✅ Linting complete. No errors found."

# Lint development and production Nginx configuration files
lint-nginx:
	@echo "🔍 Linting Nginx configurations..."
	@mkdir -p .nginx_lint_temp
	@python3 -c "import os; content = open('nginx/dev.conf').read().replace('divemap_frontend:3000', '127.0.0.1:3000').replace('divemap_backend:8000', '127.0.0.1:8000'); open('.nginx_lint_temp/dev.conf', 'w').write(content)"
	@echo "📂 Testing nginx/dev.conf syntax..."
	@docker run --rm -v $$(pwd)/.nginx_lint_temp/dev.conf:/etc/nginx/nginx.conf:ro nginx:alpine nginx -t
	@python3 -c "import os; content = open('nginx/prod.conf').read().replace('divemap-frontend.flycast:80', '127.0.0.1:80').replace('divemap-backend.flycast:80', '127.0.0.1:80'); open('.nginx_lint_temp/prod.conf', 'w').write(content)"
	@echo "📂 Testing nginx/prod.conf syntax..."
	@docker run --rm -v $$(pwd)/.nginx_lint_temp/prod.conf:/etc/nginx/nginx.conf:ro nginx:alpine nginx -t
	@rm -rf .nginx_lint_temp
	@echo "✅ All Nginx configuration syntax tests passed successfully!"

# Purge Cloudflare cache
purge-cache:
	@echo "🧹 Purging Cloudflare cache for divemap.gr..."
	@RESPONSE=$$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$(CLOUDFLARE_ZONE_ID)/purge_cache" \
		-H "Authorization: Bearer $(CLOUDFLARE_API_KEY)" \
		-H "Content-Type: application/json" \
		--data '{"purge_everything":true}'); \
	if echo "$$RESPONSE" | tr -d '[:space:]' | grep -q '"success":true'; then \
		echo "✅ Cache purged!"; \
	else \
		echo "❌ Failed to purge cache:"; \
		echo "$$RESPONSE"; \
		exit 1; \
	fi


# Verify frontend API calls match backend routes
check-api-contracts:
	@echo "🔍 Verifying frontend API calls against backend OpenAPI schema..."
	@python3 scripts/check_api_contracts.py

# Branch-Aware Database Snapshot & Restore
db-snapshot:
	@./scripts/db_branch.sh save "$(or $(branch),$$(git branch --show-current))" $(rev)

db-restore:
	@./scripts/db_branch.sh restore $(if $(branch),$(branch),) $(if $(rev),--rev $(rev),)

db-status:
	@./scripts/db_branch.sh status

db-snapshots:
	@./scripts/db_branch.sh list

db-switch:
	@if [ -z "$(branch)" ]; then \
		echo "❌ Error: 'branch' parameter is required. Example: make db-switch branch=feature/foo"; \
		exit 1; \
	fi
	@./scripts/db_branch.sh switch $(branch)

