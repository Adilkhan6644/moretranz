#!/usr/bin/env python3
"""
Storage Migration Script
Migrates existing attachments from project directory to dedicated storage location
"""

import os
import shutil
import sys
from pathlib import Path
from datetime import datetime
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def migrate_storage():
    """Migrate existing storage to new structure"""
    
    # Define paths
    old_attachments_dir = Path("./attachments")
    old_logs_dir = Path("./logs")
    
    new_attachments_dir = Path("/data/moretranz/attachments")
    new_logs_dir = Path("/data/moretranz/logs")
    
    # Create new directories
    try:
        new_attachments_dir.mkdir(parents=True, exist_ok=True)
        new_logs_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created new storage directories: {new_attachments_dir}, {new_logs_dir}")
    except Exception as e:
        logger.error(f"Failed to create new directories: {e}")
        return False
    
    # Migrate attachments
    if old_attachments_dir.exists():
        try:
            logger.info(f"Migrating attachments from {old_attachments_dir} to {new_attachments_dir}")
            
            # Copy all files and directories
            for item in old_attachments_dir.iterdir():
                dest = new_attachments_dir / item.name
                if item.is_dir():
                    shutil.copytree(item, dest, dirs_exist_ok=True)
                    logger.info(f"Copied directory: {item.name}")
                else:
                    shutil.copy2(item, dest)
                    logger.info(f"Copied file: {item.name}")
            
            logger.info("Attachments migration completed successfully")
        except Exception as e:
            logger.error(f"Failed to migrate attachments: {e}")
            return False
    else:
        logger.info("No existing attachments directory found")
    
    # Migrate logs
    if old_logs_dir.exists():
        try:
            logger.info(f"Migrating logs from {old_logs_dir} to {new_logs_dir}")
            
            for item in old_logs_dir.iterdir():
                dest = new_logs_dir / item.name
                if item.is_file():
                    shutil.copy2(item, dest)
                    logger.info(f"Copied log file: {item.name}")
            
            logger.info("Logs migration completed successfully")
        except Exception as e:
            logger.error(f"Failed to migrate logs: {e}")
            return False
    else:
        logger.info("No existing logs directory found")
    
    # Create backup of old directories
    backup_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = Path(f"./backup_{backup_timestamp}")
    
    try:
        backup_dir.mkdir(exist_ok=True)
        
        if old_attachments_dir.exists():
            shutil.copytree(old_attachments_dir, backup_dir / "attachments")
            logger.info(f"Created backup of attachments in {backup_dir / 'attachments'}")
        
        if old_logs_dir.exists():
            shutil.copytree(old_logs_dir, backup_dir / "logs")
            logger.info(f"Created backup of logs in {backup_dir / 'logs'}")
        
        logger.info(f"Backup created in: {backup_dir}")
        
    except Exception as e:
        logger.error(f"Failed to create backup: {e}")
        return False
    
    logger.info("Storage migration completed successfully!")
    logger.info(f"New storage locations:")
    logger.info(f"  Attachments: {new_attachments_dir}")
    logger.info(f"  Logs: {new_logs_dir}")
    logger.info(f"  Backup: {backup_dir}")
    
    return True

def verify_migration():
    """Verify that migration was successful"""
    new_attachments_dir = Path("/data/moretranz/attachments")
    new_logs_dir = Path("/data/moretranz/logs")
    
    if not new_attachments_dir.exists():
        logger.error("New attachments directory does not exist")
        return False
    
    if not new_logs_dir.exists():
        logger.error("New logs directory does not exist")
        return False
    
    # Count files in new directories
    attachment_count = sum(1 for _ in new_attachments_dir.rglob('*') if _.is_file())
    log_count = sum(1 for _ in new_logs_dir.rglob('*') if _.is_file())
    
    logger.info(f"Verification complete:")
    logger.info(f"  Attachments: {attachment_count} files")
    logger.info(f"  Logs: {log_count} files")
    
    return True

if __name__ == "__main__":
    logger.info("Starting storage migration...")
    
    if len(sys.argv) > 1 and sys.argv[1] == "--verify":
        success = verify_migration()
    else:
        success = migrate_storage()
        if success:
            verify_migration()
    
    sys.exit(0 if success else 1)
