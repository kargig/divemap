# Share/Social Media Integration Plan

**Document Version:** 1.0  
**Created:** November 2025  
**Status:** Planning

## Overview

This document outlines the comprehensive plan for implementing share and social media integration functionality for dives, dive sites, and dive routes in the Divemap application. The implementation will enable users to share dive experiences, locations, and routes across multiple social media platforms and communication channels.

## Goals

1. **Enable sharing** of dives, dive sites, and dive routes via multiple platforms
2. **Generate engaging share content** with titles, descriptions, and preview images
3. **Increase platform visibility** through social media sharing
4. **Support multiple sharing methods**: URL, email, Twitter, Facebook, Instagram, Reddit, Viber, WhatsApp, etc.
5. **Create inviting social posts** that encourage other users to explore specific dives/sites/routes

## Current State Analysis

### Existing Sharing Functionality

1. **Dive Routes** (`RouteDetail.js`):
   - Basic URL copying functionality via `handleShareRoute()`
   - Backend endpoint: `POST /api/v1/dive-routes/{route_id}/share`
   - Simple clipboard copy with toast notification
   - No social media integration

2. **Map View** (`IndependentMapView.js`):
   - Share modal with URL copying
   - Includes viewport and filter state in share URL
   - Modal-based UI pattern exists

3. **No sharing functionality** for:
   - Individual dives (`DiveDetail.js`)
   - Dive sites (`DiveSiteDetail.js`)

### Data Available for Sharing

#### Dives
- **Title**: `name` or generated from dive site + date
- **Description**: `dive_information` (if exists)
- **Dive Site**: Name, location (country/region)
- **Key Stats**: Max depth, duration, dive date, visibility rating, user rating
- **Media**: Photos/videos (if available)
- **Route**: Selected route name (if applicable)

#### Dive Sites
- **Title**: `name`
- **Description**: `description` (if exists)
- **Location**: Country, region, coordinates
- **Key Stats**: Difficulty level, max depth, average rating
- **Media**: Site photos/videos (if available)

#### Dive Routes
- **Title**: `name`
- **Description**: `description` (if exists)
- **Dive Site**: Associated dive site name
- **Key Stats**: Route type, waypoint count, community usage stats
- **Visual**: Route visualization on map

## Technical Architecture

### Frontend Components

#### 1. Share Button Component (`ShareButton.js`)
**Location:** `frontend/src/components/ShareButton.js`

Reusable component that:
- Displays share icon button
- Opens share modal on click
- Handles different entity types (dive, dive-site, route)

**Props:**
```javascript
{
  entityType: 'dive' | 'dive-site' | 'route',
  entityId: number,
  entityData: {
    title: string,
    description?: string,
    url: string,
    // ... other relevant data
  },
  className?: string
}
```

#### 2. Share Modal Component (`ShareModal.js`)
**Location:** `frontend/src/components/ShareModal.js`

Comprehensive share modal featuring:
- **URL Copy Section**: Display shareable URL with copy button
- **Social Media Buttons Grid**: Icons/buttons for each platform
- **Email Share**: Direct email link generation
- **Preview Section**: Shows what will be shared (title, description preview)

**Social Media Platforms:**
- Twitter/X
- Facebook
- Instagram (via app link or web share)
- Reddit
- WhatsApp
- Viber
- Email
- Copy URL (fallback)

#### 3. Share Content Generator (`shareUtils.js`)
**Location:** `frontend/src/utils/shareUtils.js`

Utility functions to:
- Generate shareable URLs for each entity type
- Format content for different social platforms
- Create Open Graph meta tags (for backend SEO sharing)
- Generate email subject/body templates
- Create platform-specific share URLs

### Backend Endpoints

#### Share Endpoints Structure

```python
# Dive sharing
POST /api/v1/dives/{dive_id}/share
GET /api/v1/dives/{dive_id}/share-preview

# Dive site sharing  
POST /api/v1/dive-sites/{dive_site_id}/share
GET /api/v1/dive-sites/{dive_site_id}/share-preview

# Dive route sharing (enhance existing)
POST /api/v1/dive-routes/{route_id}/share
GET /api/v1/dive-routes/{route_id}/share-preview
```

#### Response Format

```json
{
  "share_url": "https://divemap.com/dives/123",
  "title": "Amazing Dive at Blue Hole",
  "description": "Incredible 30m dive with amazing visibility...",
  "image_url": "https://divemap.com/media/dives/123/preview.jpg",
  "share_platforms": {
    "twitter": "https://twitter.com/intent/tweet?...",
    "facebook": "https://www.facebook.com/sharer/sharer.php?...",
    "whatsapp": "https://wa.me/?text=...",
    "email": "mailto:?subject=...&body=...",
    // ... other platforms
  },
  "metadata": {
    "entity_type": "dive",
    "entity_id": 123,
    "shared_at": "2025-11-01T12:00:00Z",
    "shared_by": 456
  }
}
```

