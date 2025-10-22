"""
Migration: Clear old default values from email configuration columns
This migration sets old default values to NULL so that users see blank fields
instead of the old defaults that were applied before we removed them.
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the parent directory to the path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings

def run_migration():
    """Run the migration to clear old default values from email configuration columns"""
    
    # Create database connection - use settings from environment
    database_url = settings.SQLALCHEMY_DATABASE_URI
    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("🔄 Starting migration: Clear old default values from email configuration columns")
        
        # Clear old default values that were applied before we removed defaults
        print("📧 Clearing old default values...")
        
        # Set imap_server to NULL where it's the old default
        result = session.execute(text("""
            UPDATE users 
            SET imap_server = NULL 
            WHERE imap_server = 'imap.gmail.com' 
            AND email_address IS NULL 
            AND email_app_password IS NULL
        """))
        print(f"✅ Cleared imap_server default for {result.rowcount} users")
        
        # Set max_age_days to NULL where it's the old default
        result = session.execute(text("""
            UPDATE users 
            SET max_age_days = NULL 
            WHERE max_age_days = 10 
            AND email_address IS NULL 
            AND email_app_password IS NULL
        """))
        print(f"✅ Cleared max_age_days default for {result.rowcount} users")
        
        # Set sleep_time to NULL where it's the old default
        result = session.execute(text("""
            UPDATE users 
            SET sleep_time = NULL 
            WHERE sleep_time = 5 
            AND email_address IS NULL 
            AND email_app_password IS NULL
        """))
        print(f"✅ Cleared sleep_time default for {result.rowcount} users")
        
        # Commit all changes
        session.commit()
        print("✅ Migration completed successfully!")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Migration failed: {str(e)}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    run_migration()
