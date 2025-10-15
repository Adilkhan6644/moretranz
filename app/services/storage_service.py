import os
import shutil
from pathlib import Path
from typing import Optional, List
from datetime import datetime
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class StorageService:
    """Service for managing file storage operations"""
    
    def __init__(self):
        self.attachments_folder = Path(settings.ATTACHMENTS_FOLDER)
        self.logs_folder = Path(settings.LOGS_FOLDER)
        self.max_file_size = settings.MAX_FILE_SIZE_MB * 1024 * 1024  # Convert to bytes
        self.allowed_extensions = settings.allowed_file_types_list
        
        # Ensure directories exist
        self._ensure_directories()
    
    def _ensure_directories(self):
        """Create necessary directories if they don't exist"""
        try:
            self.attachments_folder.mkdir(parents=True, exist_ok=True)
            self.logs_folder.mkdir(parents=True, exist_ok=True)
            logger.info(f"Storage directories ensured: {self.attachments_folder}, {self.logs_folder}")
        except Exception as e:
            logger.error(f"Failed to create storage directories: {str(e)}")
            raise
    
    def get_attachment_path(self, order_id: int, filename: str) -> Path:
        """Get the full path for an attachment file"""
        # Create order-specific subdirectory
        order_folder = self.attachments_folder / f"order_{order_id}"
        order_folder.mkdir(exist_ok=True)
        return order_folder / filename
    
    def get_pdf_path(self, order_id: int, original_filename: str) -> Path:
        """Get the full path for a PDF version of an attachment"""
        order_folder = self.attachments_folder / f"order_{order_id}"
        order_folder.mkdir(exist_ok=True)
        # Convert original filename to PDF
        base_name = Path(original_filename).stem
        return order_folder / f"{base_name}.pdf"
    
    def save_file(self, file_path: str, content: bytes, order_id: int) -> Optional[str]:
        """Save file content to storage"""
        try:
            filename = Path(file_path).name
            full_path = self.get_attachment_path(order_id, filename)
            
            # Validate file size
            if len(content) > self.max_file_size:
                logger.error(f"File {filename} exceeds maximum size limit")
                return None
            
            # Validate file extension
            file_ext = Path(filename).suffix.lower().lstrip('.')
            if file_ext not in self.allowed_extensions:
                logger.error(f"File type {file_ext} not allowed")
                return None
            
            # Write file
            with open(full_path, 'wb') as f:
                f.write(content)
            
            logger.info(f"File saved successfully: {full_path}")
            return str(full_path)
            
        except Exception as e:
            logger.error(f"Failed to save file {file_path}: {str(e)}")
            return None
    
    def file_exists(self, file_path: str) -> bool:
        """Check if a file exists"""
        return os.path.exists(file_path)
    
    def get_file_size(self, file_path: str) -> int:
        """Get file size in bytes"""
        try:
            return os.path.getsize(file_path)
        except OSError:
            return 0
    
    def delete_file(self, file_path: str) -> bool:
        """Delete a file"""
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"File deleted: {file_path}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to delete file {file_path}: {str(e)}")
            return False
    
    def delete_order_files(self, order_id: int) -> bool:
        """Delete all files for a specific order"""
        try:
            order_folder = self.attachments_folder / f"order_{order_id}"
            if order_folder.exists():
                shutil.rmtree(order_folder)
                logger.info(f"Order files deleted: {order_folder}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to delete order files for order {order_id}: {str(e)}")
            return False
    
    def get_storage_stats(self) -> dict:
        """Get storage statistics"""
        try:
            total_size = 0
            file_count = 0
            
            for root, dirs, files in os.walk(self.attachments_folder):
                for file in files:
                    file_path = os.path.join(root, file)
                    total_size += self.get_file_size(file_path)
                    file_count += 1
            
            return {
                "total_size_bytes": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "file_count": file_count,
                "attachments_folder": str(self.attachments_folder),
                "logs_folder": str(self.logs_folder)
            }
        except Exception as e:
            logger.error(f"Failed to get storage stats: {str(e)}")
            return {}
    
    def cleanup_old_files(self, days_old: int = 30) -> int:
        """Clean up files older than specified days"""
        try:
            cutoff_time = datetime.now().timestamp() - (days_old * 24 * 60 * 60)
            deleted_count = 0
            
            for root, dirs, files in os.walk(self.attachments_folder):
                for file in files:
                    file_path = os.path.join(root, file)
                    if os.path.getmtime(file_path) < cutoff_time:
                        if self.delete_file(file_path):
                            deleted_count += 1
            
            logger.info(f"Cleaned up {deleted_count} old files")
            return deleted_count
        except Exception as e:
            logger.error(f"Failed to cleanup old files: {str(e)}")
            return 0

# Global storage service instance
storage_service = StorageService()
