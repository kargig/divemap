# Social Image Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to generate and download a social-media-friendly image from a dive log, overlaying an accurate dive profile, metadata, and a dynamic URL on a selected photo.

**Architecture:** Backend generation using **Pillow** in Python. A dedicated React modal on the frontend handles photo selection and cropping (via `react-image-crop`) before sending parameters to a new FastAPI endpoint.

**Tech Stack:** Python (FastAPI, Pillow), React, Tailwind CSS, `react-image-crop`.

---

### Task 1: Backend Setup - SocialImageService & Router

**Files:**
- Create: `backend/app/services/social_image_service.py`
- Create: `backend/app/routers/dives/dives_social.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_social_image.py`

- [ ] **Step 1: Create the failing test for the social image endpoint**
```python
# backend/tests/test_social_image.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_generate_social_image_endpoint(client: AsyncClient, test_user_token):
    # Assuming dive 1 exists for test user
    response = await client.post(
        "/api/dives/1/social-image",
        json={"media_url": "test.jpg", "crop": {"x": 0, "y": 0, "width": 100, "height": 100}},
        headers={"Authorization": f"Bearer {test_user_token}"}
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
```
- [ ] **Step 2: Run test to verify it fails**
Run: `cd backend && ./docker-test-github-actions.sh tests/test_social_image.py`
Expected: 404 Not Found (Route doesn't exist)

- [ ] **Step 3: Implement the basic Router and Service skeleton**
```python
# backend/app/services/social_image_service.py
from PIL import Image, ImageDraw, ImageFont
import io

class SocialImageService:
    def generate(self, dive, profile_data, image_bytes, crop_params):
        img = Image.open(io.BytesIO(image_bytes))
        output = io.BytesIO()
        img.save(output, format="JPEG")
        return output.getvalue()

# backend/app/routers/dives/dives_social.py
from fastapi import APIRouter, Depends, Response
from app.auth import get_current_user
from app.services.social_image_service import SocialImageService

router = APIRouter(prefix="/dives", tags=["dives"])

@router.post("/{dive_id}/social-image")
async def generate_social_image(dive_id: int, payload: dict, current_user=Depends(get_current_user)):
    return Response(content=b"fake-image-data", media_type="image/jpeg")
```

- [ ] **Step 4: Register router in main.py**
```python
# backend/app/main.py
from app.routers.dives import dives_social
app.include_router(dives_social.router)
```

- [ ] **Step 5: Run test to verify it passes**
Run: `cd backend && ./docker-test-github-actions.sh tests/test_social_image.py`

---

### Task 2: Profile Line Drawing (Pillow)

**Files:**
- Modify: `backend/app/services/social_image_service.py`

- [ ] **Step 1: Implement accurate profile line drawing in Service**
```python
# backend/app/services/social_image_service.py
def _draw_profile(self, draw, width, height, samples):
    if not samples: return
    max_time = samples[-1]['time']
    max_depth = max(s['depth'] for s in samples)
    
    points = []
    for s in samples:
        x = (s['time'] / max_time) * width
        y = height - ((s['depth'] / max_depth) * (height * 0.8))
        points.append((x, y))
    
    draw.line(points, fill=(59, 130, 246), width=4, joint="round")
    fill_points = [(0, height)] + points + [(width, height)]
    draw.polygon(fill_points, fill=(59, 130, 246, 51))
```

---

### Task 3: Metadata Overlay (Pillow)

**Files:**
- Modify: `backend/app/services/social_image_service.py`

- [ ] **Step 1: Add top metadata overlay with gradients**
- [ ] **Step 2: Verify visual rendering (save to temp file and inspect)**

---

### Task 4: Dynamic URL & Final Assembly

**Files:**
- Modify: `backend/app/services/social_image_service.py`
- Modify: `backend/app/routers/dives/dives_social.py`

- [ ] **Step 1: Implement vertical URL drawing with dynamic domain**
- [ ] **Step 2: Add Content-Disposition: attachment header to router response**

---

### Task 5: Frontend Modal & Photo Selection

**Files:**
- Create: `frontend/src/components/SocialShareModal.jsx`
- Modify: `frontend/src/pages/DiveDetail.jsx`

- [ ] **Step 1: Create Modal with gallery of dive and site photos**
- [ ] **Step 2: Add trigger button in DiveDetail**

---

### Task 6: Frontend Cropping & Backend Trigger

**Files:**
- Modify: `frontend/src/components/SocialShareModal.jsx`
- Create: `frontend/src/utils/socialHelpers.js`

- [ ] **Step 1: Implement cropping with platform aspect ratio presets**
- [ ] **Step 2: Implement download trigger using POST request**
- [ ] **Step 3: Final verification using Browser MCP tools**
