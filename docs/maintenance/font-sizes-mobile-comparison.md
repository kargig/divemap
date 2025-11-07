# Font Sizes Comparison - Mobile View

**Last Updated:** November 7, 2025  
**Viewport:** 375px × 667px (Mobile)

This document provides a comprehensive comparison of font sizes used across different pages in mobile view.

## Summary Table

| Element Type | Dives | Dive Sites | Diving Centers | Dive Trips | Trip Detail |
|-------------|-------|------------|----------------|------------|-------------|
| **Title (h3)** | 14px (compact) / 18px (normal) | 14px (compact) / 18px (normal) | 14px (compact) / 18px (normal) | 14px (compact) / 18px (normal) | 20px (h1, mobile) |
| **Location/Address** | 14px | 14px | 12px | 14px | 14px |
| **Description** | 14px (compact) / 16px (normal) | 12px | 12px (compact) / 14px (normal) | 14px | 14px (mobile) |
| **Date/Time** | 14px | - | - | 12px | 14px (mobile) |
| **Badges/Tags** | 11px | 11px | 10px (geo badges) / 11px (other) | 11px | 12px |
| **Difficulty** | 11px | 11px | - | 11px | - |
| **Rating** | 11px | 11px | 11px | 11px | - |
| **Metadata (depth, duration)** | 11px | 11px | - | 11px | 12px |
| **Contact Info (email/website)** | - | - | 12px | - | 14px |
| **Action Buttons** | 12px | 12px | 12px | 12px | 14px |

## Goal Table (Desired Sizes - ✅ Now Implemented)

| Element Type | Dives | Dive Sites | Diving Centers | Dive Trips | Trip Detail |
|-------------|-------|------------|----------------|------------|-------------|
| **Title (h3)** | 14px (compact) / 18px (normal) ✅ | 14px (compact) / 18px (normal) ✅ | 14px (compact) / 18px (normal) ✅ | 14px (compact) / 18px (normal) ✅ | 20px (h1, mobile) ✅ |
| **Location/Address** | 14px | 14px | 12px | 14px | 14px |
| **Description** | 14px (compact) / 16px (normal) | 12px | 12px (compact) / 14px (normal) | 14px | 14px (mobile) |
| **Date/Time** | 14px | - | - | 12px | 14px (mobile) |
| **Badges/Tags** | 11px ✅ | 11px ✅ | 10px (geo badges) ✅ / 11px (other) ✅ | 11px ✅ | 12px |
| **Difficulty** | 11px ✅ | 11px ✅ | - | 11px ✅ | - |
| **Rating** | 11px ✅ | 11px ✅ | 11px ✅ | 11px ✅ | - |
| **Metadata (depth, duration)** | 11px ✅ | 11px ✅ | - | 11px ✅ | 12px |
| **Contact Info (email/website)** | - | - | 12px | - | 14px |
| **Action Buttons** | 12px ✅ | 12px ✅ | 12px ✅ | 12px ✅ | 14px |

## Detailed Breakdown by Page

### 1. Dives Page (`/dives`)

**Card Elements:**

- **Title (h3)**: `text-sm` (compact) / `text-lg` (normal) = **14px** / **18px** ✅
- **Date**: `text-sm` = **14px**
- **Difficulty Badge**: `text-[11px]` = **11px** ✅
- **Depth/Duration**: `text-[11px]` = **11px** ✅
- **Rating**: `text-[11px]` = **11px** ✅
- **Suit Type Badge**: `text-[11px]` = **11px** ✅
- **Description/Metadata**: `text-sm` (compact) / `text-base` (normal) = **14px** / **16px**
- **Tag Buttons**: `text-[11px]` = **11px** ✅

**Code Reference:**

```javascript
// From Dives.js - Updated November 2025
className={`${compactLayout ? 'text-sm' : 'text-lg'}`} // Title: 14px / 18px
className='text-sm'   // Date: 14px
className='text-[11px]' // Difficulty, depth, duration, rating, tags: 11px
className={`${compactLayout ? 'text-sm' : 'text-base'}`} // Description: 14px / 16px
```

### 2. Dive Sites Page (`/dive-sites`)

**Card Elements:**

- **Title (h3)**: `text-sm` (compact) / `text-lg` (normal) = **14px** / **18px** ✅
- **Location**: `text-xs` (compact) / `text-sm` (normal) = **12px** / **14px**
- **Description**: `text-xs` = **12px**
- **Difficulty Badge**: `text-[11px]` = **11px** ✅
- **Depth/Rating**: `text-[11px]` = **11px** ✅
- **Tag Buttons**: `text-[11px]` = **11px** ✅

**Code Reference:**

```javascript
// From DiveSites.js - Updated November 2025
className={`${compactLayout ? 'text-sm' : 'text-lg'}`} // Title: 14px / 18px
className={`${compactLayout ? 'text-xs' : 'text-sm'}`} // Location: 12px / 14px
className='text-xs' // Description: 12px
className='text-[11px]' // Difficulty, depth, rating, tags: 11px
```

### 3. Diving Centers Page (`/diving-centers`)

**Card Elements:**

- **Title (h3)**: `text-sm` (compact) / `text-lg` (normal) = **14px** / **18px** ✅
- **Location**: `text-xs` = **12px**
- **Description**: `text-xs` (compact) / `text-sm` (normal) = **12px** / **14px**
- **Geographic Badges** (country/region/city): `text-[10px]` = **10px** ✅ (Restored)
- **Rating**: `text-[11px]` = **11px** ✅
- **Email/Website**: `text-xs` = **12px**
- **Action Buttons**: `text-xs` = **12px**

**Code Reference:**

