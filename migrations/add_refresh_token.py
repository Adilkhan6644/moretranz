from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

if __name__ == "__main__":
    DATABASE_URL = settings.SQLALCHEMY_DATABASE_URI
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    with SessionLocal() as db:
        try:
            # Check if refresh_token column exists
            from sqlalchemy.inspect import inspect
            inspector = inspect(engine)
            columns = [c['name'] for c in inspector.get_columns('users')]
            
            if 'refresh_token' not in columns:
                print("Adding refresh_token column to users table...")
                db.execute(text("ALTER TABLE users ADD COLUMN refresh_token VARCHAR(500)"))
                db.commit()
                print("✅ Refresh token column added successfully")
            else:
                print("Refresh token column already exists")
            
            print("✅ Migration completed successfully!")
            
        except Exception as e:
            db.rollback()
            print(f"❌ Error during migration: {e}")
            raise
