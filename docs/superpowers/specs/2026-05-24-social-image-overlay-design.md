# Design Spec: Social Image Overlay for Dive Logs

## 1. Objective
Enable users to generate social-media-friendly images from their dive logs. These images will overlay a selected dive photo with the dive's profile chart and key metadata, making them ideal for sharing on platforms like Instagram and Facebook.

## 2. Architecture & Flow
- **Approach:** Backend Generation using Python's **Pillow** library.
- **User Flow:**
    1. User opens a dive log entry.
    2. User clicks a "Share to Social" button.
    3. A modal opens with a gallery of photos (Dive photos + Dive Site photos).
    4. User selects a photo and crops it using platform presets (1:1 Square, 4:5 Portrait, 9:16 Story).
    5. Frontend sends `dive_id`, selected `media_url`, and `crop` coordinates to the backend.
    6. Backend composites the image with overlays and returns the result.
    7. User previews and downloads the final social-ready image (direct download as JPEG/PNG).

## 3. Backend Implementation (`ShareService` / `SocialImageService`)
- **Endpoint:** `POST /api/dives/{id}/social-image`
- **Logic:**
    1. **Data Retrieval:**
        - Fetch `Dive` metadata (Site, Date, Duration, Depth, Tanks, Temp).
        - Fetch Dive Profile samples from R2 (via `DiveProfileParser`).
        - Fetch the original image from R2.
    2. **Compositing (Pillow):**
        - **Crop:** Apply user-provided crop coordinates.
        - **Gradients:** Apply semi-transparent black-to-transparent linear gradients at the top (30% height) and bottom (35% height).
        - **Profile Line:** 
            - Render an **accurate** (non-smoothed) polyline representing the depth profile.
            - Color: Brand blue (`#3b82f6`).
            - Fill: 20% opacity area fill below the line.
        - **Top Metadata:** Render text using a bundled sans-serif font (e.g. Roboto Bold).
        - **Right URL:**
            - Render the dive URL vertically along the right edge.
            - Hostname: Dynamic based on the request origin (fallback to `divemap.gr`).
            - Style: Bold, larger font for high visibility.
    3. **Output:** Return high-quality JPEG/PNG with `Content-Disposition: attachment` headers for direct download.

## 4. Frontend Implementation
- **Components:**
    - `SocialShareModal.jsx`: Integrated into `DiveDetail.jsx`.
    - `react-image-crop`: For the cropping interface.
- **Platform Presets:**
    - Square (1:1) - Instagram Post
    - Portrait (4:5) - Instagram/Facebook Feed
    - Story (9:16) - Instagram/Facebook Stories

## 5. Security & Performance
- **Auth:** Require authentication and ownership/view permissions for the dive.
- **Caching:** Cache the generated image in the user's session or a temporary store for 30 minutes to allow re-downloads without regeneration.
- **CORS:** Ensure R2 headers allow the frontend to load original images for cropping.

## 6. Success Criteria
- Images generated with the correct aspect ratio and high resolution.
- Profile line matches the data shown in the app precisely.
- Overlays are readable on both very light and very dark backgrounds.
- URL correctly reflects the current domain.
