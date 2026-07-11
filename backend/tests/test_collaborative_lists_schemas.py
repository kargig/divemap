from datetime import datetime, timezone
from app.schemas import (
    CollaboratorResponse,
    AddCollaboratorRequest,
    UpdateCollaboratorPreference,
    UserDiveSiteListResponse
)

def test_collaborator_response_schema():
    data = {
        "id": 1,
        "user_id": 42,
        "username": "buddy_diver",
        "role": "editor",
        "show_on_profile": True,
        "created_at": datetime.now(timezone.utc)
    }
    schema = CollaboratorResponse(**data)
    assert schema.id == 1
    assert schema.user_id == 42
    assert schema.username == "buddy_diver"
    assert schema.role == "editor"
    assert schema.show_on_profile is True
    assert isinstance(schema.created_at, datetime)

def test_add_collaborator_request_schema():
    data = {"username": "scuba_sam"}
    schema = AddCollaboratorRequest(**data)
    assert schema.username == "scuba_sam"

def test_update_collaborator_preference_schema():
    data = {"show_on_profile": False}
    schema = UpdateCollaboratorPreference(**data)
    assert schema.show_on_profile is False

def test_user_dive_site_list_response_with_collaborators():
    data = {
        "id": 101,
        "user_id": 10,
        "username": "list_owner",
        "title": "My Favorite Wrecks",
        "slug": "my-favorite-wrecks",
        "description": "Best shipwrecks",
        "is_public": True,
        "show_on_profile": True,
        "system_type": "custom",
        "view_count": 5,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "items": [],
        "collaborators": [
            {
                "id": 1,
                "user_id": 42,
                "username": "buddy_diver",
                "role": "editor",
                "show_on_profile": True,
                "created_at": datetime.now(timezone.utc)
            }
        ],
        "is_collaborator": True,
        "role": "editor"
    }
    schema = UserDiveSiteListResponse(**data)
    assert schema.id == 101
    assert schema.user_id == 10
    assert schema.username == "list_owner"
    assert schema.title == "My Favorite Wrecks"
    assert len(schema.collaborators) == 1
    assert schema.collaborators[0].username == "buddy_diver"
    assert schema.is_collaborator is True
    assert schema.role == "editor"