## Implementation Plan

### Phase 1: Frontend Share Infrastructure

#### 1.1 Create Share Utilities (`frontend/src/utils/shareUtils.js`)

**Functions to implement:**

```javascript
// Generate shareable URL for entity
export function generateShareUrl(entityType, entityId, baseUrl = null)

// Generate platform-specific share URLs
export function getTwitterShareUrl(url, title, description)
export function getFacebookShareUrl(url, title, description)
export function getWhatsAppShareUrl(url, title, description)
export function getViberShareUrl(url, title, description)
export function getRedditShareUrl(url, title, description)
export function getEmailShareUrl(url, title, description)

// Format share text for platforms
export function formatShareText(entityType, entityData, platform)

// Copy to clipboard utility
export async function copyToClipboard(text)

// Open share dialog (for native Web Share API)
export async function openNativeShare(data)
```

#### 1.2 Create ShareModal Component

**Features:**
- Modal overlay with close button
- URL display with copy button
- Grid of social media platform buttons
- Each button opens platform-specific share URL in new window/tab
- Native Web Share API support for mobile devices
- Preview of what will be shared

**UI Layout:**
```
┌─────────────────────────────────────┐
│ Share Dive                    [X]   │
├─────────────────────────────────────┤
│ Preview:                             │
│ ┌─────────────────────────────────┐ │
│ │ [Preview Image]                 │ │
│ │ Amazing Dive at Blue Hole       │ │
│ │ Check out this incredible dive...│ │
│ └─────────────────────────────────┘ │
│                                      │
│ Share URL:                           │
│ [https://...] [Copy]                 │
│                                      │
│ Share via:                           │
│ [Twitter] [Facebook] [WhatsApp]      │
│ [Viber] [Reddit] [Email] [More...]   │
└─────────────────────────────────────┘
```

#### 1.3 Create ShareButton Component

Simple button that triggers ShareModal.

### Phase 2: Entity-Specific Sharing

#### 2.1 Dive Sharing (`DiveDetail.js`)

**Integration points:**
1. Add Share button to action bar (next to Edit/Delete)
2. Pass dive data to ShareModal:
   - Title: `dive.name` or `{diveSite.name} - {diveDate}`
   - Description: `dive.dive_information` (truncated if long)
   - URL: `/dives/{dive_id}`
   - Stats: depth, duration, ratings
   - Media: First dive photo (if available)

**Share content template:**
```
Title: "Amazing Dive at Blue Hole - November 1, 2025"

Description: 
"Incredible dive at Blue Hole! Max depth: 30m, Duration: 45min
Visibility was amazing and saw so much marine life. Rating: 9/10"

Check it out: [URL]
```

#### 2.2 Dive Site Sharing (`DiveSiteDetail.js`)

**Integration points:**
1. Add Share button to header section
2. Pass dive site data to ShareModal:
   - Title: `diveSite.name`
   - Description: `diveSite.description` (truncated)
   - URL: `/dive-sites/{dive_site_id}`
   - Location: Country, region
   - Stats: Difficulty, max depth, average rating
   - Media: First site photo (if available)

**Share content template:**
```
Title: "Blue Hole - Dahab, Egypt"

Description:
"One of the world's most famous dive sites! Max depth: 120m
Difficulty: Advanced. Experience the incredible visibility and 
marine life at this legendary location."

Check it out: [URL]
```

#### 2.3 Dive Route Sharing (`RouteDetail.js`)

**Enhancement points:**
1. Replace basic `handleShareRoute()` with ShareModal integration
2. Pass route data to ShareModal:
   - Title: `route.name`
   - Description: `route.description` (truncated)
   - URL: `/dive-sites/{dive_site_id}/route/{route_id}`
   - Dive Site: Associated dive site name
   - Stats: Route type, waypoint count, community usage
   - Visual: Route map screenshot or thumbnail (future enhancement)

**Share content template:**
```
Title: "Shallow Reef Route - Blue Hole"

Description:
"A scenic route perfect for beginners! Follow this carefully 
planned path to see the best of Blue Hole. Includes waypoints 
and detailed bearings."

Check it out: [URL]
```

### Phase 3: Backend Share Endpoints

#### 3.1 Create Share Router (`backend/app/routers/share.py`)

**New router file** with endpoints for all entity types:

