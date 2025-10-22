"""
Migration: Remove default values from email configuration columns
This migration removes the default values from the email configuration columns
so that new users start with null/empty values instead of defaults.
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the parent directory to the path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings

def run_migration():
    """Run the migration to remove default values from email configuration columns"""
    
    # Create database connection - use settings from environment
    database_url = settings.SQLALCHEMY_DATABASE_URI
    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("🔄 Starting migration: Remove default values from email configuration columns")
        
        # Remove default values from columns
        print("📧 Removing default values from email configuration columns...")
        
        # Remove default from imap_server
        session.execute(text("""
            ALTER TABLE users 
            ALTER COLUMN imap_server DROP DEFAULT
        """))
        print("✅ Removed default from imap_server column")
        
        # Remove default from max_age_days
        session.execute(text("""
            ALTER TABLE users 
            ALTER COLUMN max_age_days DROP DEFAULT
        """))
        print("✅ Removed default from max_age_days column")
        
        # Remove default from sleep_time
        session.execute(text("""
            ALTER TABLE users 
            ALTER COLUMN sleep_time DROP DEFAULT
        """))
        print("✅ Removed default from sleep_time column")
        
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
