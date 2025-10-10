#!/usr/bin/env python3
"""
Automatic script to update download path when frontend config changes
This script monitors the database and updates Docker when the path changes
"""
import os
import subprocess
import time
import sys
from pathlib import Path

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.db.session import SessionLocal
from app.models.order import EmailConfig

def get_current_download_path():
    """Get the current download path from database"""
    try:
        db = SessionLocal()
        config = db.query(EmailConfig).first()
        db.close()
        return config.download_path if config else None
    except Exception as e:
        print(f"Error getting download path: {e}")
        return None

def get_docker_download_path():
    """Get the current Docker download path from environment"""
    return os.environ.get('DOWNLOAD_PATH', './downloads')

def update_docker_path(new_path):
    """Update Docker containers with new download path"""
    print(f"🔄 Updating Docker download path to: {new_path}")
    
    # Set environment variable
    os.environ['DOWNLOAD_PATH'] = new_path
    
    # Create/update .env file
    env_content = f"DOWNLOAD_PATH={new_path}\n"
    with open('.env', 'w') as f:
        f.write(env_content)
    
    print(f"✅ Updated .env file with DOWNLOAD_PATH={new_path}")
    
    # Restart Docker containers
    try:
        print("🔄 Restarting Docker containers...")
        subprocess.run(['docker-compose', 'down'], check=True, capture_output=True)
        subprocess.run(['docker-compose', 'up', '-d'], check=True, capture_output=True)
        print("✅ Docker containers restarted with new path")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error restarting Docker: {e}")
        return False

def monitor_path_changes():
    """Monitor database for download path changes"""
    print("🔍 Monitoring download path changes...")
    print("Press Ctrl+C to stop monitoring")
    
    last_path = get_docker_download_path()
    print(f"📁 Current Docker path: {last_path}")
    
    try:
        while True:
            # Check database for path changes
            db_path = get_current_download_path()
            
            if db_path and db_path != last_path:
                print(f"\n🔄 Path change detected!")
                print(f"   Old path: {last_path}")
                print(f"   New path: {db_path}")
                
                # Update Docker
                if update_docker_path(db_path):
                    last_path = db_path
                    print(f"✅ Successfully updated to: {db_path}")
                else:
                    print(f"❌ Failed to update to: {db_path}")
            
            # Wait 5 seconds before checking again
            time.sleep(5)
            
    except KeyboardInterrupt:
        print("\n👋 Stopping path monitor...")

def main():
    """Main function"""
    if len(sys.argv) > 1 and sys.argv[1] == "monitor":
        monitor_path_changes()
    else:
        # One-time update
        db_path = get_current_download_path()
        if db_path:
            print(f"📁 Database path: {db_path}")
            current_docker_path = get_docker_download_path()
            print(f"📁 Docker path: {current_docker_path}")
            
            if db_path != current_docker_path:
                print("🔄 Paths don't match, updating Docker...")
                update_docker_path(db_path)
            else:
                print("✅ Paths already match")
        else:
            print("❌ No download path configured in database")

if __name__ == "__main__":
    main()
