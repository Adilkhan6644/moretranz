# Docker Setup Guide

This guide will help you run the Moretranz Order Processor API using Docker.

## Prerequisites

- Docker Desktop installed and running
- Git (to clone the repository)

## Quick Start

1. **Clone and navigate to the project:**
   ```bash
   cd moretranz_api
   ```

2. **Create environment file:**
   ```bash
   cp env.example .env
   ```
   Edit `.env` file with your actual values (especially email credentials if needed).

3. **Build and run with Docker Compose:**
   ```bash
   docker-compose up --build
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

## Services

The Docker setup includes three services:

### Database (PostgreSQL)
- **Port:** 5432
- **Database:** moretranz_db
- **User:** moretranz_user
- **Password:** moretranz_password

### Backend (FastAPI)
- **Port:** 8000
- **Auto-reload:** Enabled for development
- **Database:** Automatically connects to PostgreSQL container

### Frontend (React)
- **Port:** 3000
- **Production build:** Optimized for performance

## Environment Variables

Key environment variables you can configure in `.env`:

```env
# Database (automatically configured for Docker)
DATABASE_URL=postgresql://moretranz_user:moretranz_password@db:5432/moretranz_db

# Email Configuration (Optional)
EMAIL_ADDRESS=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
IMAP_SERVER=imap.gmail.com
ALLOWED_SENDERS=sender1@example.com,sender2@example.com
EMAIL_PROCESSING_ENABLED=false
```

## Useful Commands

### Start services:
```bash
docker-compose up
```

### Start in background:
```bash
docker-compose up -d
```

### Stop services:
```bash
docker-compose down
```

### Stop and remove volumes (WARNING: This will delete all data):
```bash
docker-compose down -v
```

### View logs:
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### Rebuild specific service:
```bash
docker-compose up --build backend
```

### Access database directly:
```bash
docker-compose exec db psql -U moretranz_user -d moretranz_db
```

## Development vs Production

### Development Mode
- Backend runs with `--reload` flag for auto-restart on code changes
- Frontend serves production build but can be modified for development

### Production Mode
To run in production mode, modify the Dockerfile to:
1. Remove `--reload` flag from the backend
2. Use production-optimized settings
3. Set proper environment variables

## Troubleshooting

### Port conflicts
If ports 3000, 8000, or 5432 are already in use, modify the ports in `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Frontend on port 3001
  - "8001:8000"  # Backend on port 8001
  - "5433:5432"  # Database on port 5433
```

### Database connection issues
- Ensure PostgreSQL container is healthy before backend starts
- Check database credentials in `.env` file
- Verify network connectivity between containers

### Permission issues
On Linux/Mac, you might need to fix file permissions:
```bash
sudo chown -R $USER:$USER attachments/
sudo chown -R $USER:$USER logs/
```

## Data Persistence

- Database data is stored in a Docker volume (`postgres_data`)
- Attachments and logs are mounted as volumes from your host system
- To backup data: `docker-compose exec db pg_dump -U moretranz_user moretranz_db > backup.sql`
- To restore data: `docker-compose exec -T db psql -U moretranz_user moretranz_db < backup.sql`
