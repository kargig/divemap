import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.chat_service import ChatService
from app.schemas.chat import SearchIntent, IntentType
from app.models import DiveSite, SiteRating

@pytest.fixture
def chat_service(db_session):
    return ChatService(db_session)

@pytest.fixture
def setup_rating_data(db_session):
    # Site 1: High Rating
    s1 = DiveSite(name="Best Site", latitude=37.0, longitude=23.0)
    db_session.add(s1)
    db_session.flush()
    
    r1 = SiteRating(dive_site_id=s1.id, user_id=1, score=10) # Assuming user 1 exists or fk disabled in test sqlite? 
    # Actually, user_id fk constraints might fail. We need a user.
    from app.models import User
    u = db_session.query(User).filter(User.id == 1).first()
    if not u:
        u = User(username="rater", email="rater@test.com", password_hash="hash")
        db_session.add(u)
        db_session.flush()
        
    # Check if ratings exist to avoid duplicates
    existing_r1 = db_session.query(SiteRating).filter_by(dive_site_id=s1.id, user_id=u.id).first()
    if not existing_r1:
        r1 = SiteRating(dive_site_id=s1.id, user_id=u.id, score=10)
        db_session.add(r1)
    
    # Need a second user for the second rating on s1 to be valid (unique constraint usually user+site)
    u2 = db_session.query(User).filter(User.id == 2).first()
    if not u2:
        u2 = User(username="rater2", email="rater2@test.com", password_hash="hash")
        db_session.add(u2)
        db_session.flush()

    existing_r2 = db_session.query(SiteRating).filter_by(dive_site_id=s1.id, user_id=u2.id).first()
    if not existing_r2:
        r2 = SiteRating(dive_site_id=s1.id, user_id=u2.id, score=9)
        db_session.add(r2)
    
    # Site 2: Low Rating
    s2 = DiveSite(name="Mediocre Site", latitude=37.1, longitude=23.1)
    db_session.add(s2)
    db_session.flush()
    
    existing_r3 = db_session.query(SiteRating).filter_by(dive_site_id=s2.id, user_id=u.id).first()
    if not existing_r3:
        r3 = SiteRating(dive_site_id=s2.id, user_id=u.id, score=5)
        db_session.add(r3)
    
    db_session.commit()
    return {"s1": s1, "s2": s2}

def test_highest_rated_search(chat_service, setup_rating_data):
    intent = SearchIntent(
        intent_type=IntentType.DISCOVERY,
        keywords=["highest_rated"],
        location=None
    )
    
    results = chat_service.execute_search(intent)
    
    assert len(results) >= 2
    
    # Check ordering
    first = results[0]
    # "Best Site" should be first because it has avg 9.5
    # "Mediocre Site" has avg 5
    
    # Filter to our test sites
    test_names = ["Best Site", "Mediocre Site"]
    filtered = [r for r in results if r["name"] in test_names]
    
    assert filtered[0]["name"] == "Best Site"
    assert filtered[0]["rating"] == 9.5
    assert filtered[0]["review_count"] == 2
    
    assert filtered[1]["name"] == "Mediocre Site"
    assert filtered[1]["rating"] == 5.0
