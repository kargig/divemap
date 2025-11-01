# API Documentation

This document provides comprehensive documentation for the Divemap API,
including all endpoints, authentication methods, request/response formats, and
usage examples.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Base URL](#base-url)
4. [Error Handling](#error-handling)
5. [Endpoints](#endpoints)
6. [Data Models](#data-models)
7. [Rate Limiting](#rate-limiting)
8. [Examples](#examples)

## Overview

The Divemap API is a RESTful API built with FastAPI that provides access to dive
sites, diving centers, user management, and administrative functions. The API
supports JSON request/response formats and includes comprehensive authentication
and authorization.

### API Features

- **RESTful Design**: Standard HTTP methods and status codes
- **JSON Format**: All requests and responses use JSON
- **Authentication**: JWT-based authentication with role-based access
- **Validation**: Comprehensive input validation with Pydantic
- **Documentation**: Auto-generated OpenAPI documentation
- **Rate Limiting**: Protection against API abuse

### API Versioning

The API uses URL versioning with the current version being `v1`:

```text
https://divemap-backend.fly.dev/api/v1/
```text

## Authentication

### JWT Authentication

The API uses JSON Web Tokens (JWT) for authentication. Tokens are obtained
through login endpoints and must be included in subsequent requests.

#### Token Format

```json
{
  "sub": "user_id",
  "username": "username",
  "is_admin": false,
  "is_moderator": false,
  "exp": 1640995200,
  "iat": 1640908800
}
```text

#### Including Tokens

```bash
# Include token in Authorization header
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://divemap-backend.fly.dev/api/v1/users/me
```text

### Google OAuth

The API also supports Google OAuth authentication for enhanced security and user
experience.

#### OAuth Flow

1. User authenticates with Google
2. Frontend receives Google ID token
3. Frontend sends token to backend for verification
4. Backend verifies token with Google's servers
5. Backend creates or links user account
6. Backend returns JWT token for API access

## Base URL

### Production

```text
https://divemap-backend.fly.dev/api/v1/
```text

### Development

```text
http://localhost:8000/api/v1/
```text

### API Documentation URL

```text
https://divemap-backend.fly.dev/docs
```text

## Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid request data |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 422 | Unprocessable Entity - Validation error |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |

### Error Response Format

```json
{
  "detail": "Error message description",
  "error_code": "ERROR_CODE",
  "timestamp": "2024-01-15T10:30:00Z"
}
```text

### Common Error Codes

| Error Code | Description |
|------------|-------------|
| `INVALID_CREDENTIALS` | Username or password incorrect |
| `TOKEN_EXPIRED` | JWT token has expired |
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions |
| `VALIDATION_ERROR` | Request data validation failed |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `RATE_LIMIT_EXCEEDED` | Too many requests |

## Endpoints

### Authentication Endpoints

#### POST /auth/register

Register a new user account.

**Request Body:**

```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```text

**Response:**

```json
{
  "id": 1,
  "username": "newuser",
  "email": "user@example.com",
  "is_admin": false,
  "is_moderator": false,
  "enabled": true,
  "created_at": "2024-01-15T10:30:00Z"
}
```text

#### POST /auth/login

Authenticate user and receive JWT token.

**Request Body:**

```json
{
  "username": "user",
  "password": "password"
}
```text

**Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "user",
    "email": "user@example.com",
    "is_admin": false,
    "is_moderator": false,
    "enabled": true
  }
}
```text

#### POST /auth/google-login

Authenticate using Google OAuth.

**Request Body:**

```json
{
  "id_token": "google_id_token_here"
}
```text

**Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "user",
    "email": "user@example.com",
    "is_admin": false,
    "is_moderator": false,
    "enabled": true
  }
}
```text

#### GET /auth/me

Get current user information.

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
{
  "id": 1,
  "username": "user",
  "email": "user@example.com",
  "is_admin": false,
  "is_moderator": false,
  "enabled": true,
  "diving_certification": "PADI Open Water",
  "number_of_dives": 25,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```text

### User Management Endpoints

#### GET /users/

Get all users (admin only).

**Headers:** `Authorization: Bearer <admin_token>`

**Query Parameters:**

- `skip`: Number of records to skip (default: 0)
- `limit`: Number of records to return (default: 100)
- `search`: Search term for username or email

**Response:**

```json
[
  {
    "id": 1,
    "username": "user1",
    "email": "user1@example.com",
    "is_admin": false,
    "is_moderator": false,
    "enabled": true,
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```text

#### GET /users/{user_id}

Get user by ID.

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
{
  "id": 1,
  "username": "user",
  "email": "user@example.com",
  "is_admin": false,
  "is_moderator": false,
  "enabled": true,
  "diving_certification": "PADI Open Water",
  "number_of_dives": 25,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```text

#### PUT /users/{user_id}

Update user profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "diving_certification": "PADI Advanced Open Water",
  "number_of_dives": 50
}
```text

#### POST /users/me/change-password

Change user password.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "current_password": "oldpassword",
  "new_password": "NewSecurePassword123!"
}
```text

### Dive Sites Endpoints

#### GET /dive-sites/count

Get total count of dive sites matching filters.

**Query Parameters:**

- `name`: Search term for dive site name
- `difficulty_code`: Filter by difficulty code (OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING)
- `exclude_unspecified_difficulty`: Exclude records with unspecified difficulty (boolean, default: false)
- `country`: Filter by country
- `region`: Filter by region
- `min_rating`: Minimum rating filter
- `max_rating`: Maximum rating filter
- `tag_ids`: Comma-separated tag IDs

**Response:**

```json
{
  "total": 74
}
```text

#### GET /dive-sites/

Get dive sites with comprehensive sorting and filtering.

**Query Parameters:**

- `page`: Page number (1-based, default: 1)
- `page_size`: Page size (25, 50, or 100, default: 25)
- `name`: Search term for dive site name
- `difficulty_code`: Filter by difficulty code (OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING)
- `exclude_unspecified_difficulty`: Exclude dive sites with unspecified difficulty (boolean, default: false)
- `country`: Filter by country
- `region`: Filter by region
- `sort_by`: Sort field (name, country, region, difficulty_level, view_count,
  comment_count, created_at, updated_at). Note: `difficulty_level` sorting uses order_index from the difficulty_levels lookup table.
- `sort_order`: Sort order (asc, desc, default: asc)
- `tag_ids`: Comma-separated tag IDs
- `my_dive_sites`: Filter to show only dive sites created by the current user

**Note:** `view_count` and `comment_count` sorting require admin privileges.

**Response Headers:**

- `X-Total-Count`: Total number of records
- `X-Total-Pages`: Total number of pages
- `X-Current-Page`: Current page number
- `X-Page-Size`: Page size
- `X-Has-Next-Page`: Whether there's a next page
- `X-Has-Prev-Page`: Whether there's a previous page

**Response:**

```json
[
  {
    "id": 1,
    "name": "Great Barrier Reef",
    "description": "World-famous coral reef system",
    "latitude": -16.5,
    "longitude": 145.5,
    "address": "Queensland, Australia",
    "access_instructions": "Accessible by boat from Cairns",
    "dive_plans": "Multiple dive sites available",
    "gas_tanks_necessary": "Available for rent",
    "difficulty_code": "ADVANCED_OPEN_WATER",
    "difficulty_label": "Advanced Open Water",
    "marine_life": "Coral, fish, turtles, sharks",
    "safety_information": "Follow dive safety guidelines",
    "max_depth": 30.0,
    "aliases": [
      {
        "id": 1,
        "dive_site_id": 1,
        "alias": "GBR",
        "created_at": "2024-01-15T10:30:00Z"
      },
      {
        "id": 2,
        "dive_site_id": 1,
        "alias": "The Reef",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "country": "Australia",
    "region": "Queensland",
    "view_count": 1250,
    "average_rating": 9.2,
    "tags": ["coral", "marine-life", "sharks"],
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
]
```text

#### POST /dive-sites/

Create new dive site (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:**

```json
{
  "name": "New Dive Site",
  "description": "A beautiful dive site",
  "latitude": -16.5,
  "longitude": 145.5,
  "address": "Location address",
  "access_instructions": "How to access the site",
  "dive_plans": "Dive planning information",
  "gas_tanks_necessary": "Tank requirements",
    "difficulty_code": "ADVANCED_OPEN_WATER",
    "difficulty_label": "Advanced Open Water",
  "marine_life": "Marine life description",
  "safety_information": "Safety guidelines",
  "max_depth": 25.0,
  "aliases": ["Alternative name 1", "Alternative name 2"],
  "country": "Australia",
  "region": "Queensland"
}
```text

#### GET /dive-sites/{dive_site_id}

Get dive site by ID.

**Response:**

```json
{
  "id": 1,
  "name": "Great Barrier Reef",
  "description": "World-famous coral reef system",
  "latitude": -16.5,
  "longitude": 145.5,
  "address": "Queensland, Australia",
  "access_instructions": "Accessible by boat from Cairns",
  "dive_plans": "Multiple dive sites available",
  "gas_tanks_necessary": "Available for rent",
    "difficulty_code": "ADVANCED_OPEN_WATER",
    "difficulty_label": "Advanced Open Water",
  "marine_life": "Coral, fish, turtles, sharks",
  "safety_information": "Follow dive safety guidelines",
  "max_depth": 30.0,
      "aliases": [
      {
        "id": 1,
        "dive_site_id": 1,
        "alias": "GBR",
        "created_at": "2024-01-15T10:30:00Z"
      },
      {
        "id": 2,
        "dive_site_id": 1,
        "alias": "The Reef",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
  "country": "Australia",
  "region": "Queensland",
  "view_count": 1250,
  "average_rating": 9.2,
  "tags": ["coral", "marine-life", "sharks"],
  "comments": [
    {
      "id": 1,
      "user": {
        "username": "diver1",
        "diving_certification": "PADI Open Water",
        "number_of_dives": 25
      },
      "content": "Amazing dive site!",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```text

#### PUT /dive-sites/{dive_site_id}

Update dive site (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:** Same format as POST /dive-sites/

#### DELETE /dive-sites/{dive_site_id}

Delete dive site (admin only).

**Headers:** `Authorization: Bearer <admin_token>`

#### POST /dive-sites/{dive_site_id}/rate

Rate a dive site.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "rating": 9,
  "comment": "Excellent dive site!"
}
```text

#### GET /dive-sites/{dive_site_id}/comments

Get dive site comments.

**Query Parameters:**

- `skip`: Number of records to skip (default: 0)
- `limit`: Number of records to return (default: 100)

**Response:**

```json
[
  {
    "id": 1,
    "user": {
      "username": "diver1",
      "diving_certification": "PADI Open Water",
      "number_of_dives": 25
    },
    "content": "Amazing dive site!",
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```text

#### POST /dive-sites/{dive_site_id}/comments

Add comment to dive site.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "content": "Great dive site with amazing marine life!"
}
```text

### Diving Centers Endpoints

#### GET /diving-centers/count

Get total count of diving centers matching filters.

**Query Parameters:**

- `name`: Search term for diving center name
- `min_rating`: Minimum rating filter
- `max_rating`: Maximum rating filter

**Response:**

```json
{
  "total": 15
}
```text

#### GET /diving-centers/nearby

Find diving centers within a specified radius of given coordinates, sorted by distance. Uses MySQL spatial functions (`POINT` and `ST_Distance_Sphere`) for efficient geospatial queries.

**Query Parameters:**

- `lat` (required): Latitude (-90 to 90)
- `lng` (required): Longitude (-180 to 180)
- `radius_km` (optional): Search radius in kilometers (default: 100, max: 500)
- `limit` (optional): Maximum number of results (default: 25, max: 100)

**Note**: This endpoint requires MySQL with spatial support. SQLite and other databases will return a 400 error.

**Response:**

```json
[
  {
    "id": 1,
    "name": "Cairns Dive Center",
    "country": "Australia",
    "region": "Queensland",
    "city": "Cairns",
    "distance_km": 12.5
  },
  {
    "id": 2,
    "name": "Port Douglas Dive",
    "country": "Australia",
    "region": "Queensland",
    "city": "Port Douglas",
    "distance_km": 45.3
  }
]
```text

**Example Request:**

```bash
curl -X GET "http://localhost:8000/api/v1/diving-centers/nearby?lat=-16.9&lng=145.7&radius_km=100&limit=50"
```text

**Implementation Details**:

- Uses `ST_Distance_Sphere()` for accurate spherical distance calculations (accounts for Earth's curvature)
- Leverages spatial index `idx_diving_centers_location` for fast filtering
- Returns lean payload with only essential fields for performance
- Results are sorted by distance in ascending order

#### GET /diving-centers/search

Search diving centers by name globally with optional distance-aware ranking. Supports prefix matching (preferred) and substring matching for flexible search.

**Query Parameters:**

- `q` (required): Search query string (1-200 characters)
- `limit` (optional): Maximum number of results (default: 20, max: 50)
- `lat` (optional): Latitude for distance ranking (-90 to 90)
- `lng` (optional): Longitude for distance ranking (-180 to 180)

**Note**: When `lat` and `lng` are provided, results are ranked by:

1. Name match priority (prefix matches first, then substring matches)
2. Distance (when coordinates provided and using MySQL)

Without coordinates, results are ranked by name match priority only.

**Response (with coordinates):**

```json
[
  {
    "id": 1,
    "name": "Cairns Dive Center",
    "country": "Australia",
    "region": "Queensland",
    "city": "Cairns",
    "distance_km": 12.5
  },
  {
    "id": 3,
    "name": "Cairns Underwater Adventures",
    "country": "Australia",
    "region": "Queensland",
    "city": "Cairns",
    "distance_km": 18.2
  }
]
```text

**Response (without coordinates):**

```json
[
  {
    "id": 1,
    "name": "Cairns Dive Center",
    "country": "Australia",
    "region": "Queensland",
    "city": "Cairns"
  },
  {
    "id": 3,
    "name": "Cairns Underwater Adventures",
    "country": "Australia",
    "region": "Queensland",
    "city": "Cairns"
  }
]
```text

**Example Requests:**

```bash
# Search with distance ranking
curl -X GET "http://localhost:8000/api/v1/diving-centers/search?q=Cairns&lat=-16.9&lng=145.7&limit=20"

# Search without coordinates (prefix/substring matching only)
curl -X GET "http://localhost:8000/api/v1/diving-centers/search?q=Dive&limit=20"
```text

**Implementation Details**:

- Prefix matches (name starts with query) are ranked before substring matches
- When coordinates provided: ranking uses name priority + distance
- Without coordinates: ranking uses name priority + alphabetical order
- Works with both MySQL (spatial) and SQLite (standard LIKE queries)
- Distance calculations require MySQL with spatial support

#### GET /diving-centers/

Get all diving centers with comprehensive sorting and filtering.

**Query Parameters:**

- `page`: Page number (1-based, default: 1)
- `page_size`: Page size (25, 50, or 100, default: 25)
- `name`: Search term for diving center name
- `min_rating`: Minimum rating filter
- `max_rating`: Maximum rating filter
- `sort_by`: Sort field (name, view_count, comment_count, created_at,
  updated_at)
- `sort_order`: Sort order (asc, desc, default: asc)

**Note:** `view_count` and `comment_count` sorting require admin privileges.

**Response Headers:**

- `X-Total-Count`: Total number of records
- `X-Total-Pages`: Total number of pages
- `X-Current-Page`: Current page number
- `X-Page-Size`: Page size
- `X-Has-Next-Page`: Whether there's a next page
- `X-Has-Prev-Page`: Whether there's a previous page

**Response:**

```json
[
  {
    "id": 1,
    "name": "Cairns Dive Center",
    "description": "Professional diving center in Cairns",
    "email": "info@cairnsdive.com",
    "phone": "+61 7 4051 0294",
    "website": "https://cairnsdive.com",
    "latitude": -16.9,
    "longitude": 145.7,
    "view_count": 850,
    "average_rating": 8.5,
    "gear_rental_costs": [
      {
        "id": 1,
        "gear_type": "BCD",
        "cost": 25.00,
        "currency": "AUD",
        "duration": "per day"
      }
    ],
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
]
```text

#### POST /diving-centers/

Create new diving center (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:**

```json
{
  "name": "New Diving Center",
  "description": "Professional diving services",
  "email": "info@divingcenter.com",
  "phone": "+1 555 123 4567",
  "website": "https://divingcenter.com",
  "latitude": -16.9,
  "longitude": 145.7
}
```text

#### GET /diving-centers/{diving_center_id}

Get diving center by ID.

**Response:**

```json
{
  "id": 1,
  "name": "Cairns Dive Center",
  "description": "Professional diving center in Cairns",
  "email": "info@cairnsdive.com",
  "phone": "+61 7 4051 0294",
  "website": "https://cairnsdive.com",
  "latitude": -16.9,
  "longitude": 145.7,
  "view_count": 850,
  "average_rating": 8.5,
  "gear_rental_costs": [
    {
      "id": 1,
      "gear_type": "BCD",
      "cost": 25.00,
      "currency": "AUD",
      "duration": "per day"
    }
  ],
  "comments": [
    {
      "id": 1,
      "user": {
        "username": "diver1",
        "diving_certification": "PADI Open Water",
        "number_of_dives": 25
      },
      "content": "Great service!",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```text

#### PUT /diving-centers/{diving_center_id}

Update diving center (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:** Same format as POST /diving-centers/

#### DELETE /diving-centers/{diving_center_id}

Delete diving center (admin only).

**Headers:** `Authorization: Bearer <admin_token>`

#### POST /diving-centers/{diving_center_id}/rate

Rate a diving center.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "rating": 8,
  "comment": "Good service and equipment!"
}
```text

#### GET /diving-centers/{diving_center_id}/comments

Get diving center comments.

**Query Parameters:**

- `skip`: Number of records to skip (default: 0)
- `limit`: Number of records to return (default: 100)

#### POST /diving-centers/{diving_center_id}/comments

Add comment to diving center.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "content": "Excellent service and professional staff!"
}
```text

### Gear Rental Management

#### GET /diving-centers/{diving_center_id}/gear-rental

Get diving center gear rental costs.

**Response:**

```json
[
  {
    "id": 1,
    "gear_type": "BCD",
    "cost": 25.00,
    "currency": "AUD",
    "duration": "per day"
  },
  {
    "id": 2,
    "gear_type": "Regulator",
    "cost": 20.00,
    "currency": "AUD",
    "duration": "per day"
  }
]
```text

#### POST /diving-centers/{diving_center_id}/gear-rental

Add gear rental cost (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:**

```json
{
  "gear_type": "BCD",
  "cost": 25.00,
  "currency": "AUD",
  "duration": "per day"
}
```text

#### PUT /diving-centers/{diving_center_id}/gear-rental/{gear_id}

Update gear rental cost (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:** Same format as POST

#### DELETE /diving-centers/{diving_center_id}/gear-rental/{gear_id}

Delete gear rental cost (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

### Tag Management

#### GET /tags/

Get all available tags.

**Response:**

```json
[
  {
    "id": 1,
    "name": "coral",
    "description": "Coral reef dive sites"
  },
  {
    "id": 2,
    "name": "marine-life",
    "description": "Rich marine life"
  }
]
```text

#### GET /tags/with-counts

Get tags with dive site counts.

**Response:**

```json
[
  {
    "id": 1,
    "name": "coral",
    "description": "Coral reef dive sites",
    "dive_site_count": 15
  },
  {
    "id": 2,
    "name": "marine-life",
    "description": "Rich marine life",
    "dive_site_count": 23
  }
]
```text

#### POST /tags/

Create new tag (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:**

```json
{
  "name": "wreck",
  "description": "Shipwreck dive sites"
}
```text

#### PUT /tags/{tag_id}

Update tag (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:** Same format as POST /tags/

#### DELETE /tags/{tag_id}

Delete tag (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

#### POST /tags/dive-sites/{dive_site_id}/tags

Add tag to dive site (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:**

```json
{
  "tag_id": 1
}
```text

#### DELETE /tags/dive-sites/{dive_site_id}/tags/{tag_id}

Remove tag from dive site (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

### Diving Organizations Endpoints

#### GET /diving-organizations/

Get all diving organizations.

**Query Parameters:**

- `skip`: Number of records to skip (default: 0)
- `limit`: Number of records to return (default: 100)

**Response:**

```json
[
  {
    "id": 1,
    "name": "Professional Association of Diving Instructors",
    "acronym": "PADI",
    "website": "https://www.padi.com",
    "logo_url": "https://www.padi.com/logo.png",
    "description": "World-leading scuba diver training organization",
    "country": "United States",
    "founded_year": 1966,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
]
```text

#### GET /diving-organizations/{organization_id}

Get diving organization by ID.

**Response:**

```json
{
  "id": 1,
  "name": "Professional Association of Diving Instructors",
  "acronym": "PADI",
  "website": "https://www.padi.com",
  "logo_url": "https://www.padi.com/logo.png",
  "description": "World-leading scuba diver training organization",
  "country": "United States",
  "founded_year": 1966,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```text

#### POST /diving-organizations/

Create new diving organization (admin only).

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:**

```json
{
  "name": "Professional Association of Diving Instructors",
  "acronym": "PADI",
  "website": "https://www.padi.com",
  "logo_url": "https://www.padi.com/logo.png",
  "description": "World-leading scuba diver training organization",
  "country": "United States",
  "founded_year": 1966
}
```text

#### PUT /diving-organizations/{organization_id}

Update diving organization (admin only).

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:** Same format as POST /diving-organizations/

#### DELETE /diving-organizations/{organization_id}

Delete diving organization (admin only).

**Headers:** `Authorization: Bearer <admin_token>`

### User Certifications Endpoints

#### GET /user-certifications/my-certifications

Get current user's certifications.

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
[
  {
    "id": 1,
    "user_id": 1,
    "diving_organization": {
      "id": 1,
      "name": "Professional Association of Diving Instructors",
      "acronym": "PADI",
      "website": "https://www.padi.com"
    },
    "certification_level": "Open Water Diver",
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
]
```text

#### GET /user-certifications/users/{user_id}/certifications

Get public certifications for a specific user.

**Response:**

```json
[
  {
    "id": 1,
    "user_id": 1,
    "diving_organization": {
      "id": 1,
      "name": "Professional Association of Diving Instructors",
      "acronym": "PADI",
      "website": "https://www.padi.com"
    },
    "certification_level": "Open Water Diver",
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
]
```text

#### POST /user-certifications/my-certifications

Add new certification for current user.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "diving_organization_id": 1,
  "certification_level": "Open Water Diver",
  "is_active": true
}
```text

#### PUT /user-certifications/my-certifications/{certification_id}

Update certification for current user.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "diving_organization_id": 1,
  "certification_level": "Advanced Open Water Diver",
  "is_active": true
}
```text

#### PATCH /user-certifications/my-certifications/{certification_id}/toggle

Toggle certification active status.

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
{
  "message": "Certification activated successfully",
  "is_active": true
}
```text

#### DELETE /user-certifications/my-certifications/{certification_id}

Delete certification for current user.

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
{
  "message": "Certification deleted successfully"
}
```text

#### DELETE /tags/dive-sites/{dive_site_id}/tags/{tag_id} (Duplicate)

Remove tag from dive site (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

## Data Models

### User Model

```json
{
  "id": "integer",
  "username": "string (unique)",
  "email": "string (unique)",
  "password_hash": "string",
  "google_id": "string (optional)",
  "created_at": "datetime",
  "updated_at": "datetime",
  "is_admin": "boolean",
  "is_moderator": "boolean",
  "enabled": "boolean",
  "diving_certification": "string (optional)",
  "number_of_dives": "integer"
}
```text

### Dive Site Model

```json
{
  "id": "integer",
  "name": "string",
  "description": "string (optional)",
  "latitude": "float",
  "longitude": "float",
  "address": "string (optional)",
  "access_instructions": "string (optional)",
  "dive_plans": "string (optional)",
  "gas_tanks_necessary": "string (optional)",
  "difficulty_code": "string (nullable) - One of: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING, or null for unspecified",
  "difficulty_label": "string (nullable) - Human-readable label corresponding to difficulty_code",
  "marine_life": "string (optional)",
  "safety_information": "string (optional)",
  "max_depth": "float (optional)",
  "aliases": "array of alias objects (optional)",
  "country": "string (optional)",
  "region": "string (optional)",
  "view_count": "integer",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```text

### Diving Center Model

```json
{
  "id": "integer",
  "name": "string",
  "description": "string (optional)",
  "email": "string (optional)",
  "phone": "string (optional)",
  "website": "string (optional)",
  "latitude": "float",
  "longitude": "float",
  "view_count": "integer",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```text

### Tag Model

```json
{
  "id": "integer",
  "name": "string (unique)",
  "description": "string (optional)"
}
```text

### Dive Model

```json
{
  "id": "integer",
  "user_id": "integer",
  "dive_site_id": "integer (optional)",
  "diving_center_id": "integer (optional)",
  "dive_information": "string (optional)",
  "max_depth": "decimal (optional)",
  "average_depth": "decimal (optional)",
  "gas_bottles_used": "string (optional)",
  "suit_type": "enum (wet_suit, dry_suit, shortie)",
  "difficulty_code": "string (nullable) - One of: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING, or null for unspecified",
  "difficulty_label": "string (nullable) - Human-readable label corresponding to difficulty_code",
  "visibility_rating": "integer (1-10, optional)",
  "user_rating": "integer (1-10, optional)",
  "dive_date": "date",
  "dive_time": "time (optional)",
  "duration": "integer (minutes, optional)",
  "created_at": "datetime",
  "updated_at": "datetime",
  "dive_site": "object (optional)",
  "diving_center": "object (optional)",
  "media": "array",
  "tags": "array",
  "user_username": "string"
}
```text

### Dive Media Model

```json
{
  "id": "integer",
  "dive_id": "integer",
  "media_type": "enum (photo, video, dive_plan, external_link)",
  "url": "string",
  "description": "string (optional)",
  "title": "string (optional)",
  "thumbnail_url": "string (optional)", // UI thumbnail toggle removed; field remains for image references
  "created_at": "datetime"
}
```text

### Dive Tag Model

```json
{
  "id": "integer",
  "dive_id": "integer",
  "tag_id": "integer",
  "created_at": "datetime"
}
```text

### Newsletter Model

```json
{
  "id": "integer",
  "content": "string",
  "received_at": "datetime"
}
```text

### Parsed Dive Trip Model

```json
{
  "id": "integer",
  "diving_center_id": "integer (optional)",
  "trip_date": "date",
  "trip_time": "time (optional)",
  "trip_duration": "integer (optional)",
  "trip_difficulty_code": "string (nullable) - One of: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING, or null for unspecified",
  "trip_difficulty_label": "string (nullable) - Human-readable label corresponding to trip_difficulty_code",
  "trip_price": "decimal (optional)",
  "trip_currency": "string (3 chars, default: EUR)",
  "group_size_limit": "integer (optional)",
  "current_bookings": "integer (default: 0)",
  "trip_description": "string (optional)",
  "special_requirements": "string (optional)",
  "trip_status": "enum (scheduled, confirmed, cancelled, completed)",
  "source_newsletter_id": "integer (optional)",
  "extracted_at": "datetime",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```text

### Parsed Dive Model

```json
{
  "id": "integer",
  "trip_id": "integer",
  "dive_site_id": "integer (optional)",
  "dive_number": "integer",
  "dive_time": "time (optional)",
  "dive_duration": "integer (optional)",
  "dive_description": "string (optional)",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```text

## Rate Limiting

The API implements comprehensive rate limiting to prevent abuse and ensure fair
usage. The rate limiting system includes special exemptions for localhost
requests and admin users.

### Rate Limits by Endpoint

| Endpoint Category | Rate Limit | Description |
|------------------|------------|-------------|
| **Dive Sites** | 150/minute | GET requests for dive site listings |
| **Dive Site Details** | 300/minute | GET requests for individual dive sites |
| **Dive Site Creation** | 15/minute | POST requests to create dive sites |
| **Dive Site Updates** | 30/minute | PUT requests to update dive sites |
| **Dive Site Deletion** | 15/minute | DELETE requests for dive sites |
| **Dive Site Ratings** | 15/minute | POST requests to rate dive sites |
| **Dive Site Comments** | 8/minute | POST requests to create comments |
| **Dive Site Media** | 30/minute | POST/DELETE requests for media |
| **Diving Centers** | 15/minute | POST requests for diving center operations |
| **User Registration** | 8/minute | POST requests for user registration |
| **User Login** | 30/minute | POST requests for authentication |
| **Google OAuth** | 30/minute | POST requests for Google authentication |

### Rate Limiting Exemptions

#### Localhost Requests

Requests from localhost IP addresses are exempt from rate limiting:

- `127.0.0.1` (IPv4 localhost)
- `::1` (IPv6 localhost)
- `localhost` (hostname)

This exemption facilitates development and testing.

#### Admin Users

Users with `is_admin=True` are exempt from rate limiting on **authenticated
endpoints**. This allows administrators to perform bulk operations without being
blocked.

**Note**: Admin exemptions only apply to endpoints that require authentication.
Public endpoints like `/register` and `/login` still apply rate limiting to all
users for security reasons.

### Rate Limit Headers

```text
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640995200
```text

### Rate Limit Response

```json
{
  "detail": "Rate limit exceeded",
  "error_code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 60
}
```text

### Rate Limiting Implementation

The rate limiting system uses a custom decorator `@skip_rate_limit_for_admin()`
that:

1. **Checks for localhost requests** and skips rate limiting
2. **Extracts and verifies JWT tokens** for admin user detection
3. **Queries the database** to check if the user has admin privileges
4. **Falls back to normal rate limiting** if neither condition is met

This ensures robust protection while allowing legitimate administrative
operations.

### Frontend Rate Limiting Error Handling

The frontend implements comprehensive error handling for rate limiting responses
to provide a better user experience when API rate limits are exceeded.

#### **Frontend Error Handling Components**

- **API Interceptor**: Automatically detects 429 responses and marks them as
  rate-limited
- **RateLimitError Component**: User-friendly error display with countdown timer
  and retry button
- **Rate Limit Handler Utility**: Centralized error handling with toast
  notifications
- **Component Integration**: Consistent error handling across all React
  components

#### **Frontend Error Handling Flow**

1. **API Call Fails** → 429 response received from backend
2. **API Interceptor** → Marks error as rate-limited, extracts retry-after time
3. **Component useEffect** → Detects rate-limited error, shows toast
notification
4. **UI Rendering** → Shows RateLimitError component with countdown
5. **User Experience** → Clear message, countdown timer, retry option after
timeout

#### **Frontend Implementation Files**

- **API Interceptor**: `frontend/src/api.js` -
  Response interceptor for 429 handling
- **Error Component**: `frontend/src/components/RateLimitError.js` -
  Visual error display
- **Utility Function**: `frontend/src/utils/rateLimitHandler.js` -
  Centralized error handling
- **Component Usage**: `frontend/src/pages/DiveSites.js`,
  `frontend/src/pages/DiveTrips.js`

#### **Frontend User Experience Features**

- **Immediate Feedback**: Toast notification appears telling user about rate
  limiting
- **Visual Error Display**: RateLimitError component shows with:
  - Clear explanation of what happened
  - Countdown timer showing when user can retry
  - Retry button (appears after countdown)
- **Consistent Experience**: Same error handling across all components
- **User Guidance**: Clear instructions on what to do next

#### **Frontend Testing**

```bash
# Check frontend container logs for ESLint errors
docker logs divemap_frontend --tail 20

# Run ESLint on rate limiting error handling files
docker exec divemap_frontend npm run lint -- src/components/RateLimitError.js
docker exec divemap_frontend npm run lint -- src/pages/DiveSites.js

# Test rate limiting error handling
# Navigate to /dive-sites and trigger rate limiting (if possible)
# Verify RateLimitError component displays correctly
```text

## Examples

### Complete Authentication Flow

```bash
# 1. Register a new user
curl -X POST "https://divemap-backend.fly.dev/api/v1/auth/register" \
     -H "Content-Type: application/json" \
     -d '{
       "username": "newuser",
       "email": "user@example.com",
       "password": "SecurePassword123!"
     }'

# 2. Login to get JWT token
curl -X POST "https://divemap-backend.fly.dev/api/v1/auth/login" \
     -H "Content-Type: application/json" \
     -d '{
       "username": "newuser",
       "password": "SecurePassword123!"
     }'

# 3. Use token for authenticated requests
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     "https://divemap-backend.fly.dev/api/v1/users/me"
```text

### Creating a Dive Site

```bash
# Create dive site (admin/moderator only)
curl -X POST "https://divemap-backend.fly.dev/api/v1/dive-sites/" \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Great Barrier Reef",
       "description": "World-famous coral reef system",
       "latitude": -16.5,
       "longitude": 145.5,
       "difficulty_code": "ADVANCED_OPEN_WATER",
    "difficulty_label": "Advanced Open Water",
       "country": "Australia",
       "region": "Queensland"
     }'
```text

### Rating a Dive Site

```bash
# Rate a dive site
curl -X POST "https://divemap-backend.fly.dev/api/v1/dive-sites/1/rate" \
     -H "Authorization: Bearer USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "rating": 9,
       "comment": "Amazing dive site with incredible marine life!"
     }'
```text

### Searching Dive Sites

```bash
# Search dive sites with specific difficulty code (exclude_unspecified_difficulty is irrelevant here)
curl
"https://divemap-backend.fly.dev/api/v1/dive-sites/?search=coral&difficulty_code=ADVANCED_OPEN_WATER&country=Australia"

# Get all dive sites (includes unspecified difficulty by default - parameter not needed)
curl
"https://divemap-backend.fly.dev/api/v1/dive-sites/?search=coral&country=Australia"

# Get all dive sites excluding those with unspecified difficulty (explicit exclusion)
curl
"https://divemap-backend.fly.dev/api/v1/dive-sites/?search=coral&exclude_unspecified_difficulty=true&country=Australia"
```text

### Managing Tags

```bash
# Create a new tag
curl -X POST "https://divemap-backend.fly.dev/api/v1/tags/" \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "wreck",
       "description": "Shipwreck dive sites"
     }'

# Add tag to dive site
curl -X POST "https://divemap-backend.fly.dev/api/v1/tags/dive-sites/1/tags" \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "tag_id": 1
     }'
```text

### Managing Diving Organizations

```bash
# Get all diving organizations
curl "https://divemap-backend.fly.dev/api/v1/diving-organizations/"

# Create a new diving organization (admin only)
curl -X POST "https://divemap-backend.fly.dev/api/v1/diving-organizations/" \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Professional Association of Diving Instructors",
       "acronym": "PADI",
       "website": "https://www.padi.com",
       "description": "World-leading scuba diver training organization",
       "country": "United States",
       "founded_year": 1966
     }'

# Update a diving organization (admin only)
curl -X PUT "https://divemap-backend.fly.dev/api/v1/diving-organizations/1" \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "description": "Updated description"
     }'

# Delete a diving organization (admin only)
curl -X DELETE "https://divemap-backend.fly.dev/api/v1/diving-organizations/1" \
     -H "Authorization: Bearer ADMIN_TOKEN"
```text

### Managing User Certifications

```bash
# Get user's certifications
curl -H "Authorization: Bearer USER_TOKEN" \
    
"https://divemap-backend.fly.dev/api/v1/user-certifications/my-certifications"

# Get public certifications for a user
curl
"https://divemap-backend.fly.dev/api/v1/user-certifications/users/1/certifications"

# Add a new certification
curl -X POST
"https://divemap-backend.fly.dev/api/v1/user-certifications/my-certifications" \
     -H "Authorization: Bearer USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "diving_organization_id": 1,
       "certification_level": "Open Water Diver",
       "is_active": true
     }'

# Update a certification
curl -X PUT
"https://divemap-backend.fly.dev/api/v1/user-certifications/my-certifications/1"
\
     -H "Authorization: Bearer USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "certification_level": "Advanced Open Water Diver",
       "is_active": true
     }'

# Toggle certification active status
curl -X PATCH
"https://divemap-backend.fly.dev/api/v1/user-certifications/my-certifications/1/toggle"
\
     -H "Authorization: Bearer USER_TOKEN"

# Delete a certification
curl -X DELETE
"https://divemap-backend.fly.dev/api/v1/user-certifications/my-certifications/1"
\
     -H "Authorization: Bearer USER_TOKEN"
```text

### Managing Dives

The dive system allows users to log their diving experiences with comprehensive
details including media uploads, tags, and statistics. Dives can be associated
with both dive sites and diving centers, providing a complete record of the
diving experience.

#### Dive-Diving Center Relationship

Dives can be associated with diving centers to track which diving center
organized or facilitated the dive. This relationship is optional and can be:

- **Added**: When creating or updating a dive, include `diving_center_id`
- **Changed**: Update the `diving_center_id` to a different diving center
- **Removed**: Set `diving_center_id` to `null`

The API response includes both the diving center ID and the full diving center
object with details like name, description, contact information, and location.

### Dive Endpoints

#### GET /dives/count

Get total count of dives matching filters.

**Headers:** `Authorization: Bearer <token>` (optional for public dives)

**Query Parameters:**

- `user_id`: Filter by specific user ID
- `my_dives`: Filter to show only current user's dives (boolean, requires authentication)
- `dive_site_id`: Filter by dive site ID
- `dive_site_name`: Filter by dive site name (partial match)
- `difficulty_code`: Filter by difficulty code (OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING)
- `exclude_unspecified_difficulty`: Exclude dives with unspecified difficulty (boolean, default: false)
- `suit_type`: Filter by suit type (wet_suit, dry_suit, shortie)
- `min_depth`: Minimum dive depth
- `max_depth`: Maximum dive depth
- `min_visibility`: Minimum visibility rating (1-10)
- `max_visibility`: Maximum visibility rating (1-10)
- `min_rating`: Minimum user rating (1-10)
- `max_rating`: Maximum user rating (1-10)
- `start_date`: Start date filter (YYYY-MM-DD)
- `end_date`: End date filter (YYYY-MM-DD)
- `tag_ids`: Comma-separated tag IDs

**Response:**

```json
{
  "total": 42
}
```text

#### GET /dives/

Get dives with comprehensive sorting and filtering.

**Headers:** `Authorization: Bearer <token>` (optional for public dives)

**Query Parameters:**

- `page`: Page number (1-based, default: 1)
- `page_size`: Page size (1, 5, 25, 50, 100, or 1000, default: 25)
- `user_id`: Filter by specific user ID
- `my_dives`: Filter to show only current user's dives (boolean, requires authentication)
- `dive_site_id`: Filter by dive site ID
- `dive_site_name`: Filter by dive site name (partial match)
- `search`: Unified search across dive site name, description, notes
- `difficulty_code`: Filter by difficulty code (OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING)
- `exclude_unspecified_difficulty`: Exclude dives with unspecified difficulty (boolean, default: false)
- `suit_type`: Filter by suit type (wet_suit, dry_suit, shortie)
- `min_depth`: Minimum dive depth
- `max_depth`: Maximum dive depth
- `min_visibility`: Minimum visibility rating (1-10)
- `max_visibility`: Maximum visibility rating (1-10)
- `min_rating`: Minimum user rating (1-10)
- `max_rating`: Maximum user rating (1-10)
- `start_date`: Start date filter (YYYY-MM-DD)
- `end_date`: End date filter (YYYY-MM-DD)
- `tag_ids`: Comma-separated tag IDs
- `sort_by`: Sort field (dive_date, max_depth, duration, difficulty_level, visibility_rating, user_rating, created_at, updated_at). Admin users can also sort by view_count. Note: `difficulty_level` sorting uses order_index from the difficulty_levels lookup table.
- `sort_order`: Sort order (asc, desc, default: desc)

**Response:**

```json
[
  {
    "id": 1,
    "user_id": 1,
    "dive_site_id": 1,
    "dive_date": "2024-01-15",
    "max_depth": 25.5,
    "difficulty_code": "ADVANCED_OPEN_WATER",
    "difficulty_label": "Advanced Open Water",
    "visibility_rating": 8,
    "user_rating": 9
  }
]
```text

#### GET /dives/{dive_id}

Get a specific dive by ID.

**Headers:** `Authorization: Bearer <token>` (required for private dives)

**Response:** See Dive Model below

#### POST /dives/

Create a new dive.

**Headers:** `Authorization: Bearer <token>` (required)

**Request Body:**

```json
{
  "dive_date": "2024-01-15",
  "dive_site_id": 1,
  "diving_center_id": 1,
  "max_depth": 25.5,
  "difficulty_code": "ADVANCED_OPEN_WATER",
  "visibility_rating": 8,
  "user_rating": 9
}
```text

**Note:** `difficulty_code` can be one of: `OPEN_WATER`, `ADVANCED_OPEN_WATER`, `DEEP_NITROX`, `TECHNICAL_DIVING`, or `null` for unspecified.

#### PUT /dives/{dive_id}

Update a dive.

**Headers:** `Authorization: Bearer <token>` (required)

**Request Body:** Same format as POST (all fields optional)

#### DELETE /dives/{dive_id}

Delete a dive.

**Headers:** `Authorization: Bearer <token>` (required)

**Response:**

```json
{
  "message": "Dive deleted successfully"
}
```text

#### Dive Endpoints (Examples)

```bash
# Get total count of dives
curl -H "Authorization: Bearer USER_TOKEN" \
     "https://divemap-backend.fly.dev/api/v1/dives/count"

# Get all dives for the authenticated user (alphabetically sorted)
curl -H "Authorization: Bearer USER_TOKEN" \
     "https://divemap-backend.fly.dev/api/v1/dives/?page=1&page_size=25"

# Get only current user's dives
curl -H "Authorization: Bearer USER_TOKEN" \
    
"https://divemap-backend.fly.dev/api/v1/dives/?my_dives=true&page=1&page_size=25"

# Get a specific dive
curl -H "Authorization: Bearer USER_TOKEN" \
     "https://divemap-backend.fly.dev/api/v1/dives/1"

# Create a new dive
curl -X POST "https://divemap-backend.fly.dev/api/v1/dives/" \
     -H "Authorization: Bearer USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "dive_date": "2024-01-15",
       "dive_site_id": 1,
       "diving_center_id": 1,
       "max_depth": 25.5,
       "average_depth": 18.0,
       "dive_information": "Amazing dive with lots of marine life",
       "suit_type": "wet_suit",
       "difficulty_code": "ADVANCED_OPEN_WATER",
    "difficulty_label": "Advanced Open Water",
       "visibility_rating": 8,
       "user_rating": 9,
       "duration": 60
     }'

# Update a dive
curl -X PUT "https://divemap-backend.fly.dev/api/v1/dives/1" \
     -H "Authorization: Bearer USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "max_depth": 28.0,
       "visibility_rating": 9,
       "dive_information": "Updated dive information"
     }'

# Update dive to add/change diving center
curl -X PUT "https://divemap-backend.fly.dev/api/v1/dives/1" \
     -H "Authorization: Bearer USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "diving_center_id": 2
     }'

# Remove diving center from dive
curl -X PUT "https://divemap-backend.fly.dev/api/v1/dives/1" \
     -H "Authorization: Bearer USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "diving_center_id": null
     }'

# Delete a dive
curl -X DELETE "https://divemap-backend.fly.dev/api/v1/dives/1" \
     -H "Authorization: Bearer USER_TOKEN"
```text

#### Dive Media Management

```bash
# Add media to a dive
curl -X POST "https://divemap-backend.fly.dev/api/v1/dives/1/media" \
     -H "Authorization: Bearer USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "media_type": "photo",
       "url": "https://example.com/photo.jpg",
       "description": "Underwater photo from the dive"
     }'

# Get all media for a dive
curl -H "Authorization: Bearer USER_TOKEN" \
     "https://divemap-backend.fly.dev/api/v1/dives/1/media"

# Delete media from a dive
curl -X DELETE "https://divemap-backend.fly.dev/api/v1/dives/1/media/1" \
     -H "Authorization: Bearer USER_TOKEN"
```text

#### Dive Tags

```bash
# Add a tag to a dive
curl -X POST "https://divemap-backend.fly.dev/api/v1/dives/1/tags" \
     -H "Authorization: Bearer USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "tag_id": 1
     }'

# Remove a tag from a dive
curl -X DELETE "https://divemap-backend.fly.dev/api/v1/dives/1/tags/1" \
     -H "Authorization: Bearer USER_TOKEN"
```text

#### Admin Dive Management

```bash
# Get all dives (admin only)
curl -H "Authorization: Bearer ADMIN_TOKEN" \
     "https://divemap-backend.fly.dev/api/v1/admin/dives"

# Update any dive (admin only)
curl -X PUT "https://divemap-backend.fly.dev/api/v1/admin/dives/1" \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "dive_information": "Admin updated dive information"
     }'

# Delete any dive (admin only)
curl -X DELETE "https://divemap-backend.fly.dev/api/v1/admin/dives/1" \
     -H "Authorization: Bearer ADMIN_TOKEN"
```text

#### Dive Search and Filtering

```bash
# Search dives with specific difficulty code (exclude_unspecified_difficulty is irrelevant here)
curl -H "Authorization: Bearer USER_TOKEN" \
    
"https://divemap-backend.fly.dev/api/v1/dives/?dive_site_name=coral&min_depth=20&max_depth=30&difficulty_code=ADVANCED_OPEN_WATER&page=1&page_size=25"

# Get all dives (includes unspecified difficulty by default - parameter not needed)
curl -H "Authorization: Bearer USER_TOKEN" \
    
"https://divemap-backend.fly.dev/api/v1/dives/?page=1&page_size=25"

# Get all dives excluding those with unspecified difficulty (explicit exclusion)
curl -H "Authorization: Bearer USER_TOKEN" \
    
"https://divemap-backend.fly.dev/api/v1/dives/?exclude_unspecified_difficulty=true&page=1&page_size=25"

# Search with date range (alphabetically sorted)
curl -H "Authorization: Bearer USER_TOKEN" \
    
"https://divemap-backend.fly.dev/api/v1/dives/?start_date=2024-01-01&end_date=2024-01-31&page=1&page_size=25"
```text

### Newsletter Management Endpoints

The newsletter system provides comprehensive functionality for uploading,
parsing, and managing dive trip information from newsletter files. The system
supports both OpenAI-powered parsing and basic regex parsing.

#### GET /newsletters/

Get all newsletters (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

**Query Parameters:**

- `limit`: Number of records to return (default: 50)
- `offset`: Number of records to skip (default: 0)

**Response:**

```json
[
  {
    "id": 1,
    "content": "Newsletter content...",
    "received_at": "2024-01-15T10:30:00Z",
    "trips_count": 3
  }
]
```text

#### GET /newsletters/{newsletter_id}

Get specific newsletter by ID (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

**Response:**

```json
{
  "id": 1,
  "content": "Newsletter content...",
  "received_at": "2024-01-15T10:30:00Z",
  "trips_count": 3
}
```text

#### PUT /newsletters/{newsletter_id}

Update newsletter content (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:**

```json
{
  "content": "Updated newsletter content..."
}
```text

#### DELETE /newsletters/{newsletter_id}

Delete newsletter and all associated trips (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

**Response:**

```json
{
  "message": "Newsletter and 3 associated trips deleted successfully"
}
```text

#### DELETE /newsletters/

Mass delete multiple newsletters (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:**

```json
{
  "newsletter_ids": [1, 2, 3]
}
```text

**Response:**

```json
{
  "deleted_count": 3,
  "message": "Deleted 3 newsletters and 8 associated trips"
}
```text

#### POST /newsletters/upload

Upload and parse newsletter (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:** `multipart/form-data`

- `file`: Newsletter file (required, .txt format)
- `use_openai`: Boolean to use OpenAI parsing (default: true)

**Response:**

```json
{
  "newsletter_id": 1,
  "trips_created": 3,
  "message": "Newsletter uploaded and parsed successfully"
}
```text

#### POST /newsletters/{newsletter_id}/reparse

Re-parse existing newsletter (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:** `multipart/form-data`

- `use_openai`: Boolean to use OpenAI parsing (default: true)

**Response:**

```json
{
  "newsletter_id": 1,
  "trips_created": 3,
  "message": "Newsletter re-parsed successfully. 2 old trips deleted, 3 new
trips created."
}
```text

#### GET /newsletters/trips

Get parsed dive trips with advanced search, filtering, and sorting (registered
users only).

**Headers:** `Authorization: Bearer <user_token>`

**Query Parameters:**

- `search`: Full-text search across trip descriptions, special requirements,
  diving center names, dive site names, and dive descriptions
- `location`: Location-based search filtering by country, region, and address
- `min_duration`: Minimum trip duration in minutes
- `max_duration`: Maximum trip duration in minutes
- `difficulty_code`: Filter by difficulty code (OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING)
- `exclude_unspecified_difficulty`: Exclude trips with unspecified difficulty (boolean, default: false)
- `sort_by`: Sort field (trip_date, trip_price, trip_duration,
  difficulty_level, popularity, distance, created_at). Note: `difficulty_level` sorting uses order_index from the difficulty_levels lookup table.
- `sort_order`: Sort order (asc, desc, default: desc)
- `user_lat`: User latitude for distance calculations (required for distance
  sorting)
- `user_lon`: User longitude for distance calculations (required for distance
  sorting)
- `skip`: Number of records to skip for pagination
- `limit`: Maximum number of records to return
- `start_date`: Filter by start date (YYYY-MM-DD)
- `end_date`: Filter by end date (YYYY-MM-DD)
- `diving_center_id`: Filter by diving center ID
- `dive_site_id`: Filter by dive site ID
- `trip_status`: Filter by trip status (scheduled, confirmed, cancelled,
  completed)

**Note:** `popularity` sorting requires admin privileges.

**Response:**

```json
[
  {
    "id": 1,
    "diving_center_id": 1,
    "trip_date": "2024-02-15",
    "trip_time": "09:00:00",
    "trip_duration": 240,
    "trip_difficulty_code": "ADVANCED_OPEN_WATER",
    "trip_difficulty_label": "Advanced Open Water",
    "trip_price": 150.00,
    "trip_currency": "EUR",
    "group_size_limit": 8,
    "current_bookings": 3,
    "trip_description": "Multi-dive trip to coral reefs",
    "special_requirements": "Advanced certification required",
    "trip_status": "scheduled",
    "diving_center_name": "Coral Dive Center",
    "newsletter_content": "Newsletter content with trip details...",
    "dives": [
      {
        "id": 1,
        "trip_id": 1,
        "dive_site_id": 1,
        "dive_number": 1,
        "dive_time": "09:30:00",
        "dive_duration": 45,
        "dive_description": "First dive at shallow reef",
        "dive_site_name": "Coral Garden",
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z"
      }
    ],
    "extracted_at": "2024-01-15T10:30:00Z",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
]
```text

#### GET /newsletters/trips/{trip_id}

Get specific parsed dive trip (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

**Response:** Same format as GET /newsletters/trips

#### POST /newsletters/trips

Create new parsed dive trip (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:**

```json
{
  "diving_center_id": 1,
  "trip_date": "2024-02-15",
  "trip_time": "09:00:00",
  "trip_duration": 240,
  "trip_difficulty_code": "ADVANCED_OPEN_WATER",
  "trip_difficulty_label": "Advanced Open Water",
  "trip_price": 150.00,
  "trip_currency": "EUR",
  "group_size_limit": 8,
  "current_bookings": 0,
  "trip_description": "Multi-dive trip to coral reefs",
  "special_requirements": "Advanced certification required",
  "trip_status": "scheduled",
  "dives": [
    {
      "dive_site_id": 1,
      "dive_number": 1,
      "dive_time": "09:30:00",
      "dive_duration": 45,
      "dive_description": "First dive at shallow reef"
    }
  ]
}
```text

#### PUT /newsletters/trips/{trip_id}

Update parsed dive trip (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:** Same format as POST /newsletters/trips

#### DELETE /newsletters/trips/{trip_id}

Delete parsed dive trip (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

**Response:**

```json
{
  "message": "Trip deleted successfully"
}
```text

#### Newsletter Management Examples

```bash
# Upload newsletter
curl -X POST "https://divemap-backend.fly.dev/api/v1/newsletters/upload" \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -F "file=@newsletter.txt" \
     -F "use_openai=true"

# Re-parse newsletter
curl -X POST "https://divemap-backend.fly.dev/api/v1/newsletters/1/reparse" \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -F "use_openai=true"

# Get all trips
curl -H "Authorization: Bearer ADMIN_TOKEN" \
     "https://divemap-backend.fly.dev/api/v1/newsletters/trips"

# Create new trip
curl -X POST "https://divemap-backend.fly.dev/api/v1/newsletters/trips" \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "diving_center_id": 1,
       "trip_date": "2024-02-15",
       "trip_duration": 240,
       "trip_status": "scheduled",
       "dives": [
         {
           "dive_site_id": 1,
           "dive_number": 1,
           "dive_duration": 45,
           "dive_description": "First dive"
         }
       ]
     }'

# Update trip
curl -X PUT "https://divemap-backend.fly.dev/api/v1/newsletters/trips/1" \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "trip_status": "confirmed",
       "current_bookings": 5
     }'

# Delete trip
curl -X DELETE "https://divemap-backend.fly.dev/api/v1/newsletters/trips/1" \
     -H "Authorization: Bearer ADMIN_TOKEN"
```text

### System Management Endpoints

#### GET /admin/system/overview

Get comprehensive system overview with platform statistics and health metrics
(admin only).

**Headers:** `Authorization: Bearer <admin_token>`

**Response:**

```json
{
  "platform_stats": {
    "total_users": 150,
    "active_users_30d": 45,
    "new_users_7d": 12,
    "new_users_30d": 38,
    "user_growth_rate": 15.2,
    "total_dive_sites": 74,
    "total_diving_centers": 23,
    "total_dives": 156,
    "total_ratings": 89,
    "total_comments": 67
  },
  "system_health": {
    "database_status": "healthy",
    "database_response_time": 45,
    "cpu_usage": 23.5,
    "memory_usage": 67.2,
    "disk_usage": 45.8
  },
  "geographic_distribution": {
    "countries": 12,
    "regions": 28
  }
}
```text

#### GET /admin/system/health

Get detailed system health information (admin only).

**Headers:** `Authorization: Bearer <admin_token>`

**Response:**

```json
{
  "database": {
    "status": "healthy",
    "response_time_ms": 45,
    "connection_pool": "active"
  },
  "application": {
    "uptime_seconds": 86400,
    "memory_usage_mb": 256,
    "cpu_usage_percent": 23.5
  },
  "resources": {
    "disk_usage_percent": 45.8,
    "available_memory_mb": 1024
  }
}
```text

#### GET /admin/system/activity

Get recent system activity with filtering options (admin only).

**Headers:** `Authorization: Bearer <admin_token>`

**Query Parameters:**

- `time_range`: Filter by time range (hour, 6hours, day, week, month)
- `activity_type`: Filter by activity type (registrations, content, engagement)

**Response:**

```json
{
  "activity_stats": {
    "total_activities": 156,
    "user_registrations": 23,
    "content_creation": 89,
    "user_engagement": 44
  },
  "recent_activities": [
    {
      "id": 1,
      "activity_type": "user_registration",
      "description": "New user 'diver123' registered",
      "timestamp": "2024-01-15T10:30:00Z",
      "user_id": 45,
      "username": "diver123"
    }
  ]
}
```text

#### GET /admin/system/client-ip

Debug endpoint to display client IP detection information (admin only).

**Headers:** `Authorization: Bearer <admin_token>`

**Response:**

```json
{
  "detected_ip": "203.0.113.1",
  "headers": {
    "x-forwarded-for": "203.0.113.1, 10.0.0.1",
    "x-real-ip": "203.0.113.1",
    "cf-connecting-ip": "203.0.113.1"
  },
  "connection_info": {
    "client_host": "203.0.113.1",
    "is_localhost": false,
    "is_private": false
  }
}
```text

## Conclusion

This API documentation provides comprehensive information for integrating with
the Divemap application. The API is designed to be:

1. **RESTful**: Following standard REST conventions
2. **Secure**: Comprehensive authentication and authorization
3. **Well-documented**: Auto-generated OpenAPI documentation
4. **Scalable**: Rate limiting and performance optimization
5. **User-friendly**: Clear error messages and validation

For interactive API documentation, visit: <https://divemap-backend.fly.dev/docs>
