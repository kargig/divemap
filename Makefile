# Divemap Deployment Makefile
# 
# Usage:
#   make deploy          - Deploy both backend and frontend
#   make deploy-backend  - Deploy only the backend
#   make deploy-frontend - Deploy only the frontend
#   make help           - Show this help message

.PHONY: help deploy deploy-backend deploy-frontend

# Default target
help:
	@echo "Divemap Deployment Makefile"
	@echo ""
	@echo "Available targets:"
	@echo "  deploy          - Deploy both backend and frontend"
	@echo "  deploy-backend  - Deploy only the backend"
	@echo "  deploy-frontend - Deploy only the frontend"
	@echo "  help           - Show this help message"
	@echo ""

# Deploy both backend and frontend
deploy: deploy-backend deploy-frontend
	@echo "✅ Both backend and frontend deployed successfully!"
	@echo "🌐 Frontend: https://divemap.fly.dev/"
	@echo "🔧 Backend: https://divemap-backend.fly.dev/"

# Deploy only the backend
deploy-backend:
	@echo "🚀 Deploying backend..."
	@cd backend && fly deploy
	@echo "✅ Backend deployed successfully!"

# Deploy only the frontend
deploy-frontend:
	@echo "🚀 Deploying frontend..."
	@cd frontend && ./deploy.sh
	@echo "✅ Frontend deployed successfully!"
