#!/bin/bash

# CRM Unifier Development Environment Setup
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running from project root
if [ ! -f "package.json" ] || [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    log_error "Please run this script from the project root directory"
    exit 1
fi

log_info "Setting up CRM Unifier development environment..."

# Check prerequisites
log_info "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || {
    log_error "Docker is required but not installed. Please install Docker first."
    exit 1
}

command -v docker-compose >/dev/null 2>&1 || {
    log_error "Docker Compose is required but not installed. Please install Docker Compose first."
    exit 1
}

command -v node >/dev/null 2>&1 || {
    log_error "Node.js is required but not installed. Please install Node.js 20+ first."
    exit 1
}

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    log_error "Node.js 20 or higher is required. Current version: $(node --version)"
    exit 1
fi

log_success "Prerequisites check passed"

# Create environment file if it doesn't exist
if [ ! -f ".env.local" ]; then
    log_info "Creating .env.local from template..."
    cp .env.example .env.local
    log_warning "Please edit .env.local with your configuration before continuing"
else
    log_info ".env.local already exists"
fi

# Install dependencies
log_info "Installing dependencies..."
npm install

log_info "Installing workspace dependencies..."
npm run install:all

# Start Docker services
log_info "Starting Docker services..."
docker-compose up -d postgres redis

# Wait for services to be healthy
log_info "Waiting for services to be ready..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if docker-compose exec -T postgres pg_isready -U crm -d crm_unifier >/dev/null 2>&1; then
        break
    fi
    attempt=$((attempt + 1))
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    log_error "PostgreSQL failed to start within timeout"
    exit 1
fi

log_success "PostgreSQL is ready"

# Check Redis
if docker-compose exec -T redis redis-cli ping >/dev/null 2>&1; then
    log_success "Redis is ready"
else
    log_error "Redis is not responding"
    exit 1
fi

# Setup database
log_info "Setting up database..."
cd backend

# Generate Prisma client
log_info "Generating Prisma client..."
npm run prisma:generate

# Run database migrations
log_info "Running database migrations..."
npm run prisma:migrate

# Seed database
log_info "Seeding database with sample data..."
npm run prisma:seed

cd ..

log_success "Database setup complete"

# Start development tools (optional)
echo ""
echo "Development environment is ready!"
echo ""
echo "📋 Available Services:"
echo "  🐘 PostgreSQL: localhost:5432"
echo "  🔴 Redis: localhost:6379"
echo "  🖥️  Prisma Studio: npm run prisma:studio"
echo ""
echo "🚀 Start Development:"
echo "  Backend:  npm run dev:backend"
echo "  Frontend: npm run dev:frontend"
echo "  Worker:   npm run dev:worker"
echo ""
echo "🧪 Testing:"
echo "  All tests:     npm test"
echo "  Test env:      make test-setup"
echo "  Integration:   npm run test:integration"
echo "  E2E:          npm run test:e2e"
echo ""
echo "🛠️  Optional Development Tools:"
echo "  pgAdmin:          docker-compose --profile dev-tools up -d pgadmin"
echo "  Redis Commander: docker-compose --profile dev-tools up -d redis-commander"
echo "  Email Testing:   docker-compose --profile dev-tools up -d mailpit"
echo ""
echo "Access URLs (when dev-tools profile is active):"
echo "  pgAdmin:          http://localhost:5050 (admin@crm.local / admin)"
echo "  Redis Commander: http://localhost:8081 (admin / admin)"
echo "  Mailpit:         http://localhost:8025"
echo ""
echo "📖 Default login credentials:"
echo "  Admin:  admin@example.com / AdminPass123!"
echo "  Staff:  staff@example.com / StaffPass123!"
echo "  Viewer: viewer@example.com / ViewerPass123!"
echo ""

log_success "Development environment setup complete! 🎉"