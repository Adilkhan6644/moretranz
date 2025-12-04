#!/bin/bash
# Deployment script for MoreTranz API
# This script can be run manually on the server or via CI/CD

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="${PROJECT_DIR:-/path/to/moretranz_api}"
BRANCH="${BRANCH:-main}"

echo -e "${GREEN}🚀 Starting deployment...${NC}"

# Navigate to project directory
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Directory not found: $PROJECT_DIR${NC}"
    exit 1
fi

cd "$PROJECT_DIR"

# Pull latest code
echo -e "${YELLOW}📥 Pulling latest code from $BRANCH...${NC}"
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

# Backup .env file
if [ -f .env ]; then
    echo -e "${YELLOW}💾 Backing up .env file...${NC}"
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from example...${NC}"
    if [ -f env.production.example ]; then
        cp env.production.example .env
        echo -e "${RED}⚠️  Please update .env file with your production values!${NC}"
    else
        echo -e "${RED}❌ No .env.example found. Please create .env manually.${NC}"
        exit 1
    fi
fi

# Stop containers gracefully
echo -e "${YELLOW}🛑 Stopping containers...${NC}"
docker-compose down || true

# Pull latest images (if using registry)
if [ -n "$DOCKER_REGISTRY" ]; then
    echo -e "${YELLOW}📦 Pulling latest images from registry...${NC}"
    docker-compose pull || true
fi

# Build and start containers
echo -e "${YELLOW}🔨 Building and starting containers...${NC}"
docker-compose up -d --build --remove-orphans

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 10

# Check container status
echo -e "${GREEN}📊 Container status:${NC}"
docker-compose ps

# Health checks
echo -e "${YELLOW}🏥 Running health checks...${NC}"

# Check backend
BACKEND_HEALTHY=false
for i in {1..30}; do
    if curl -f http://localhost:8000/docs 2>/dev/null || curl -f http://localhost:8000/api/v1/health 2>/dev/null; then
        echo -e "${GREEN}✅ Backend is healthy${NC}"
        BACKEND_HEALTHY=true
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Backend health check failed${NC}"
        docker-compose logs backend | tail -50
        exit 1
    fi
    echo "Waiting for backend... ($i/30)"
    sleep 2
done

# Check frontend
FRONTEND_HEALTHY=false
for i in {1..30}; do
    if curl -f http://localhost:3000 2>/dev/null; then
        echo -e "${GREEN}✅ Frontend is healthy${NC}"
        FRONTEND_HEALTHY=true
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Frontend health check failed${NC}"
        docker-compose logs frontend | tail -50
        exit 1
    fi
    echo "Waiting for frontend... ($i/30)"
    sleep 2
done

# Check database
DB_HEALTHY=false
for i in {1..10}; do
    if docker-compose exec -T db pg_isready -U moretranz_user -d moretranz_db > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database is healthy${NC}"
        DB_HEALTHY=true
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${YELLOW}⚠️  Database health check failed (may still be starting)${NC}"
    fi
    sleep 1
done

# Clean up old images
echo -e "${YELLOW}🧹 Cleaning up old Docker images...${NC}"
docker image prune -f

# Show recent logs
echo -e "${GREEN}📋 Recent backend logs:${NC}"
docker-compose logs --tail=20 backend

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Application should be available at: http://$(hostname -I | awk '{print $1}')${NC}"

