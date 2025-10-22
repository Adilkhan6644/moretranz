"""
Migration: Rename email_password column to email_app_password
This migration renames the email_password column to email_app_password to clarify
that it should contain the Gmail App Password, not the user's login password.
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the parent directory to the path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings

def run_migration():
    """Run the migration to rename email_password column to email_app_password"""
    
    # Create database connection - use settings from environment
    database_url = settings.SQLALCHEMY_DATABASE_URI
    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("🔄 Starting migration: Rename email_password to email_app_password")
        
        # Check if email_password column exists
        result = session.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'email_password'
        """))
        
        if result.fetchone():
            # Check if email_app_password column already exists
            result2 = session.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'email_app_password'
            """))
            
            if not result2.fetchone():
                # Rename the column
                session.execute(text("""
                    ALTER TABLE users 
                    RENAME COLUMN email_password TO email_app_password
                """))
                print("✅ Renamed email_password column to email_app_password")
            else:
                print("ℹ️ email_app_password column already exists, skipping rename")
        else:
            print("ℹ️ email_password column not found, skipping rename")
        
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
