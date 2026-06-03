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

from fastapi import Depends, HTTPException, status, Query, UploadFile, File, Response
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import date, time, datetime
import orjson
import os
import tempfile
import uuid
from app.utils import parse_gf_from_text, has_deco_data

# Maximum file size for dive profile uploads (15MB)
MAX_PROFILE_FILE_SIZE = 15 * 1024 * 1024


from .dives_shared import router, get_db, get_current_user, get_current_active_user, get_current_admin_user, get_current_user_optional, User, Dive, DiveMedia, DiveTag, AvailableTag, r2_storage
from app.schemas import DiveCreate, DiveUpdate, DiveResponse, DiveMediaCreate, DiveMediaResponse, DiveTagResponse
from app.models import DiveSite, DiveSiteAlias
from app.services.dive_profile_parser import DiveProfileParser
from app.services.dive_export_service import DiveExportService
from .dives_validation import raise_validation_error
from .dives_logging import log_dive_operation, log_error


@router.get("/{dive_id}/export/{format}", response_class=Response)
def export_dive_profile(
    dive_id: int,
    format: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Export dive profile in specified format (xml, fit, json). Only authenticated active users can export."""
    
    dive = db.query(Dive).filter(Dive.id == dive_id).first()
    if not dive:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dive not found")
    
    # Access control for private dives
    if dive.is_private:
        if dive.user_id != current_user.id and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This dive is private"
            )
    
    # Check if dive has profile data
    if not dive.profile_xml_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No profile uploaded")
    
    try:
        # Download profile from R2
        profile_content = r2_storage.download_profile(dive.user_id, dive.profile_xml_path)
        if not profile_content:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile file not found")
        
        # Parse profile to dict
        parser = DiveProfileParser()
        if dive.profile_xml_path.endswith('.json'):
            profile_data = orjson.loads(profile_content)
        else:
            with tempfile.NamedTemporaryFile(mode='wb', suffix='.xml', delete=False) as temp_file:
                temp_file.write(profile_content)
                temp_path = temp_file.name
            try:
                profile_data = parser.parse_xml_file(temp_path)
            finally:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
        
        # Initialize export service
        export_service = DiveExportService()
        
        format = format.lower()
        if format == 'xml':
            dive_site = db.query(DiveSite).filter(DiveSite.id == dive.dive_site_id).first() if dive.dive_site_id else None
            # Fetch tags
            tags = [t.tag.name for t in dive.tags]
            content = export_service.export_to_subsurface_xml(dive, profile_data, dive_site, tags)
            filename = f"dive_{dive_id}_{dive.dive_date}.xml"
            return Response(
                content=content,
                media_type="application/xml",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        elif format == 'fit':
            content = export_service.export_to_garmin_fit(dive, profile_data)
            filename = f"dive_{dive_id}_{dive.dive_date}.fit"
            return Response(
                content=content,
                media_type="application/x-fit",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        elif format == 'json':
            content = export_service.export_to_suunto_json(dive, profile_data)
            filename = f"dive_{dive_id}_{dive.dive_date}.json"
            return Response(
                content=content,
                media_type="application/json",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported format: {format}")

    except HTTPException:
        raise
    except Exception as e:
        log_error(f"Error exporting profile for dive {dive_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error exporting profile: {str(e)}")


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
            profile_data = orjson.loads(profile_content)
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

        # Backfill decompression data if missing (either samples or heatmap)
        if profile_data and (not has_deco_data(profile_data) or 'tissue_heatmap' not in profile_data):
            # Try to parse GF from dive description
            gf_low, gf_high = parse_gf_from_text(dive.dive_information)
            
            # If GFs found, calculate ceiling
            if gf_low is not None and gf_high is not None:
                try:
                    samples = profile_data.get('samples', [])
                    if samples:
                        from app.services.deco_service import calculate_deco_ceiling
                        calculated_ceilings, final_saturation, heatmap_data = calculate_deco_ceiling(
                            samples,
                            gf_low=gf_low,
                            gf_high=gf_high,
                            cylinders=profile_data.get('cylinders'),
                            events=profile_data.get('events')
                        )
                        
                        # Inject calculated ceilings into samples ONLY if computer deco is missing
                        has_computer_deco = has_deco_data(profile_data)
                        for i, sample in enumerate(samples):
                            if i < len(calculated_ceilings):
                                if not has_computer_deco or sample.get('calculated_deco'):
                                    sample['stopdepth'] = calculated_ceilings[i]
                                    sample['in_deco'] = calculated_ceilings[i] > 0
                                    sample['calculated_deco'] = True
                        
                        # Add tissue loading to profile data
                        if final_saturation:
                            profile_data['tissue_saturation'] = final_saturation
                        if heatmap_data:
                            profile_data['tissue_heatmap'] = heatmap_data
                except Exception as e:
                    import logging
                    logging.warning(f"Failed to backfill deco ceiling for dive {dive_id}: {e}")
        
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
    
    # Check file size before reading
    if file.size and file.size > MAX_PROFILE_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size allowed is {MAX_PROFILE_FILE_SIZE // (1024 * 1024)}MB"
        )
    
    try:
        # Read file content
        content = await file.read()
        
        # Double check content size if file.size was not available
        if len(content) > MAX_PROFILE_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File content too large. Maximum size allowed is {MAX_PROFILE_FILE_SIZE // (1024 * 1024)}MB"
            )
        
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
            
            if not profile_data:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not parse dive profile data")
            
            if not profile_data.get('samples'):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dive profile has no sample data (is it a valid Subsurface log?)")
            
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


@router.delete("/profiles/users/{user_id}")
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
