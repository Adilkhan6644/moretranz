"""
Script to run all database migrations
"""
import importlib
import os

def run_migrations():
    print("🔄 Running database migrations...")
    
    # List of migrations to run in order
    migrations = [
        'add_pdf_path'
    ]
    
    for migration in migrations:
        try:
            print(f"\n📦 Running migration: {migration}")
            migration_module = importlib.import_module(f"migrations.{migration}")
            migration_module.run_migration()
        except Exception as e:
            print(f"❌ Error running migration {migration}: {str(e)}")
            raise
    
    print("\n✅ All migrations completed successfully!")

if __name__ == "__main__":
    run_migrations()
