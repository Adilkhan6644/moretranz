"""
Migration: Add user-specific email configuration fields
This migration adds email configuration fields to the User model and updates the Order model
to support user isolation.
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the parent directory to the path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings

def run_migration():
    """Run the migration to add user email configuration fields"""
    
    # Create database connection - use settings from environment
    database_url = settings.SQLALCHEMY_DATABASE_URI
    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("🔄 Starting migration: Add user email configuration fields")
        
        # Add email configuration fields to users table
        print("📧 Adding email configuration fields to users table...")
        
        # Check if columns already exist
        result = session.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'email_address'
        """))
        
        if not result.fetchone():
            # Add email configuration columns
            session.execute(text("""
                ALTER TABLE users 
                ADD COLUMN email_address VARCHAR(255),
                ADD COLUMN email_app_password VARCHAR(255),
                ADD COLUMN imap_server VARCHAR(255) DEFAULT 'imap.gmail.com',
                ADD COLUMN allowed_senders TEXT,
                ADD COLUMN max_age_days INTEGER DEFAULT 10,
                ADD COLUMN sleep_time INTEGER DEFAULT 5
            """))
            print("✅ Added email configuration fields to users table")
        else:
            print("ℹ️ Email configuration fields already exist in users table")
        
        # Update orders table to add user_id and remove unique constraint on po_number
        print("📦 Updating orders table for user isolation...")
        
        # Check if user_id column exists
        result = session.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'orders' AND column_name = 'user_id'
        """))
        
        if not result.fetchone():
            # Add user_id column
            session.execute(text("""
                ALTER TABLE orders 
                ADD COLUMN user_id INTEGER REFERENCES users(id)
            """))
            print("✅ Added user_id column to orders table")
        else:
            print("ℹ️ user_id column already exists in orders table")
        
        # Check if po_number has unique constraint
        result = session.execute(text("""
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'orders' 
            AND constraint_type = 'UNIQUE' 
            AND constraint_name LIKE '%po_number%'
        """))
        
        unique_constraint = result.fetchone()
        if unique_constraint:
            # Drop the unique constraint on po_number
            constraint_name = unique_constraint[0]
            session.execute(text(f"ALTER TABLE orders DROP CONSTRAINT {constraint_name}"))
            print(f"✅ Removed unique constraint {constraint_name} from po_number")
        else:
            print("ℹ️ No unique constraint found on po_number")
        
        # Create index on user_id for better performance
        result = session.execute(text("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'orders' AND indexname = 'ix_orders_user_id'
        """))
        
        if not result.fetchone():
            session.execute(text("CREATE INDEX ix_orders_user_id ON orders (user_id)"))
            print("✅ Created index on user_id column")
        else:
            print("ℹ️ Index on user_id already exists")
        
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
