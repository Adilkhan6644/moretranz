from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.executors.asyncio import AsyncIOExecutor
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.email_processor import EmailProcessor
from app.websocket_manager import manager
import asyncio
import logging

logger = logging.getLogger(__name__)

class EmailScheduler:
    def __init__(self):
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
        self.email_processor = None
        self.is_running = False
        
    async def start_processing(self, sleep_time: int = 5):
        """Start the email processing scheduler"""
        if self.is_running:
            logger.warning("Email processing is already running")
            return
            
        logger.info(f"Starting email processing scheduler with {sleep_time}s interval")
        
        # Get database session
        db = next(get_db())
        self.email_processor = EmailProcessor(db)
        
        # Add the email monitoring job
        self.scheduler.add_job(
            self._monitor_emails_job,
            trigger=IntervalTrigger(seconds=sleep_time),
            id='email_monitor',
            name='Email Monitor',
            replace_existing=True
        )
        
        self.scheduler.start()
        self.is_running = True
        
        # Broadcast status update
        await self._broadcast_status_update({"status": "running", "is_processing": True})
        
        logger.info("Email processing scheduler started successfully")
        
    async def stop_processing(self):
        """Stop the email processing scheduler"""
        if not self.is_running:
            logger.warning("Email processing is not running")
            return
            
        logger.info("Stopping email processing scheduler")
        
        self.scheduler.shutdown(wait=True)
        self.is_running = False
        
        # Broadcast status update
        await self._broadcast_status_update({"status": "stopped", "is_processing": False})
        
        logger.info("Email processing scheduler stopped")
        
    async def _monitor_emails_job(self):
        """Job function that runs the email monitoring"""
        try:
            if self.email_processor:
                # Set the processor to running state
                self.email_processor.is_running = True
                await self.email_processor.monitor_emails()
        except Exception as e:
            logger.error(f"Error in email monitoring job: {str(e)}")
            # Don't re-raise to prevent job from being marked as failed
            
    async def _broadcast_status_update(self, status_data: dict):
        """Broadcast status update to WebSocket clients"""
        try:
            await manager.broadcast_status_update(status_data)
        except Exception as e:
            logger.error(f"Failed to broadcast status update: {str(e)}")
            
    def get_status(self) -> dict:
        """Get current scheduler status"""
        return {
            "is_running": self.is_running,
            "scheduler_running": self.scheduler.running if self.scheduler else False,
            "jobs": [
                {
                    "id": job.id,
                    "name": job.name,
                    "next_run": job.next_run_time.isoformat() if job.next_run_time else None
                }
                for job in self.scheduler.get_jobs()
            ] if self.scheduler else []
        }
        
    def update_interval(self, sleep_time: int):
        """Update the monitoring interval"""
        if self.is_running and self.scheduler:
            # Remove existing job
            self.scheduler.remove_job('email_monitor')
            # Add new job with updated interval
            self.scheduler.add_job(
                self._monitor_emails_job,
                trigger=IntervalTrigger(seconds=sleep_time),
                id='email_monitor',
                name='Email Monitor',
                replace_existing=True
            )
            logger.info(f"Updated email monitoring interval to {sleep_time}s")

# Global scheduler instance
email_scheduler = EmailScheduler()
