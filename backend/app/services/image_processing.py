"""
Image Processing Service

Handles image validation, sanitization, and optimization.
Generates thumbnails and medium-sized variants in WebP format.
"""

import io
import logging
import magic
from typing import Dict, Optional, Tuple
from PIL import Image, ImageOps, ExifTags

# Security: Prevent Decompression Bomb attacks
# 80MP limit (approx 8944x8944) covers high-end DSLRs but stops massive malicious files
Image.MAX_IMAGE_PIXELS = 80_000_000

logger = logging.getLogger(__name__)

# Constants
THUMBNAIL_SIZE = (400, 400)  # Box fit, not crop (unless we want square crops later)
MEDIUM_SIZE = (1200, 1200)
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15MB limit

class ImageProcessingService:
    """Service for processing uploaded images."""

    def process_image(self, file_bytes: bytes, filename: str) -> Dict[str, io.BytesIO]:
        """
        Process an uploaded image:
        1. Validate (Magic numbers, size).
        2. Sanitize (Re-encode original as JPEG/PNG, strip EXIF).
        3. Generate Medium (WebP).
        4. Generate Thumbnail (WebP).
        
        Args:
            file_bytes: Raw file content.
            filename: Original filename (for logging/extension hints).
            
        Returns:
            Dict containing 'original', 'medium', and 'thumbnail' streams.
            Keys are suffixes (empty string for original).
            Values are io.BytesIO objects ready for upload.
        """
        
        # 1. Size Validation (Already checked by Nginx usually, but good for safety)
        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            raise ValueError(f"File size exceeds limit of {MAX_FILE_SIZE_BYTES/1024/1024}MB")

        # 2. Magic Number Validation
        mime_type = magic.from_buffer(file_bytes, mime=True)
        if not mime_type.startswith('image/'):
            raise ValueError(f"Invalid file type: {mime_type}")

        try:
            # Open image
            original_image = Image.open(io.BytesIO(file_bytes))
            
            # Convert to RGB (handle RGBA/P formats properly)
            # This is crucial for saving as JPEG and consistent handling
            if original_image.mode in ('RGBA', 'LA') or (original_image.mode == 'P' and 'transparency' in original_image.info):
                # Use a white background for transparency flattening if saving as JPEG
                # But for original sanitization, we might want to keep PNG if it was PNG?
                # Decision: Keep format if PNG, otherwise Normalize to JPEG.
                pass
            
            # Correct orientation from EXIF before stripping
            original_image = ImageOps.exif_transpose(original_image)
            
            output_streams = {}

            # --- A. Original (Sanitized) ---
            # We re-save the image to strip metadata and ensure it's valid pixel data
            # Use original format if compatible, default to JPEG
            original_format = original_image.format if original_image.format in ['JPEG', 'PNG', 'WEBP'] else 'JPEG'
            
            original_stream = io.BytesIO()
            # Add simple branding/provenance to EXIF 'Software' tag
            # Note: Putting data into 'exif' argument requires raw bytes. 
            # Pillow's easy way is limited. For now, we strip everything.
            # If we really want to add "Software: Divemap", we'd need to construct exif bytes.
            # Keeping it simple: Strip all metadata.
            
            if original_format == 'JPEG':
                original_image.convert('RGB').save(original_stream, format='JPEG', quality=90, optimize=True)
            else:
                original_image.save(original_stream, format=original_format, optimize=True)
            
            original_stream.seek(0)
            output_streams['original'] = original_stream
            output_streams['original_format'] = original_format # Helper for caller

            # --- B. Medium (WebP) ---
            # Only generate if original is larger than target
            if original_image.width > MEDIUM_SIZE[0] or original_image.height > MEDIUM_SIZE[1]:
                medium_img = original_image.copy()
                medium_img.thumbnail(MEDIUM_SIZE, Image.Resampling.LANCZOS)
                
                medium_stream = io.BytesIO()
                # WebP is standard for generated variants
                medium_img.convert('RGB').save(medium_stream, format='WEBP', quality=80)
                medium_stream.seek(0)
                output_streams['medium'] = medium_stream
            else:
                # If original is small, we don't generate a medium variant.
                # The caller logic should handle "if medium is None, use original"
                output_streams['medium'] = None

            # --- C. Thumbnail (WebP) ---
            thumb_img = original_image.copy()
            # Use thumbnail() for fit-to-box. 
            # If we wanted square crops, we'd use ImageOps.fit()
            # For now, fit-to-box 400x400 is versatile.
            thumb_img.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
            
            thumb_stream = io.BytesIO()
            thumb_img.convert('RGB').save(thumb_stream, format='WEBP', quality=75)
            thumb_stream.seek(0)
            output_streams['thumbnail'] = thumb_stream

            return output_streams

        except Exception as e:
            logger.error(f"Image processing failed for {filename}: {str(e)}")
            raise ValueError(f"Failed to process image: {str(e)}")

image_processing = ImageProcessingService()