```python
from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user_optional
from app.models import Dive, DiveSite, DiveRoute

router = APIRouter(prefix="/api/v1/share", tags=["share"])

@router.post("/dives/{dive_id}")
async def share_dive(dive_id: int, ...):
    """Generate shareable content for a dive"""
    pass

@router.post("/dive-sites/{dive_site_id}")
async def share_dive_site(dive_site_id: int, ...):
    """Generate shareable content for a dive site"""
    pass

@router.post("/dive-routes/{route_id}")
async def share_dive_route(route_id: int, ...):
    """Generate shareable content for a dive route"""
    pass

@router.get("/dives/{dive_id}/preview")
async def get_dive_share_preview(dive_id: int, ...):
    """Get preview data for sharing a dive"""
    pass

# Similar endpoints for dive sites and routes
```

#### 3.2 Share Service (`backend/app/services/share_service.py`)

**Service class** to handle share logic:

```python
class ShareService:
    def generate_share_url(self, entity_type, entity_id, base_url)
    def format_share_content(self, entity_type, entity_data, platform)
    def get_platform_share_urls(self, share_url, title, description, platform)
    def generate_preview_image_url(self, entity_type, entity_id, entity_data)
```

#### 3.3 Enhance Existing Route Share Endpoint

Update `POST /api/v1/dive-routes/{route_id}/share` to return comprehensive share data matching new format.

### Phase 4: Social Media Platform Integration

#### 4.1 Platform-Specific URL Generation

**Twitter/X:**
```
https://twitter.com/intent/tweet?
  text={encoded_title_and_description}
  &url={encoded_url}
  &hashtags=diving,scubadiving
```

**Facebook:**
```
https://www.facebook.com/sharer/sharer.php?
  u={encoded_url}
  &quote={encoded_title}
```

**WhatsApp:**
```
https://wa.me/?
  text={encoded_title_and_description_and_url}
```

**Viber:**
```
viber://forward?
  text={encoded_title_and_description_and_url}
```

**Reddit:**
```
https://reddit.com/submit?
  url={encoded_url}
  &title={encoded_title}
```

**Email:**
```
mailto:?
  subject={encoded_title}
  &body={encoded_description_and_url}
```

**Instagram:**
- Use native share functionality (requires app context)
- Fallback to clipboard copy with instructions
- Web: Link in bio approach (limited functionality)

#### 4.2 Native Web Share API Integration

For mobile devices, utilize Web Share API when available:

```javascript
if (navigator.share) {
  navigator.share({
    title: shareData.title,
    text: shareData.description,
    url: shareData.url
  });
} else {
  // Fallback to custom modal
}
```

### Phase 5: Share Content Formatting

#### 5.1 Content Length Guidelines

**Twitter/X:**
- Title: Max 280 characters (include URL in count)
- Description: Truncate to fit with URL
- Use hashtags: #diving #scubadiving

**Facebook:**
- Title: Up to 100 characters
- Description: Up to 500 characters
- Supports rich previews via Open Graph tags

**WhatsApp/Viber:**
- Title + Description: Concise but informative
- Include emoji for visual appeal 🐠🌊🤿

**Reddit:**
- Title: Descriptive and engaging
- Description: Optional, in post body

**Email:**
- Subject: Clear and descriptive
- Body: Full description with formatted URL

#### 5.2 Share Text Templates

**Dive Template:**
```
🐠 Amazing Dive at [Dive Site Name]!

[Dive Information or Description]

📍 Location: [Country, Region]
💧 Max Depth: [X]m | Duration: [X]min
⭐ Rating: [X]/10

Check it out: [URL]

#diving #scubadiving #divemap
```

**Dive Site Template:**
```
🌊 Explore [Dive Site Name]!

[Description]

📍 [Country, Region]
📊 Difficulty: [Level] | Max Depth: [X]m
⭐ Average Rating: [X]/10

Discover this dive site: [URL]

#diving #scubadiving #divemap #[location]
```

**Dive Route Template:**
```
🗺️ [Route Name] - [Dive Site Name]

[Description]

📍 Follow this route to experience the best of [Dive Site]
🎯 [X] waypoints | Route type: [Type]

Plan your dive: [URL]

#diving #scubadiving #divemap #diveroute
```

## UI/UX Design Considerations

### Share Button Placement

1. **Dives**: Header action bar (right side, between Download and Edit)
2. **Dive Sites**: Header section (near Edit button, if user has permissions)
3. **Dive Routes**: Existing location (header action bar)

### Modal Design

