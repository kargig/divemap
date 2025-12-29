# Implementation Plan: Searchable Certifications Dropdown

## Objective
Implement a searchable certifications dropdown on the user profile page, filtered by diving organization. The system should store and display certification details such as Max Depth, Gases, and Tanks.

## Data Source
`docs/diving_certifications_data.txt`

## 1. Database Schema Changes

### 1.1 New Model: `CertificationLevel`
Create a new table `certification_levels` to store structured certification data.

```python
class CertificationLevel(Base):
    __tablename__ = "certification_levels"

    id = Column(Integer, primary_key=True, index=True)
    diving_organization_id = Column(Integer, ForeignKey("diving_organizations.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False) # e.g., "Open Water Diver"
    category = Column(String(100)) # e.g., "Recreational", "Technical"
    max_depth = Column(String(50)) # e.g., "18m (60ft)" - Storing as string to handle "18m" or "No limit" or complex text
    gases = Column(String(255)) # e.g., "Air", "Nitrox"
    tanks = Column(String(255)) # e.g., "Single", "Double + Stage"
    prerequisites = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    diving_organization = relationship("DivingOrganization", back_populates="certification_levels")
    user_certifications = relationship("UserCertification", back_populates="certification_level_link")
```

### 1.2 Update Model: `DivingOrganization`
Add relationship to `CertificationLevel`.

```python
    # In DivingOrganization
    certification_levels = relationship("CertificationLevel", back_populates="diving_organization", cascade="all, delete-orphan")
```

### 1.3 Update Model: `UserCertification`
Add Foreign Key to `CertificationLevel`.

```python
class UserCertification(Base):
    # ... existing fields ...
    certification_level_id = Column(Integer, ForeignKey("certification_levels.id"), nullable=True, index=True)
    
    # Relationships
    certification_level_link = relationship("CertificationLevel", back_populates="user_certifications")
```
*Note: We keep the existing `certification_level` string field for backward compatibility or custom entries, but the UI will prioritize the structured relationship.*

### 1.4 Migration
Create an Alembic migration to apply these changes.

## 2. Backend API Updates

### 2.1 Schemas
Update `app/schemas.py`:
*   `CertificationLevelBase`, `CertificationLevelCreate`, `CertificationLevelResponse`.
*   Update `DivingOrganizationResponse` to optionally include levels (or separate endpoint).
*   Update `UserCertificationCreate` to accept `certification_level_id`.
*   Update `UserCertificationResponse` to include `certification_level_details`.

### 2.2 Endpoints (`app/routers/diving_organizations.py`)
*   `GET /diving-organizations/{id}/levels`: Fetch all certification levels for a specific organization.

### 2.3 Endpoints (`app/routers/user_certifications.py`)
*   Update `create_my_certification` and `update_my_certification` to handle `certification_level_id`.

## 3. Data Seeding

### 3.1 Parser Script
Create `backend/populate_certifications.py` to:
1.  Read `docs/diving_certifications_data.txt`.
2.  Parse the text structure (Org -> Track -> Certification details).
3.  Update/Insert `DivingOrganization` entries.
4.  Update/Insert `CertificationLevel` entries.

## 4. Frontend Updates

### 4.1 Profile Page (`frontend/src/pages/Profile.js`)
*   **State Management:** Add state for `availableLevels` (list of levels for selected org).
*   **Logic:**
    *   When Organization changes -> Clear selected level -> Fetch levels for new Org -> Update `availableLevels`.
*   **UI:**
    *   Replace `certification_level` text input with a `select` (Dropdown).
    *   Render options from `availableLevels`.
    *   Display "Max Depth", "Gases", "Tanks" in the list of added certifications.

### 4.2 Public Profile (`frontend/src/pages/UserProfile.js`)
*   Update the certifications list display to show the extra details (Depth, Gases, Tanks) if `certification_level_link` is present.

## 5. Validation and Testing Strategy

### 5.1 Backend Tests
*   **Unit Tests:**
    *   Test `CertificationLevel` model creation.
    *   Test `populate_certifications.py` parsing logic.
*   **Integration Tests:**
    *   Test `GET /diving-organizations/{id}/levels`.
    *   Test creating a `UserCertification` with a valid `certification_level_id`.
    *   Test verifying that the response includes the nested certification details.

### 5.2 Frontend Verification
*   **Manual Test:**
    1.  Go to "My Profile".
    2.  Click "Add Certification".
    3.  Select "PADI". Verify "Open Water Diver" appears in the second dropdown.
    4.  Select "Open Water Diver". Save.
    5.  Verify the list shows "Max Depth: 18m", "Gases: Air", etc.
    6.  Go to Public Profile page (`/users/me` alias or specific username).
    7.  Verify the details are visible there too.

## 6. Execution Steps
1.  **Backend:** Create Models & Schemas.
2.  **Backend:** Create Migration.
3.  **Backend:** Create & Run Seeder Script.
4.  **Backend:** Implement API Endpoints.
5.  **Frontend:** Update `Profile.js`.
6.  **Frontend:** Update `UserProfile.js`.
7.  **Verification:** Run tests and manual check.
