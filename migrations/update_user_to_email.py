from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

if __name__ == "__main__":
    DATABASE_URL = settings.SQLALCHEMY_DATABASE_URI
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    with SessionLocal() as db:
        try:
            # Check if email column exists
            from sqlalchemy.inspect import inspect
            inspector = inspect(engine)
            columns = [c['name'] for c in inspector.get_columns('users')]
            
            if 'email' not in columns:
                print("Adding email column to users table...")
                db.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR(150)"))
                db.commit()
                print("✅ Email column added successfully")
            else:
                print("Email column already exists")
            
            # Check if username column exists and if we need to migrate data
            if 'username' in columns:
                print("Checking for existing users to migrate...")
                result = db.execute(text("SELECT COUNT(*) FROM users WHERE username IS NOT NULL AND email IS NULL"))
                count = result.scalar()
                
                if count > 0:
                    print(f"Found {count} users to migrate from username to email...")
                    # For now, we'll copy username to email (in production, you'd want to handle this differently)
                    db.execute(text("UPDATE users SET email = username WHERE email IS NULL AND username IS NOT NULL"))
                    db.commit()
                    print("✅ Migrated username data to email column")
                else:
                    print("No users found to migrate")
            
            # Make email column unique and not null
            print("Making email column unique and not null...")
            db.execute(text("ALTER TABLE users ALTER COLUMN email SET NOT NULL"))
            db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email)"))
            db.commit()
            print("✅ Email column is now unique and not null")
            
            # Optionally drop username column (uncomment if you want to remove it)
            # print("Dropping username column...")
            # db.execute(text("ALTER TABLE users DROP COLUMN username"))
            # db.commit()
            # print("✅ Username column dropped")
            
            print("✅ Migration completed successfully!")
            
        except Exception as e:
            db.rollback()
            print(f"❌ Error during migration: {e}")
            raise
