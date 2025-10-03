"""
Migration script to add email_password column to email_config table
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import engine
from sqlalchemy import text

def run_migration():
    print("🔄 Starting migration: Adding email_password column to email_config table...")
    
    with engine.connect() as connection:
        try:
            # Check if column exists
            check_sql = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'email_config' AND column_name = 'email_password';
            """)
            result = connection.execute(check_sql)
            if not result.fetchone():
                # Add the column if it doesn't exist
                add_column_sql = text("""
                    ALTER TABLE email_config
                    ADD COLUMN email_password VARCHAR(255);
                """)
                connection.execute(add_column_sql)
                connection.commit()
                print("✅ Successfully added email_password column")
            else:
                print("ℹ️ email_password column already exists")
                
            print("✅ Migration completed successfully!")
            
        except Exception as e:
            print(f"❌ Error during migration: {str(e)}")
            connection.rollback()
            raise

if __name__ == "__main__":
    run_migration()
