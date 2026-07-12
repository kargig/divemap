# Diving Center Media and Logo Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins, owners, and managers of diving centers to upload, update, and delete diving center logos and photo media using Cloudflare R2 storage. Add a "Media" tab to the frontend diving center profile that exactly mirrors the dive site media gallery functionality.

**Architecture:**
1. **Backend Database:** Add a new `CenterMedia` SQLAlchemy model and generate an Alembic migration.
2. **Backend Storage:** Update `R2StorageService` to support paths for diving center logos and media.
3. **Backend API:** Create new router endpoints in `diving_centers.py` for `/logo` (single image upload/delete) and `/media` (multi-image upload/delete), guarded by an ownership/manager permission check.
4. **Frontend UI:**
   - Update `EditDivingCenter.jsx` to include a logo uploader.
   - Add a "Media" tab next to "Overview" in `DivingCenterDetail.jsx`.
   - The new Media tab will use the exact same `yet-another-react-lightbox` inline gallery logic as `DiveSiteDetail.jsx`.
   - Update `EditDivingCenter.jsx` to use the `UploadPhotosComponent` for managing the center's media (just like `EditDiveSite.jsx`).

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Cloudflare R2 (Boto3), React, TailwindCSS, yet-another-react-lightbox.

---

### Task 1: Backend Database Models & Schemas

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/schemas/__init__.py`
- Create: `backend/app/schemas/diving_centers.py` (or modify if exists)

- [x] **Step 1: Add CenterMedia Model**

Open `backend/app/models.py` and add the `CenterMedia` model right after the `DivingCenter` definition. Also, add the relationship to the `DivingCenter` model.

```python
# In models.py
class CenterMedia(Base):
    __tablename__ = "center_media"

    id = Column(Integer, primary_key=True, index=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    media_type = Column(Enum(MediaType), nullable=False)
    url = Column(String(500), nullable=False)
    description = Column(Text)
    thumbnail_url = Column(String(500))
    medium_url = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    diving_center = relationship("DivingCenter", back_populates="media")
    user = relationship("User")

# Add to DivingCenter model:
# media = relationship("CenterMedia", back_populates="diving_center", cascade="all, delete-orphan")
```

- [x] **Step 2: Generate Alembic Migration**

Run the following command to generate the database migration:
```bash
docker-compose exec backend alembic revision --autogenerate -m "Add CenterMedia table"
```
*Note for executor: Rename the generated file to fit the sequential numbering in `backend/migrations/versions/` (e.g. `0060_add_centermedia_table.py`). Verify the file only contains `center_media` table creation.*

- [x] **Step 3: Define Pydantic Schemas**

Open (or create) `backend/app/schemas/diving_centers.py` (or add to `__init__.py` depending on project structure) and add schemas for the new model. Ensure `DivingCenterResponse` includes `media` and `logo_url`.

```python
# In appropriate schema file
class CenterMediaResponse(BaseModel):
    id: int
    diving_center_id: int
    user_id: Optional[int] = None
    media_type: str
    url: str
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    medium_url: Optional[str] = None
    created_at: datetime

    # Computed full URLs
    full_url: Optional[str] = None
    full_thumbnail_url: Optional[str] = None
    full_medium_url: Optional[str] = None

    class Config:
        from_attributes = True

# Also ensure DivingCenterResponse has:
# logo_full_url: Optional[str] = None
# media: List[CenterMediaResponse] = []
```

### Task 2: Update Storage Service & Utils

**Files:**
- Modify: `backend/app/services/r2_storage_service.py`
- Modify: `backend/app/utils.py`

- [x] **Step 1: Update R2StorageService for Centers**

In `r2_storage_service.py`:
1. Add `diving_center_id` to the `_get_photo_path` method to generate paths like `photos/centers/{diving_center_id}/...`.
2. Add `diving_center_id` as an optional parameter to `upload_photo_set` so it can reuse the exact same variant (original/medium/thumbnail) upload logic.
3. Add a dedicated method for logo uploads `upload_center_logo`.

```python
    # Example addition to _get_photo_path:
    if diving_center_id is not None:
        base_path = f"photos/centers/{diving_center_id}"

    # Example logo method:
    async def upload_center_logo(self, file_content: bytes, filename: str, center_id: int, content_type: str) -> str:
        """Upload a logo for a diving center"""
        path = f"centers/{center_id}/logo_{filename}"
        return await self._upload_file(file_content, path, content_type)
```

- [x] **Step 2: Update `populate_center_media_urls` in utils**

In `backend/app/utils.py`, add a helper function similar to `populate_site_media_urls`.

```python
def populate_center_media_urls(media_obj, response_dict: dict) -> dict:
    from app.services.r2_storage_service import r2_storage

    response_dict['full_url'] = r2_storage.get_photo_url(media_obj.url)
    if media_obj.thumbnail_url:
        response_dict['full_thumbnail_url'] = r2_storage.get_photo_url(media_obj.thumbnail_url)
    if media_obj.medium_url:
        response_dict['full_medium_url'] = r2_storage.get_photo_url(media_obj.medium_url)

    return response_dict
```

### Task 3: Backend API Endpoints

**Files:**
- Modify: `backend/app/routers/diving_centers.py`

- [x] **Step 1: Build Permission Helper**

Add a function to check if the `current_user` is an admin, the `owner_id` (and status is approved), or a `DivingCenterManager`.

```python
def is_center_manager(db: Session, center_id: int, user: User) -> bool:
    if user.is_admin:
        return True

    center = db.query(DivingCenter).filter(DivingCenter.id == center_id).first()
    if not center:
        return False

    if center.owner_id == user.id and center.ownership_status == OwnershipStatus.approved:
        return True

    manager = db.query(DivingCenterManager).filter(
        DivingCenterManager.diving_center_id == center_id,
        DivingCenterManager.user_id == user.id
    ).first()

    return manager is not None
```

- [x] **Step 2: Add Logo Upload Endpoint**

```python
@router.post("/{center_id}/logo", response_model=dict)
@skip_rate_limit_for_admin("30/minute")
async def upload_center_logo(
    request: Request,
    center_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if not is_center_manager(db, center_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to edit this center")

    center = db.query(DivingCenter).filter(DivingCenter.id == center_id).first()

    # Process image (resize, convert to webp) using existing image processing logic from site media
    from app.services.r2_storage_service import r2_storage
    from app.routers.dive_sites import process_uploaded_image # Re-use existing image processor

    content = await file.read()

    # Upload
    filename = f"{uuid.uuid4()}.webp"
    url = await r2_storage.upload_center_logo(content, filename, center_id, "image/webp")

    # Update DB
    if center.logo_url:
        await r2_storage.delete_file(center.logo_url) # Cleanup old

    center.logo_url = url
    db.commit()

    # Return full URL for immediate frontend display
    return {"message": "Logo updated", "logo_full_url": r2_storage.get_photo_url(url)}
```

- [x] **Step 3: Add Media Upload Endpoint (with Thumbnail Generation)**

Implement `POST /{center_id}/media`. You **MUST** use the exact same image processing pipeline as dive site media to ensure thumbnails and medium-sized webp images are generated.

```python
@router.post("/{center_id}/media", response_model=CenterMediaResponse)
@skip_rate_limit_for_admin("30/minute")
async def add_diving_center_media(
    request: Request,
    center_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if not is_center_manager(db, center_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")

    from app.services.r2_storage_service import r2_storage
    from app.services import image_processing
    import uuid

    # 1. Read file and validate size (e.g. 15MB limit chunking)
    content = await file.read()

    # 2. Process image into variants (original, medium, thumbnail)
    file_ext = Path(file.filename).suffix if file.filename else '.jpg'
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    image_streams = image_processing.process_image(content, file.filename or "unknown")

    # 3. Upload to R2 using upload_photo_set
    uploaded_paths = r2_storage.upload_photo_set(
        user_id=current_user.id,
        original_filename=unique_filename,
        image_streams=image_streams,
        diving_center_id=center_id
    )

    # 4. Save to Database
    db_media = CenterMedia(
        diving_center_id=center_id,
        user_id=current_user.id,
        media_type=MediaType.photo,
        url=uploaded_paths.get("original"),
        medium_url=uploaded_paths.get("medium"),
        thumbnail_url=uploaded_paths.get("thumbnail")
    )
    db.add(db_media)
    db.commit()
    db.refresh(db_media)
    return db_media
```

- [x] **Step 4: Add Media Delete Endpoint**
Implement `DELETE /{center_id}/media/{media_id}` to remove the `CenterMedia` row from the database and call `r2_storage.delete_file` on the `url`, `medium_url`, and `thumbnail_url`.

- [x] **Step 5: Update the `GET /{id}` endpoint**

Update the main GET endpoint to return the parsed `logo_full_url` and loop over the `media` relationship to populate `full_url` using `populate_center_media_urls`.

### Task 4: Frontend API & React Query

**Files:**
- Modify: `frontend/src/api.js`
- Modify: `frontend/src/services/divingCenters.js`

- [x] **Step 1: Add frontend API hooks**

Add API wrappers for uploading logos, uploading media, and deleting media.

```javascript
// In divingCenters.js
export const uploadCenterLogo = async (centerId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post(`/api/v1/diving-centers/${centerId}/logo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const addDivingCenterMedia = async (centerId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post(`/api/v1/diving-centers/${centerId}/media`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const deleteDivingCenterMedia = async (centerId, mediaId) => {
  const response = await api.delete(`/api/v1/diving-centers/${centerId}/media/${mediaId}`);
  return response.data;
};
```

### Task 5: Frontend UI (Edit Diving Center)

**Files:**
- Modify: `frontend/src/pages/EditDivingCenter.jsx`

- [x] **Step 1: Implement Logo Upload Component**

In `EditDivingCenter.jsx`, add an Image Upload input specifically for the logo at the top of the form. Use React Query's `useMutation` to hit the `/logo` endpoint when a file is selected.

- [x] **Step 2: Add UploadPhotosComponent for Media**

Follow the paradigm established in `EditDiveSite.jsx`. Import `UploadPhotosComponent` and add a "Media Management" section at the bottom of the `EditDivingCenter` form.
Bind it to `addDivingCenterMedia` and `deleteDivingCenterMedia` mutations.

### Task 6: Frontend UI (Media Tab & Gallery)

**Files:**
- Modify: `frontend/src/pages/DivingCenterDetail.jsx`

- [x] **Step 1: Add "Media" to the Tabs**

In `DivingCenterDetail.jsx`, add a new button to the Tab Navigation, matching the existing tab styling:
```jsx
<button
  onClick={() => setActiveTab('media')}
  className={`${activeTab === 'media' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
>
  Media
</button>
```

- [x] **Step 2: Implement Lightbox Gallery**

Copy the Lightbox and thumbnail gallery implementation from `DiveSiteDetail.jsx`.
- Import `Lightbox`, `Thumbnails`, `Fullscreen`, etc. from `yet-another-react-lightbox`.
- Set up state variables: `lightboxIndex` and `isLightboxOpen`.
- When `activeTab === 'media'`, map over `center.media` to display the grid of images using their `full_thumbnail_url` or `full_url`.
- Bind clicking an image to `setLightboxIndex(index); setIsLightboxOpen(true)`.
- Render the `<Lightbox />` component.

### Task 7: Frontend UI (Diving Centers Listing)

**Files:**
- Modify: `frontend/src/pages/DivingCenters.jsx`

- [x] **Step 1: Display Logo in Listing Grid/List**

Open `frontend/src/pages/DivingCenters.jsx`. Inside the `divingCenters?.map(center => ...)` blocks (both the List view and the Grid view), import and use the standard `<Avatar />` component to display the diving center's logo.

```jsx
// Ensure Avatar is imported at the top
import Avatar from '../components/Avatar';

// Inside the mapping function for both List and Grid views:
<Avatar
  src={center.logo_full_url || center.logo_url}
  alt={center.name}
  size='md'
  fallbackText={center.name}
/>
```

### Task 8: Backend & Frontend Testing

**Files:**
- Create: `backend/tests/test_diving_center_media.py`
- Create: `frontend/src/__tests__/DivingCenterMedia.test.js`

- [x] **Step 1: Write Backend Unit Tests**
Create a new test file `backend/tests/test_diving_center_media.py`. Test the following:
1. Unauthorized user cannot upload a logo.
2. Approved owner CAN upload a logo.
3. Manager CAN upload media.
4. Deleting a media item removes the file from R2 (mocked) and the row from DB.

- [x] **Step 2: Write Frontend Component Tests**
Create `frontend/src/__tests__/DivingCenterMedia.test.js`. Verify:
1. The "Media" tab appears in the navigation.
2. Clicking an image opens the Lightbox.
3. The Upload button is only visible to authorized users.

### Task 9: Independent Verification

- [x] **Step 1: Manual Browser Verification**
A separate subagent must:
1. Log in as a diving center owner.
2. Navigate to their center's Edit page.
3. Upload a logo and verify it appears in the header.
4. Go to the "Media" tab on the profile and upload 3 photos.
5. Verify the Lightbox opens and slides through all 3 photos.
6. Check for console errors using `list_console_messages`.

### Task 10: Security Review

- [x] **Step 1: Perform Security Audit**
A security analyst subagent must:
1. Review the permission check `is_center_manager` for bypass vulnerabilities.
2. Verify that uploaded filenames are properly UUID-sanitized to prevent path traversal.
3. Confirm that deleting a media item checks that the item actually belongs to the center (preventing IDOR).
4. Verify that R2 signed URLs are generated correctly and expire as intended.

### Task 11: Completion

- [x] **Step 1: Final Linting**
Run `make lint-frontend`

### Addendum: Dynamic Adjustments During Execution

During the execution of this plan, the following architectural adjustments were made to resolve bugs and unify UI behavior:

- **R2 URL Generation:** The `R2StorageService.get_photo_url` was updated to explicitly allow the `centers/` path to generate presigned R2 URLs. Previously it incorrectly forced local `/uploads/` static paths.
- **Lightbox Inline Plugin:** Stripped the manual thumbnail grid from `DivingCenterDetail.jsx`. The custom `<Lightbox>` component already includes the `Inline` plugin, making a manual grid redundant and visually confusing. The component now perfectly mirrors `DiveSiteDetail.jsx`.
- **URL Tab Parameters:** Swapped the local `useState` for `activeTab` with `useSearchParams()` from `react-router-dom` in `DivingCenterDetail.jsx`. This allows deep-linking directly to the Media gallery via `?tab=media`.
- **Avatar Cache Bug:** Updated `Avatar.jsx` with a `useEffect` hook to clear its internal `hasError` state whenever the `src` prop changes, fixing a bug where newly uploaded logos would fail to render if the component had previously defaulted to initials.
- **Cache Optimistic UI:** The frontend `useMutation` for logo upload was modified to use `queryClient.setQueryData` to instantly inject the new presigned URL returned by the backend, rather than waiting for a background refetch.
- **Image Processing Pipeline:** The logo upload endpoint was explicitly routed through `image_processing.process_avatar(content)` to crop, resize to 512x512, and convert to WebP before R2 upload, preventing Nginx MIME-type sniffing errors in the browser.
