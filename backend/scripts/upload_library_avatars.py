import os
import sys

# Add backend directory to path
sys.path.append('/app')

from app.services.r2_storage_service import r2_storage
from app.services.image_processing import image_processing

def upload_library():
    library_local_path = "/app/static/library/avatars"
    if not os.path.exists(library_local_path):
        print(f"Error: {library_local_path} not found")
        return

    files = [f for f in os.listdir(library_local_path) if f.endswith(('.png', '.webp', '.jpg', '.jpeg'))]
    print(f"Found {len(files)} avatars to optimize and upload.")

    for f in files:
        file_path = os.path.join(library_local_path, f)
        # Rename destination to .webp
        name_only = os.path.splitext(f)[0]
        r2_key = f"library/avatars/{name_only}.webp"
        
        with open(file_path, 'rb') as img_file:
            original_content = img_file.read()
            
            try:
                print(f"Optimizing {f}...")
                processed_stream = image_processing.process_avatar(original_content)
                optimized_content = processed_stream.getvalue()
                
                print(f"Uploading {r2_key} ({len(optimized_content)//1024} KB)...")
                r2_storage.upload_file_direct(r2_key, optimized_content, 'image/webp')
            except Exception as e:
                print(f"Failed to process {f}: {e}")
            
    print("Upload complete.")

if __name__ == "__main__":
    upload_library()
