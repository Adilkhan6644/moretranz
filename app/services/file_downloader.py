import os
import shutil
import asyncio
from pathlib import Path
from typing import Optional
from app.models.order import Attachment
from app.db.session import SessionLocal
from app.models.order import EmailConfig as EmailConfigModel


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
            
            # Map the download path to the container path
            # If the path is D:\application, map it to /app/downloads inside container
            if email_config.download_path and email_config.download_path.startswith('D:\\application'):
                download_dir = Path('/app/downloads')
            else:
                download_dir = Path(email_config.download_path)
            
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
