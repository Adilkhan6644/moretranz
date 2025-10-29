from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.executors.asyncio import AsyncIOExecutor
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.email_processor import EmailProcessor
from app.websocket_manager import manager
from app.models.user import User
import asyncio
import logging
from typing import Dict

logger = logging.getLogger(__name__)

class UserEmailScheduler:
    """Per-user email scheduler for isolated processing"""
    
    def __init__(self, user_id: int, sleep_time: int):
        self.user_id = user_id
        self.sleep_time = sleep_time
        self.is_running = False
        self.email_processor = None
        
        # Configure job stores and executors
        jobstores = {
            'default': MemoryJobStore()
        }
        executors = {
            'default': AsyncIOExecutor()
        }
        job_defaults = {
            'coalesce': True,
            'max_instances': 1,
            'misfire_grace_time': 30
        }
        
        self.scheduler = AsyncIOScheduler(
            jobstores=jobstores,
            executors=executors,
            job_defaults=job_defaults
        )
        
    async def start(self):
        """Start the email processing for this user"""
        if self.is_running:
            logger.warning(f"Email processing already running for user {self.user_id}")
            return
            
        logger.info(f"Starting email processing for user {self.user_id} with {self.sleep_time}s interval")
        
        # Get database session
        db = next(get_db())
        self.email_processor = EmailProcessor(db)
        
        # Add the email monitoring job
        self.scheduler.add_job(
            self._monitor_emails_job,
            trigger=IntervalTrigger(seconds=self.sleep_time),
            id=f'email_monitor_user_{self.user_id}',
            name=f'Email Monitor - User {self.user_id}',
            replace_existing=True
        )
        
        self.scheduler.start()
        self.is_running = True
        
        # Broadcast user-specific status update
        await self._broadcast_status_update(self.user_id, {
            "status": "running", 
            "is_processing": True,
            "user_id": self.user_id
        })
        
        logger.info(f"Email processing started for user {self.user_id}")
        
    async def stop(self):
        """Stop the email processing for this user"""
        if not self.is_running:
            logger.warning(f"Email processing not running for user {self.user_id}")
            return
            
        logger.info(f"Stopping email processing for user {self.user_id}")
        
        self.scheduler.shutdown(wait=True)
        self.is_running = False
        
        # Broadcast user-specific status update
        await self._broadcast_status_update(self.user_id, {
            "status": "stopped", 
            "is_processing": False,
            "user_id": self.user_id
        })
        
        logger.info(f"Email processing stopped for user {self.user_id}")
        
    async def _monitor_emails_job(self):
        """Job function that monitors emails for this specific user"""
        try:
            if self.email_processor:
                # Get the user from database
                db = next(get_db())
                user = db.query(User).filter(User.id == self.user_id).first()
                
                if not user or not user.is_active:
                    logger.warning(f"User {self.user_id} not found or inactive, stopping processing")
                    await self.stop()
                    return
                
                # Process emails only for THIS user
                self.email_processor.is_running = True
                await self.email_processor.monitor_user_emails(user)
        except Exception as e:
            logger.error(f"Error in email monitoring job for user {self.user_id}: {str(e)}")
            
    async def _broadcast_status_update(self, user_id: int, status_data: dict):
        """Broadcast status update to WebSocket clients"""
        try:
            await manager.broadcast_status_update(status_data)
        except Exception as e:
            logger.error(f"Failed to broadcast status update for user {user_id}: {str(e)}")
            
    def get_status(self) -> dict:
        """Get current scheduler status for this user"""
        return {
            "user_id": self.user_id,
            "is_running": self.is_running,
            "scheduler_running": self.scheduler.running if self.scheduler else False,
            "sleep_time": self.sleep_time,
            "jobs": [
                {
                    "id": job.id,
                    "name": job.name,
                    "next_run": job.next_run_time.isoformat() if job.next_run_time else None
                }
                for job in self.scheduler.get_jobs()
            ] if self.scheduler else []
        }


class EmailSchedulerManager:
    """Manager for all user-specific email schedulers"""
    
    def __init__(self):
        self.user_schedulers: Dict[int, UserEmailScheduler] = {}
        
    async def start_user_processing(self, user_id: int, sleep_time: int = 5):
        """Start email processing for a specific user"""
        if user_id in self.user_schedulers and self.user_schedulers[user_id].is_running:
            logger.warning(f"Email processing already running for user {user_id}")
            return
        
        # Create new scheduler for this user
        scheduler = UserEmailScheduler(user_id, sleep_time)
        self.user_schedulers[user_id] = scheduler
        
        await scheduler.start()
        
    async def stop_user_processing(self, user_id: int):
        """Stop email processing for a specific user"""
        if user_id not in self.user_schedulers:
            logger.warning(f"No scheduler found for user {user_id}")
            return
        
        scheduler = self.user_schedulers[user_id]
        await scheduler.stop()
        
        # Clean up the scheduler
        del self.user_schedulers[user_id]
        
    def is_user_processing(self, user_id: int) -> bool:
        """Check if email processing is running for a user"""
        return user_id in self.user_schedulers and self.user_schedulers[user_id].is_running
        
    def get_user_status(self, user_id: int) -> dict:
        """Get processing status for a specific user"""
        if user_id not in self.user_schedulers:
            return {
                "user_id": user_id,
                "is_running": False,
                "scheduler_running": False
            }
        
        return self.user_schedulers[user_id].get_status()
        
    def get_all_active_users(self) -> list:
        """Get list of all users with active processing"""
        return [
            user_id 
            for user_id, scheduler in self.user_schedulers.items() 
            if scheduler.is_running
        ]

# Global scheduler manager instance
email_scheduler_manager = EmailSchedulerManager()
