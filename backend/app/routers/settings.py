from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import orjson

from app.database import get_db
from app.models import Setting
from app.schemas import SettingResponse, SettingUpdate
from app.auth import get_current_admin_user, get_current_user_optional
from app.models import User

router = APIRouter()


def parse_setting_value(value: str):
    """Parse JSON string value from database to Python type."""
    try:
        return orjson.loads(value)
    except orjson.JSONDecodeError:
        # If not valid JSON, return as string
        return value


def serialize_setting_value(value) -> str:
    """Serialize Python value to JSON string for database storage."""
    # orjson.dumps returns bytes, so decode to string
    return orjson.dumps(value).decode('utf-8')


@router.get("/{key}", response_model=SettingResponse)
async def get_setting(
    key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """
    Get a setting value by key. Public read access (no authentication required).
    """
    setting = db.query(Setting).filter(Setting.key == key).first()
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Setting '{key}' not found"
        )
    
    return {
        "key": setting.key,
        "value": parse_setting_value(setting.value),
        "description": setting.description
    }


@router.get("", response_model=List[SettingResponse])
async def list_settings(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    List all settings. Admin-only access.
    """
    settings = db.query(Setting).all()
    return [
        {
            "key": setting.key,
            "value": parse_setting_value(setting.value),
            "description": setting.description
        }
        for setting in settings
    ]


@router.put("/{key}", response_model=SettingResponse)
async def update_setting(
    key: str,
    setting_update: SettingUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Update a setting value. Admin-only access.
    """
    setting = db.query(Setting).filter(Setting.key == key).first()
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Setting '{key}' not found"
        )
    
    # Serialize value to JSON string
    setting.value = serialize_setting_value(setting_update.value)
    db.commit()
    db.refresh(setting)
    
    return {
        "key": setting.key,
        "value": parse_setting_value(setting.value),
        "description": setting.description
    }

