#!/usr/bin/env python3
"""
Script to update the download path and restart Docker containers
"""
import os
import subprocess
import sys
from pathlib import Path

def update_download_path(new_path: str):
    """Update the download path and restart Docker containers"""
    
    print(f"🔄 Updating download path to: {new_path}")
    
    # Set the environment variable
    os.environ['DOWNLOAD_PATH'] = new_path
    
    # Create a .env file with the new path
    env_content = f"DOWNLOAD_PATH={new_path}\n"
    
    with open('.env', 'w') as f:
        f.write(env_content)
    
    print(f"✅ Created .env file with DOWNLOAD_PATH={new_path}")
    
    # Restart Docker containers
    print("🔄 Restarting Docker containers...")
    
    try:
        # Stop containers
        subprocess.run(['docker-compose', 'down'], check=True)
        print("✅ Stopped containers")
        
        # Start containers with new environment
        subprocess.run(['docker-compose', 'up', '-d'], check=True)
        print("✅ Started containers with new download path")
        
        print(f"\n🎉 Download path updated successfully!")
        print(f"📁 Files will now be saved to: {new_path}")
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Error restarting containers: {e}")
        return False
    
    return True

def main():
    if len(sys.argv) != 2:
        print("Usage: python update_download_path.py <path>")
        print("Example: python update_download_path.py C:/downloads")
        sys.exit(1)
    
    new_path = sys.argv[1]
    
    if not os.path.exists(new_path):
        print(f"⚠️ Path does not exist: {new_path}")
        create = input("Do you want to create it? (y/n): ")
        if create.lower() == 'y':
            os.makedirs(new_path, exist_ok=True)
            print(f"✅ Created directory: {new_path}")
        else:
            print("❌ Aborted")
            sys.exit(1)
    
    success = update_download_path(new_path)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
