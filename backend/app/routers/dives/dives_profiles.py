"""
Dive profile operations.

This module contains functionality for dive profile management:
- get_dive_profile: Retrieve dive profile data
- upload_dive_profile: Upload dive profile files
- delete_dive_profile: Remove dive profile data
- delete_user_profiles: Bulk delete user profiles

The profile functionality includes:
- Dive profile file upload and storage
- Profile data parsing and validation
- User-specific profile management
- Bulk operations for profile cleanup
"""

from fastapi import Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, time, datetime
import json
import os
import tempfile
import uuid

from .dives_shared import router, get_db, get_current_user, get_current_admin_user, get_current_user_optional, User, Dive, DiveMedia, DiveTag, AvailableTag, r2_storage
from app.schemas import DiveCreate, DiveUpdate, DiveResponse, DiveMediaCreate, DiveMediaResponse, DiveTagResponse
from app.models import DiveSite, DiveSiteAlias
from app.services.dive_profile_parser import DiveProfileParser
from .dives_validation import raise_validation_error
from .dives_logging import log_dive_operation, log_error


@router.get("/{dive_id}/profile")
def get_dive_profile(
    dive_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get dive profile data. Unauthenticated users can view public dives. Private dives are restricted to owner or admins."""
    # If authenticated, ensure account is enabled (mirror behavior of get_dive)
    if current_user and not current_user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )
    
    dive = db.query(Dive).filter(Dive.id == dive_id).first()
    if not dive:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dive not found")
    
    # Access control: allow public dives for everyone; private dives only for owner or admins
    if dive.is_private:
        if not current_user or (dive.user_id != current_user.id and not current_user.is_admin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This dive is private"
            )
    
    # Check if dive has profile data
    if not dive.profile_xml_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No profile uploaded")
    
    try:
        # Download profile from R2 or local storage
        profile_content = r2_storage.download_profile(dive.user_id, dive.profile_xml_path)
        if not profile_content:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile file not found")
        
        # Check file extension to determine parsing method
        if dive.profile_xml_path.endswith('.json'):
            # Imported profile (JSON format)
            profile_data = json.loads(profile_content.decode('utf-8'))
        else:
            # Manually uploaded profile (XML format) - save temporarily and parse
            from app.services.dive_profile_parser import DiveProfileParser
            import tempfile
            
            with tempfile.NamedTemporaryFile(mode='wb', suffix='.xml', delete=False) as temp_file:
                temp_file.write(profile_content)
                temp_path = temp_file.name
            
            try:
                parser = DiveProfileParser()
                profile_data = parser.parse_xml_file(temp_path)
            finally:
                # Clean up temporary file
                if os.path.exists(temp_path):
                    os.remove(temp_path)
        
        return profile_data
    except HTTPException:
        # Re-raise HTTP exceptions (like 404 errors) as-is
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error parsing profile: {str(e)}")


@router.post("/{dive_id}/profile")
async def upload_dive_profile(
    dive_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Upload dive profile XML file"""
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    
    # Check if dive exists and user owns it
    dive = db.query(Dive).filter(Dive.id == dive_id).first()
    if not dive:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dive not found")
    
    if dive.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    # Validate file type
    if not file.filename.lower().endswith('.xml'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only XML files are allowed")
    
    try:
        # Read file content
        content = await file.read()
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"dive_{dive_id}_profile_{timestamp}.xml"
        
        # Parse profile data first to validate
        from app.services.dive_profile_parser import DiveProfileParser
        import tempfile
        import xml.etree.ElementTree as ET
        
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.xml', delete=False) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name
        
        try:
            parser = DiveProfileParser()
            profile_data = parser.parse_xml_file(temp_path)
            
            if not profile_data or not profile_data.get('samples'):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid dive profile data")
            
            # Upload to R2 or local storage
            stored_path = r2_storage.upload_profile(dive.user_id, filename, content)
            
            # Update dive record with profile metadata
            dive.profile_xml_path = stored_path
            dive.profile_sample_count = len(profile_data.get('samples', []))
            dive.profile_max_depth = profile_data.get('calculated_max_depth', 0)
            dive.profile_duration_minutes = profile_data.get('calculated_duration_minutes', 0)
            
            db.commit()
            
            return {
                "message": "Dive profile uploaded successfully",
                "profile_data": profile_data
            }
            
        except (ET.ParseError, FileNotFoundError, ValueError) as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid dive profile data: {str(e)}")
        finally:
            # Clean up temporary file
            if os.path.exists(temp_path):
                os.remove(temp_path)
        
    except HTTPException:
        # Re-raise HTTP exceptions (like 400 errors) as-is
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error uploading profile: {str(e)}")


@router.delete("/{dive_id}/profile")
def delete_dive_profile(
    dive_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Delete dive profile"""
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    
    # Check if dive exists and user owns it
    dive = db.query(Dive).filter(Dive.id == dive_id).first()
    if not dive:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dive not found")
    
    if dive.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    if not dive.profile_xml_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No profile found")
    
    try:
        # Delete profile from R2 or local storage
        r2_storage.delete_profile(dive.user_id, dive.profile_xml_path)
        
        # Clear profile metadata from dive record
        dive.profile_xml_path = None
        dive.profile_sample_count = None
        dive.profile_max_depth = None
        dive.profile_duration_minutes = None
        
        db.commit()
        
        return {"message": "Dive profile deleted successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error deleting profile: {str(e)}")


@router.delete("/profiles/user/{user_id}")
def delete_user_profiles(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Delete all dive profiles for a specific user (admin only)"""
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    
    try:
        # Delete all profiles for the user
        success = r2_storage.delete_user_profiles(user_id)
        
        if success:
            return {"message": f"All profiles for user {user_id} deleted successfully"}
        else:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete user profiles")
        
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error deleting user profiles: {str(e)}")
