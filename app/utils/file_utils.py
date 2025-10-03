import os
import re
import requests
from typing import Optional
from urllib.parse import urlparse, parse_qs

def create_folder(base_path: str, po_number: str, customer_name: str) -> str:
    """Creates a folder based on PO Number and customer name."""
    folder_name = f"{po_number}_{customer_name.replace(' ', '_')}"
    folder_path = os.path.join(base_path, folder_name)
    os.makedirs(folder_path, exist_ok=True)
    return folder_path

def sanitize_filename(filename: str) -> str:
    """Remove or replace invalid characters for file systems."""
    return re.sub(r'[<>:"/\\|?*]', '_', filename)

def save_attachment(url: str, folder_path: str, file_name: Optional[str] = None) -> Optional[str]:
    """Downloads an attachment from a URL and saves it to the specified folder."""
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()

        if not file_name:
            parsed_url = urlparse(url)
            file_name = os.path.basename(parsed_url.path) or "downloaded_file"

        file_name = sanitize_filename(file_name)
        file_path = os.path.join(folder_path, file_name)

        os.makedirs(folder_path, exist_ok=True)

        with open(file_path, 'wb') as file:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    file.write(chunk)

        return file_path
    except Exception as e:
        print(f"Failed to save attachment: {str(e)}")
        return None