- **Responsive**: Mobile-friendly layout
- **Quick Actions**: Prominent social media buttons
- **URL Copy**: Easy one-click copy
- **Preview**: Visual preview of share content
- **Native Share**: Automatic detection and use on mobile

### Visual Feedback

- Success toast on successful share action
- Visual feedback on button clicks
- Loading states for async operations
- Error handling with user-friendly messages

## Security and Privacy Considerations

### Access Control

- **Public entities**: Shareable by anyone
- **Private dives**: Only shareable by owner (check `is_private` flag)
- **User privacy**: Respect user privacy settings
- **Admin override**: Admins can share any content

### URL Security

- Share URLs should be publicly accessible (if entity is public)
- No sensitive data in URLs
- Use HTTPS in production
- Consider short URLs for cleaner sharing (future enhancement)

### Analytics

- Track share events (already implemented for routes)
- Track platform-specific shares
- Monitor share-to-visit conversion
- Privacy-respecting analytics (no PII)

## Testing Requirements

### Unit Tests

- Share URL generation
- Content formatting functions
- Platform URL generation
- Utility functions

### Integration Tests

- Share modal component rendering
- Share button interactions
- API endpoint responses
- Share flow end-to-end

### User Testing

- Share on different devices (mobile, desktop)
- Test all social media platforms
- Verify share content accuracy
- Test error handling

## Future Enhancements

### Phase 6 (Future): Advanced Features

1. **Share Preview Images**:
   - Generate dynamic preview images for social platforms
   - Include dive profile chart, route map, or site photo
   - Open Graph image generation

2. **Short URLs**:
   - Integrate URL shortening service
   - Custom branded short links (divemap.com/d/abc123)
   - Analytics on short URL clicks

3. **Share Analytics Dashboard**:
   - Track shares per entity
   - Platform-specific analytics
   - Share performance metrics

4. **Bulk Sharing**:
   - Share multiple dives at once
   - Share dive trips/collections

5. **Custom Share Messages**:
   - Allow users to customize share text
   - Add personal notes to shares

6. **QR Code Generation**:
   - Generate QR codes for easy mobile sharing
   - Include in share modal

7. **Scheduled Shares**:
   - Schedule social media posts
   - Auto-share dive logs after completion

## Implementation Checklist

### Frontend

- [x] Create `shareUtils.js` with all utility functions
- [x] Create `ShareModal.js` component
- [x] Create `ShareButton.js` component
- [x] Integrate share into `DiveDetail.js`
- [x] Integrate share into `DiveSiteDetail.js`
- [x] Enhance share in `RouteDetail.js`
- [x] Add icons for all social media platforms
- [x] Implement native Web Share API support
- [x] Add loading and error states
- [ ] Write unit tests for utilities
- [ ] Write component tests

### Backend

- [x] Create `share_service.py`
- [x] Create `share.py` router
- [x] Add share endpoints for dives
- [x] Add share endpoints for dive sites
- [x] Enhance existing route share endpoint (integrated with new share service)
- [x] Add share preview endpoints
- [x] Implement access control
- [x] Add analytics tracking (for routes)
- [ ] Write API tests
- [x] Update API documentation

### Documentation

- [ ] Update user documentation
- [ ] Update API documentation
- [ ] Add developer guide for sharing
- [ ] Create share feature announcement

## Success Metrics

1. **Adoption Rate**: % of users who use share functionality
2. **Platform Distribution**: Which platforms are most used
3. **Traffic from Shares**: Visitors arriving via shared links
4. **Share-to-Signup**: Conversion from share clicks to user registrations
5. **Engagement**: Time spent on shared content

## Timeline Estimate

- **Phase 1**: 2-3 days (Share infrastructure)
- **Phase 2**: 3-4 days (Entity-specific integration)
- **Phase 3**: 2-3 days (Backend endpoints)
- **Phase 4**: 2 days (Social platform integration)
- **Phase 5**: 1 day (Content formatting)
- **Testing & Polish**: 2-3 days

**Total Estimated Time**: 12-16 days

## Dependencies

### Frontend Dependencies

- No new npm packages required (using existing React Query, React Router)
- Consider `react-share` library for simplified social sharing (optional)
- Use existing `lucide-react` icons

### Backend Dependencies

- No new Python packages required
- Existing FastAPI, SQLAlchemy setup sufficient

## Notes

- Maintain consistency with existing share patterns (route sharing)
- Follow project coding standards and patterns
- Ensure mobile responsiveness
- Consider internationalization (i18n) for share text
- Respect user privacy and data protection regulations (GDPR, etc.)
- Test on multiple browsers and devices
- Ensure accessibility (ARIA labels, keyboard navigation)

