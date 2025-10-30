# Quick Fix for Docker Build Error

## Problem
`parent snapshot does not exist: not found` - Docker build cache corruption

## Solution

### Option 1: Clean Rebuild (Recommended)

```bash
# From project root (moretranz_api/)
cd d:\desktop\moretranz_api

# Stop all containers
docker-compose down

# Remove build cache
docker builder prune -af

# Rebuild without cache
docker-compose build --no-cache

# Start services
docker-compose up -d
```

### Option 2: Rebuild Individual Services

```bash
# Rebuild only backend
docker-compose build --no-cache backend

# Rebuild only frontend  
docker-compose build --no-cache frontend

# Start all
docker-compose up -d
```

### Option 3: Complete Clean Slate

```bash
# Nuclear option - removes everything
docker-compose down -v
docker system prune -af --volumes
docker-compose build --no-cache
docker-compose up -d
```

## Why This Happens

Docker's layer caching can get corrupted when:
- Files change while Docker is building
- Disk space issues
- Docker Desktop issues on Windows

## Prevention

1. Always run from project root: `d:\desktop\moretranz_api\`
2. Don't modify files during build
3. Ensure sufficient disk space

## Verify It Worked

After rebuild, check:
```bash
docker-compose ps  # All services should be "Up"
docker-compose logs backend  # Should show "Application startup complete"
```

