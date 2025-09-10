.PHONY: help setup start stop restart logs clean test

# Default target
help: ## Show this help message
	@echo "CRM Unifier Development Commands"
	@echo "================================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Environment Setup
setup: ## Setup complete development environment
	@echo "🚀 Setting up CRM Unifier development environment..."
	./scripts/dev-setup.sh

quick-setup: ## Quick setup (just copy env and start services)
	@echo "⚡ Quick environment setup..."
	@if [ ! -f .env.local ]; then cp .env.example .env.local; fi
	docker-compose up -d postgres redis
	@echo "✅ Quick setup complete!"
	@echo "📝 Edit .env.local with your configuration"

# Development
start: ## Start core services (postgres, redis)
	docker-compose up -d postgres redis
	@echo "✅ Core services started!"
	@echo "🐘 PostgreSQL: localhost:5432"
	@echo "🔴 Redis: localhost:6379"

start-all: ## Start all development services including tools
	docker-compose --profile dev-tools up -d
	@echo "✅ All services started!"
	@echo "🐘 PostgreSQL: localhost:5432"
	@echo "🔴 Redis: localhost:6379"
	@echo "🔧 pgAdmin: http://localhost:5050"
	@echo "🔧 Redis Commander: http://localhost:8081"
	@echo "📧 Mailpit: http://localhost:8025"

stop: ## Stop all services
	docker-compose --profile dev-tools down
	@echo "✅ Services stopped!"

restart: ## Restart core services
	docker-compose restart postgres redis
	@echo "✅ Core services restarted!"

logs: ## View logs from all services
	docker-compose --profile dev-tools logs -f

logs-core: ## View logs from core services only
	docker-compose logs -f postgres redis

# Database
db-setup: ## Initialize database with migrations
	cd backend && npm run prisma:migrate
	cd backend && npm run prisma:seed
	@echo "✅ Database initialized!"

db-studio: ## Open Prisma Studio
	cd backend && npx prisma studio

db-reset: ## Reset database (DESTRUCTIVE)
	docker-compose down -v
	docker-compose up -d postgres redis
	@echo "⚠️  Database reset complete!"

# Testing
test-setup: ## Setup test environment
	docker-compose --profile test up -d postgres-test redis-test
	@echo "✅ Test environment ready!"

test: ## Run all tests
	cd backend && npm test
	cd frontend && npm test

test-e2e: ## Run end-to-end tests
	cd frontend && npm run test:e2e

# Cleanup
clean: ## Clean up containers, volumes, and build artifacts
	docker-compose down -v
	docker system prune -f
	rm -rf backend/node_modules frontend/node_modules
	rm -rf backend/dist frontend/.next
	@echo "✅ Cleanup complete!"

# Development helpers
dev-backend: ## Start backend development server
	cd backend && npm run dev

dev-frontend: ## Start frontend development server
	cd frontend && npm run dev

dev-worker: ## Start queue worker
	cd backend && npm run worker

# Testing
test-setup: ## Setup test environment
	docker-compose --profile test up -d postgres-test redis-test
	@echo "✅ Test environment ready!"
	@echo "🧪 Test PostgreSQL: localhost:5433"
	@echo "🧪 Test Redis: localhost:6380"

test-teardown: ## Teardown test environment
	docker-compose --profile test down
	@echo "✅ Test environment cleaned up!"

# Production
prod-build: ## Build production images
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml build
	@echo "✅ Production images built!"

prod-start: ## Start production environment
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
	@echo "✅ Production environment started!"

prod-stop: ## Stop production environment
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
	@echo "✅ Production environment stopped!"

# Health checks
health: ## Check service health
	@echo "Checking service health..."
	@docker-compose ps
	@echo "Testing connections..."
	@docker exec crm-postgres pg_isready -U crm -d crm_unifier > /dev/null && echo "✅ PostgreSQL: OK" || echo "❌ PostgreSQL: DOWN"
	@docker exec crm-redis redis-cli ping > /dev/null && echo "✅ Redis: OK" || echo "❌ Redis: DOWN"

health-full: ## Full health check with URLs
	@echo "🏥 Full Health Check"
	@echo "==================="
	@make health
	@echo ""
	@echo "🌐 Service URLs:"
	@echo "  Backend API:     http://localhost:3001/health"
	@echo "  Frontend:        http://localhost:3000"
	@echo "  Prisma Studio:   http://localhost:5555"
	@echo ""
	@echo "🛠️  Development Tools (if running):"
	@echo "  pgAdmin:         http://localhost:5050"
	@echo "  Redis Commander: http://localhost:8081"
	@echo "  Mailpit:         http://localhost:8025"