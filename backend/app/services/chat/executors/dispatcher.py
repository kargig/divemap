from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from app.schemas.chat import SearchIntent, IntentType
from app.models import User
from .discovery import execute_discovery
from .others import execute_other_intents

def execute_search_intent(db: Session, intent: SearchIntent, current_user: Optional[User] = None) -> List[Dict]:
    if intent.intent_type == IntentType.DISCOVERY:
        return execute_discovery(
            db=db,
            location=intent.location,
            parent_region=intent.parent_region,
            keywords=intent.keywords,
            latitude=intent.latitude,
            longitude=intent.longitude,
            radius=intent.radius,
            direction=intent.direction,
            difficulty_level=intent.difficulty_level,
            entity_type_filter=intent.entity_type_filter,
            date=intent.date,
            date_range=intent.date_range
        )
    else:
        return execute_other_intents(
            db=db,
            intent_type=intent.intent_type,
            current_user=current_user,
            keywords=intent.keywords,
            location=intent.location,
            latitude=intent.latitude,
            longitude=intent.longitude,
            radius=intent.radius,
            direction=intent.direction,
            calculator_params=intent.calculator_params,
            context_entity_id=intent.context_entity_id,
            context_entity_type=intent.context_entity_type
        )
