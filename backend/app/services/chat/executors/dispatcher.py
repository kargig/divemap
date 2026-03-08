from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from app.schemas.chat import SearchIntent, IntentType
from app.models import User
from .discovery import execute_discovery
from .others import execute_other_intents

def execute_search_intent(db: Session, intent: SearchIntent, current_user: Optional[User] = None) -> List[Dict]:
    if intent.intent_type == IntentType.DISCOVERY:
        return execute_discovery(db, intent)
    else:
        return execute_other_intents(db, intent, current_user)
