"""
Migration script to add pdf_path column to attachments table
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import engine
from sqlalchemy import text

def run_migration():
    print("🔄 Starting migration: Adding pdf_path column to attachments table...")
    
    with engine.connect() as connection:
        try:
            # Check if column exists
            check_sql = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'attachments' AND column_name = 'pdf_path';
            """)
            result = connection.execute(check_sql)
            if not result.fetchone():
                # Add the column if it doesn't exist
                add_column_sql = text("""
                    ALTER TABLE attachments
                    ADD COLUMN pdf_path VARCHAR(255);
                """)
                connection.execute(add_column_sql)
                connection.commit()
                print("✅ Successfully added pdf_path column")
            else:
                print("ℹ️ pdf_path column already exists")
                
            # Update existing records to set pdf_path based on file_path
            update_sql = text("""
                UPDATE attachments
                SET pdf_path = 
                    CASE 
                        WHEN file_type IN ('png', 'jpg', 'jpeg', 'gif', 'bmp')
                        THEN REGEXP_REPLACE(file_path, '\.[^.]+$', '_label.pdf')
                        WHEN file_type = 'pdf'
                        THEN file_path
                        ELSE NULL
                    END
                WHERE pdf_path IS NULL;
            """)
            connection.execute(update_sql)
            connection.commit()
            print("✅ Successfully updated existing records")
            
            print("✅ Migration completed successfully!")
            
        except Exception as e:
            print(f"❌ Error during migration: {str(e)}")
            connection.rollback()
            raise

if __name__ == "__main__":
    run_migration()
