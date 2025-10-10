# Production Deployment Guide

This guide covers deploying the Moretranz Order Processor API to a production server.

## Prerequisites

- Docker and Docker Compose installed on the server
- Domain name configured (optional but recommended)
- SSL certificate (if using HTTPS)
- Server with at least 2GB RAM and 10GB storage

## Quick Deployment

1. **Clone the repository on your server:**
   ```bash
   git clone <your-repo-url>
   cd moretranz_api
   ```

2. **Create production environment file:**
   ```bash
   cp env.production .env
   ```

3. **Edit the `.env` file with your production values:**
   ```bash
   nano .env
   ```
   
   **Important:** Update these critical values:
   - `SECRET_KEY`: Generate a strong, random secret key
   - `ALLOWED_ORIGINS`: Set your actual domain(s)
   - `EMAIL_ADDRESS` and `EMAIL_PASSWORD`: If using email processing
   - Database credentials (if different from defaults)

4. **Deploy with Docker Compose:**
   ```bash
   docker-compose up -d --build
   ```

5. **Verify deployment:**
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

## Production Configuration

### Security Settings

- **SECRET_KEY**: Use a strong, randomly generated key (32+ characters)
- **ALLOWED_ORIGINS**: Restrict to your actual domains only
- **Database Password**: Use a strong, unique password

### Environment Variables

Key production environment variables:

```env
# Security
SECRET_KEY=your-super-secret-key-32-chars-minimum
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Database (keep secure)
DATABASE_URL=postgresql://moretranz_user:strong_password@db:5432/moretranz_db

# Email (if needed)
EMAIL_ADDRESS=your-email@domain.com
EMAIL_PASSWORD=your-app-specific-password
EMAIL_PROCESSING_ENABLED=true
```

### Port Configuration

The application runs on:
- **Frontend**: Port 3000
- **Backend API**: Port 81 (mapped from internal 8000)
- **Database**: Port 5432 (internal only)

To change ports, modify `docker-compose.yml`:
```yaml
ports:
  - "80:3000"    # Frontend on port 80
  - "8000:8000"  # Backend on port 8000
```

## Reverse Proxy Setup (Recommended)

### Nginx Configuration

Create `/etc/nginx/sites-available/moretranz`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:81;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:81;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/moretranz /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL/HTTPS Setup

### Using Let's Encrypt (Certbot)

1. Install Certbot:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   ```

2. Get SSL certificate:
   ```bash
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

3. Update your `.env` file:
   ```env
   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```

## Monitoring and Maintenance

### Health Checks

Check service status:
```bash
docker-compose ps
docker-compose logs backend
docker-compose logs frontend
docker-compose logs db
```

### Database Backups

Create backup:
```bash
docker-compose exec db pg_dump -U moretranz_user moretranz_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

Restore backup:
```bash
docker-compose exec -T db psql -U moretranz_user moretranz_db < backup_file.sql
```

### Updates

To update the application:
```bash
git pull
docker-compose down
docker-compose up -d --build
```

### Log Management

View logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Application logs
tail -f logs/app.log
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Change ports in `docker-compose.yml`
2. **Permission issues**: Fix file permissions:
   ```bash
   sudo chown -R $USER:$USER attachments/ logs/
   ```
3. **Database connection**: Check if database container is healthy
4. **CORS errors**: Verify `ALLOWED_ORIGINS` in `.env`

### Performance Optimization

1. **Resource limits**: Add resource limits to `docker-compose.yml`:
   ```yaml
   services:
     backend:
       deploy:
         resources:
           limits:
             memory: 1G
             cpus: '0.5'
   ```

2. **Database optimization**: Consider PostgreSQL tuning for production workloads

## Security Considerations

- Change all default passwords
- Use strong, unique SECRET_KEY
- Restrict CORS origins to your domains only
- Keep Docker and system packages updated
- Use firewall to restrict database port access
- Consider using Docker secrets for sensitive data
- Regular security updates and monitoring

## Support

For issues or questions:
1. Check the logs: `docker-compose logs -f`
2. Verify environment configuration
3. Check the troubleshooting guide in `DOCKER_TROUBLESHOOTING.md`
