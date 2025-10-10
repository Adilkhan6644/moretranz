import os
import shutil
import asyncio
from pathlib import Path
from typing import Optional
from app.models.order import Attachment, EmailConfig as EmailConfigModel
from app.db.session import SessionLocal


class FileDownloader:
    def __init__(self):
        self.db = SessionLocal()
    
    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()
    
    async def download_attachment(self, attachment: Attachment) -> bool:
        """Download an attachment to the configured download path"""
        try:
            # Get email config
            email_config = self.db.query(EmailConfigModel).first()
            
            if not email_config or not email_config.auto_download_enabled:
                print("Auto-download is disabled or not configured")
                return False
            
            if not email_config.download_path:
                print("Download path is not configured")
                return False
            
            # Use the configured download path
            # In Docker: always use /app/downloads (mapped to ./downloads on host)
            # Then copy to the user's configured path
            container_download_dir = Path('/app/downloads')
            
            # Log the configured path for reference
            print(f"📁 Configured download path: {email_config.download_path}")
            print(f"📁 Container download directory: {container_download_dir}")
            
            # Create the download directory in container
            download_dir = container_download_dir
            
            download_dir.mkdir(parents=True, exist_ok=True)
            
            # Create subdirectory for this order
            order_dir = download_dir / f"Order_{attachment.order.po_number}"
            order_dir.mkdir(exist_ok=True)
            
            # Source file path
            source_path = Path(attachment.file_path)
            
            if not source_path.exists():
                print(f"Source file does not exist: {source_path}")
                return False
            
            # Destination file path
            dest_path = order_dir / attachment.file_name
            
            # Copy file
            shutil.copy2(source_path, dest_path)
            
            print(f"✅ Auto-downloaded: {attachment.file_name} to {dest_path}")
            
            # Also copy to user's configured path if different
            if email_config.download_path and email_config.download_path != str(container_download_dir):
                try:
                    user_download_dir = Path(email_config.download_path)
                    user_order_dir = user_download_dir / f"Order_{attachment.order.po_number}"
                    user_order_dir.mkdir(parents=True, exist_ok=True)
                    
                    user_dest_path = user_order_dir / attachment.file_name
                    shutil.copy2(source_path, user_dest_path)
                    
                    print(f"✅ Also copied to user path: {user_dest_path}")
                except Exception as e:
                    print(f"⚠️ Failed to copy to user path: {str(e)}")
            
            return True
            
        except Exception as e:
            print(f"❌ Auto-download failed for {attachment.file_name}: {str(e)}")
            return False
    
    async def download_all_order_attachments(self, order_id: int) -> dict:
        """Download all attachments for an order"""
        try:
            # Get all attachments for the order
            attachments = self.db.query(Attachment).filter(Attachment.order_id == order_id).all()
            
            if not attachments:
                return {"success": False, "message": "No attachments found for this order"}
            
            results = []
            success_count = 0
            
            for attachment in attachments:
                success = await self.download_attachment(attachment)
                results.append({
                    "file_name": attachment.file_name,
                    "success": success
                })
                if success:
                    success_count += 1
            
            return {
                "success": True,
                "message": f"Downloaded {success_count}/{len(attachments)} files",
                "results": results
            }
            
        except Exception as e:
            return {"success": False, "message": f"Download failed: {str(e)}"}
    
    def is_auto_download_enabled(self) -> bool:
        """Check if auto-download is enabled"""
        try:
            email_config = self.db.query(EmailConfigModel).first()
            return email_config and email_config.auto_download_enabled and email_config.download_path
        except:
            return False
    
    def get_download_path(self) -> Optional[str]:
        """Get the configured download path"""
        try:
            email_config = self.db.query(EmailConfigModel).first()
            return email_config.download_path if email_config else None
        except:
            return None


# Global instance
file_downloader = FileDownloader()
