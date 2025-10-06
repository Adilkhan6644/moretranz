from sqlalchemy import text
from app.db.session import engine

def upgrade():
    """Add full_name column to users table"""
    with engine.connect() as conn:
        # Add the column
        conn.execute(text("ALTER TABLE users ADD COLUMN full_name VARCHAR(150)"))
        conn.commit()
        print("✅ Added full_name column to users table")

def downgrade():
    """Remove full_name column from users table"""
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE users DROP COLUMN full_name"))
        conn.commit()
        print("✅ Removed full_name column from users table")

if __name__ == "__main__":
    upgrade()