```javascript
// From DivingCenters.js - Updated November 2025
className={`${compactLayout ? 'text-sm' : 'text-lg'}`} // Title: 14px / 18px
className='text-xs' // Location, email/website: 12px
className='text-[10px]' // Geographic badges (country/region/city): 10px
className='text-[11px]' // Rating: 11px
```

**Note:** Geographic badges (country, region, city) use **10px** font size on mobile, which is smaller than other badges (11px) to save vertical space. This was restored in November 2025.

### 4. Dive Trips Page (`/dive-trips`)

**Card Elements:**

- **Title (h3)**: `text-sm` (compact) / `text-lg` (normal) = **14px** / **18px** ✅
- **Description**: `text-sm` = **14px**
- **Date**: `text-xs` = **12px**
- **Difficulty Badge**: `text-[11px]` = **11px** ✅
- **Depth/Duration/Price**: `text-[11px]` = **11px** ✅
- **Action Buttons**: `text-xs` = **12px** ✅

**Code Reference:**

```javascript
// From DiveTrips.js - Updated November 2025
className={`${compactLayout ? 'text-sm' : 'text-lg'}`} // Title: 14px / 18px
className='text-sm' // Description: 14px
className='text-xs' // Date, action buttons: 12px
className='text-[11px]' // Difficulty, depth, price: 11px
```

### 5. Trip Detail Page (`/dive-trips/:id`)

**Page Elements:**

- **Title (h1)**: `text-xl sm:text-2xl lg:text-3xl` = **20px** (mobile) ✅
- **Description**: `text-sm sm:text-base lg:text-lg` = **14px** (mobile) ✅
- **Date/Time Labels**: `text-sm` = **14px**
- **Dive Site Info**: `text-sm` = **14px**
- **Location Metadata**: `text-xs` = **12px**
- **Status Badge**: `text-xs` = **12px**

**Code Reference:**

```javascript
// From TripHeader.js - Updated November 2025
className='text-xl sm:text-2xl lg:text-3xl' // Title: 20px mobile, responsive
className='text-sm sm:text-base lg:text-lg' // Description: 14px mobile, responsive
className='text-sm' // Date/time labels, dive site info: 14px
className='text-xs' // Status badge, location metadata: 12px
```

### 6. Dive Detail Page (`/dives/:id`)

**Page Elements:**

- **Title (h1)**: `text-xl sm:text-2xl lg:text-3xl` = **20px** (mobile)
- **Date/Time**: `text-sm sm:text-base` = **14px** (mobile)
- **Privacy Badge**: `text-xs` = **12px**
- **Description**: `text-sm` = **14px**
- **Metadata**: `text-xs` = **12px**

## Key Observations

### Consistency Issues

1. **Geographic Badges in Diving Centers**: Use **10px** (smaller than standard 12px badges)

   - This was intentionally reduced to save vertical space
   - Other pages use **12px** for similar badge elements

2. **Title Sizes**: Standardized to **14px** (compact) / **18px** (normal) across all list pages ✅:

   - All list pages: **14px** (`text-sm`) compact / **18px** (`text-lg`) normal
   - Trip Detail: **20px** (h1, `text-xl` mobile)
   - Dive Detail: **20px** (h1, `text-xl` mobile)

3. **Description Sizes**: Varies based on compact layout:

   - Compact: **12px** (text-xs)
   - Normal: **14px** (text-sm)

4. **Badge Sizes**: Standardized to **11px** (`text-[11px]`) for most badges ✅:

   - Difficulty, Rating, Metadata, Tags: **11px** (`text-[11px]`)
   - Diving Centers geographic badges: **10px** (`text-[10px]`) - intentionally smaller to save space

### Recent Updates (November 2025)

1. **✅ Standardized Title Sizes**: All list pages now use **14px** (`text-sm`) compact / **18px** (`text-lg`) normal
2. **✅ Standardized Badge Sizes**: Most badges now use **11px** (`text-[11px]`) for consistency
3. **✅ Standardized Metadata**: Depth, duration, and rating now use **11px** (`text-[11px]`) across all pages
4. **✅ Restored Geographic Badges**: Diving Centers geographic badges restored to **10px** (`text-[10px]`)
5. **✅ Fixed Trip Detail Header**: Title now uses responsive sizing (`text-xl` mobile, `text-2xl` tablet, `text-3xl` desktop)

### Recommendations

1. **✅ Standardize Badge Sizes**: Completed - Most badges use **11px**, geographic badges use **10px** (documented reason: save vertical space)

2. **Description Consistency**: All pages use appropriate sizing patterns for descriptions

3. **✅ Title Hierarchy**: Standardized - List pages use **14px/18px**, detail pages use **20px** (mobile) with responsive scaling

## Font Size Scale Reference

| Tailwind Class | Mobile Size | Usage |
|----------------|-------------|-------|
| `text-[10px]` | 10px | Geographic badges (Diving Centers only) ✅ |
| `text-[11px]` | 11px | Difficulty, rating, metadata, tags ✅ |
| `text-xs` | 12px | Date, location, contact info, action buttons |
| `text-sm` | 14px | Descriptions, titles (compact), location (normal) |
| `text-base` | 16px | Descriptions (normal) |
| `text-lg` | 18px | Titles (normal) ✅ |
| `text-xl` | 20px | Page titles (h1, mobile) ✅ |

## Mobile-Specific Considerations

- All pages use responsive font sizes with `sm:` breakpoints
- Compact layout mode reduces font sizes by one step (e.g., text-sm → text-xs)
- Touch targets maintain minimum 44px height (enforced by global CSS)
- Geographic badges in Diving Centers override min-height to achieve <34px height
