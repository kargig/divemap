from datetime import datetime
from app.auth import is_trusted_contributor
from app.models import User, DiveSite, Dive, DivingCenter, DiveRoute

def test_is_trusted_contributor(db_session, test_user, test_dive_site):
    # Base case: Untrusted
    assert not is_trusted_contributor(db_session, test_user, test_dive_site)
    
    # Case: Owner
    original_creator = test_dive_site.created_by
    test_dive_site.created_by = test_user.id
    assert is_trusted_contributor(db_session, test_user, test_dive_site)
    test_dive_site.created_by = original_creator # Reset
    
    # Case: Admin
    test_user.is_admin = True
    assert is_trusted_contributor(db_session, test_user, test_dive_site)
    test_user.is_admin = False
    
    # Case: Activity (has a dive)
    new_dive = Dive(user_id=test_user.id, dive_site_id=test_dive_site.id, dive_date=datetime.now())
    db_session.add(new_dive)
    db_session.commit()
    assert is_trusted_contributor(db_session, test_user, test_dive_site)