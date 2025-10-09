from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

if __name__ == "__main__":
    DATABASE_URL = settings.SQLALCHEMY_DATABASE_URI
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    with SessionLocal() as db:
        try:
            # Check if columns exist
            from sqlalchemy.inspect import inspect
            inspector = inspect(engine)
            columns = [c['name'] for c in inspector.get_columns('email_config')]
            
            if 'auto_download_enabled' not in columns:
                print("Adding auto_download_enabled column to email_config table...")
                db.execute(text("ALTER TABLE email_config ADD COLUMN auto_download_enabled BOOLEAN DEFAULT FALSE"))
                db.commit()
                print("✅ auto_download_enabled column added successfully")
            else:
                print("auto_download_enabled column already exists")
            
            if 'download_path' not in columns:
                print("Adding download_path column to email_config table...")
                db.execute(text("ALTER TABLE email_config ADD COLUMN download_path VARCHAR(500)"))
                db.commit()
                print("✅ download_path column added successfully")
            else:
                print("download_path column already exists")
            
            print("✅ Migration completed successfully!")
            
        except Exception as e:
            db.rollback()
            print(f"❌ Error during migration: {e}")
            raise
