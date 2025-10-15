# Storage Deployment Guide

This guide explains how to deploy the new storage structure for the Moretranz API to your production server.

## Overview

The new storage system separates application code from data files, providing better:
- **Performance**: Files are stored outside the application container
- **Scalability**: Easy to backup, restore, and manage storage
- **Security**: Better isolation between application and data
- **Maintenance**: Easier to manage and clean up old files

## Server Setup

### 1. Create Storage Directories

SSH into your server and create the storage directories:

```bash
# SSH into your server
ssh root@74.208.173.203

# Create storage directories
sudo mkdir -p /data/moretranz/attachments
sudo mkdir -p /data/moretranz/logs

# Set proper permissions
sudo chown -R 1000:1000 /data/moretranz
sudo chmod -R 755 /data/moretranz
```

### 2. Update Environment Variables

Create or update your `.env` file with the new storage configuration:

```bash
# Storage Configuration
ATTACHMENTS_FOLDER=/data/attachments
LOGS_FOLDER=/data/logs
MAX_FILE_SIZE_MB=50
ALLOWED_FILE_TYPES=pdf,png,jpg,jpeg,gif,bmp,txt,html

# Your existing environment variables
EMAIL_ADDRESS=your_email@example.com
EMAIL_PASSWORD=your_app_password
IMAP_SERVER=imap.gmail.com
ALLOWED_SENDERS=allowed@example.com
EMAIL_PROCESSING_ENABLED=true
```

### 3. Deploy the Updated Code

```bash
# Pull the latest code
git pull origin backdev

# Build and deploy with Docker Compose
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 4. Migrate Existing Data (if any)

If you have existing attachments and logs, run the migration script:

```bash
# Make the migration script executable
chmod +x migrate_storage.py

# Run the migration
python3 migrate_storage.py

# Verify the migration
python3 migrate_storage.py --verify
```

## Storage Structure

The new storage structure organizes files as follows:

```
/data/moretranz/
├── attachments/
│   ├── order_1/
│   │   ├── file1.png
│   │   ├── file1_label.pdf
│   │   └── file2.jpg
│   ├── order_2/
│   │   └── document.pdf
│   └── ...
└── logs/
    ├── processed_emails.txt
    ├── application.log
    └── ...
```

## Benefits

### 1. **Performance Improvements**
- Files are stored outside the application container
- Reduced container size and faster deployments
- Better I/O performance with dedicated storage

### 2. **Scalability**
- Easy to add more storage space
- Can be moved to network storage (NFS, etc.)
- Better for horizontal scaling

### 3. **Backup & Recovery**
- Simple to backup just the `/data` directory
- Can restore data without rebuilding containers
- Easy to migrate between servers

### 4. **Security**
- Application code and data are separated
- Better access control on data directories
- Reduced attack surface

## Monitoring & Maintenance

### Storage Monitoring

Check storage usage:
```bash
# Check disk usage
df -h /data

# Check directory sizes
du -sh /data/moretranz/*
```

### Cleanup Old Files

The storage service includes automatic cleanup functionality. You can also manually clean up:

```bash
# Find files older than 30 days
find /data/moretranz/attachments -type f -mtime +30

# Remove files older than 30 days (be careful!)
find /data/moretranz/attachments -type f -mtime +30 -delete
```

### Backup Strategy

Set up regular backups:

```bash
# Create a backup script
cat > /usr/local/bin/backup_moretranz.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/moretranz"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
tar -czf "$BACKUP_DIR/moretranz_data_$DATE.tar.gz" /data/moretranz

# Keep only last 7 days of backups
find $BACKUP_DIR -name "moretranz_data_*.tar.gz" -mtime +7 -delete
EOF

chmod +x /usr/local/bin/backup_moretranz.sh

# Add to crontab for daily backups
echo "0 2 * * * /usr/local/bin/backup_moretranz.sh" | crontab -
```

## Troubleshooting

### Permission Issues

If you encounter permission issues:

```bash
# Fix ownership
sudo chown -R 1000:1000 /data/moretranz

# Fix permissions
sudo chmod -R 755 /data/moretranz
```

### Storage Full

If storage gets full:

```bash
# Check what's using space
du -sh /data/moretranz/*

# Clean up old files
find /data/moretranz/attachments -type f -mtime +30 -delete

# Or increase storage (if using cloud)
```

### Container Issues

If containers can't access storage:

```bash
# Check if directories exist
ls -la /data/moretranz/

# Check Docker volume mounts
docker-compose config

# Restart containers
docker-compose restart
```

## Migration Checklist

- [ ] Create storage directories on server
- [ ] Set proper permissions
- [ ] Update environment variables
- [ ] Deploy updated code
- [ ] Run migration script (if needed)
- [ ] Verify file access
- [ ] Test file uploads/downloads
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Document new procedures

## Support

If you encounter any issues during deployment:

1. Check the logs: `docker-compose logs backend`
2. Verify permissions: `ls -la /data/moretranz/`
3. Test file operations manually
4. Check environment variables: `docker-compose config`

The new storage system provides a solid foundation for production deployment with better performance, scalability, and maintainability.
