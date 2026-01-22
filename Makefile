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

.PHONY: help deploy deploy-backend deploy-frontend deploy-nginx test test-backend test-frontend purge-cache

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
	@echo "  purge-cache     - Purge Cloudflare cache for divemap.gr"
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
	@cd backend && source divemap_venv/bin/activate && export PYTHONPATH="$$(pwd)/divemap_venv/lib/python3.11/site-packages:$$PYTHONPATH" && python -m pytest tests/ -v
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

# Run frontend linting and formatting, saving errors to a log file
lint-frontend:
	@echo "🧹 Running frontend format and lint:fix..."
	@docker exec divemap_frontend npm run format > /dev/null 2>&1 || true
	@docker exec divemap_frontend npm run lint:fix -- --quiet > frontend-lint-errors.log 2>&1 || true
	@echo "✅ Linting complete. Check 'frontend-lint-errors.log' for any remaining errors."

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

