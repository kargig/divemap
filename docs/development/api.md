# API Documentation

This document provides comprehensive documentation for the Divemap API, including all endpoints, authentication methods, request/response formats, and usage examples.

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

The Divemap API is a RESTful API built with FastAPI that provides access to dive sites, diving centers, user management, and administrative functions. The API supports JSON request/response formats and includes comprehensive authentication and authorization.

### API Features

- **RESTful Design**: Standard HTTP methods and status codes
- **JSON Format**: All requests and responses use JSON
- **Authentication**: JWT-based authentication with role-based access
- **Validation**: Comprehensive input validation with Pydantic
- **Documentation**: Auto-generated OpenAPI documentation
- **Rate Limiting**: Protection against API abuse

### API Versioning

The API uses URL versioning with the current version being `v1`:

```
https://divemap-backend.fly.dev/api/v1/
```

## Authentication

### JWT Authentication

The API uses JSON Web Tokens (JWT) for authentication. Tokens are obtained through login endpoints and must be included in subsequent requests.

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
```

#### Including Tokens
```bash
# Include token in Authorization header
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://divemap-backend.fly.dev/api/v1/users/me
```

### Google OAuth

The API also supports Google OAuth authentication for enhanced security and user experience.

#### OAuth Flow
1. User authenticates with Google
2. Frontend receives Google ID token
3. Frontend sends token to backend for verification
4. Backend verifies token with Google's servers
5. Backend creates or links user account
6. Backend returns JWT token for API access

## Base URL

### Production
```
https://divemap-backend.fly.dev/api/v1/
```

### Development
```
http://localhost:8000/api/v1/
```

### API Documentation
```
https://divemap-backend.fly.dev/docs
```

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
```

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
```

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
```

#### POST /auth/login
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "username": "user",
  "password": "password"
}
```

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
```

#### POST /auth/google-login
Authenticate using Google OAuth.

**Request Body:**
```json
{
  "id_token": "google_id_token_here"
}
```

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
```

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
```

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
```

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
```

#### PUT /users/{user_id}
Update user profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "diving_certification": "PADI Advanced Open Water",
  "number_of_dives": 50
}
```

#### POST /users/me/change-password
Change user password.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "current_password": "oldpassword",
  "new_password": "NewSecurePassword123!"
}
```

### Dive Sites Endpoints

#### GET /dive-sites/count
Get total count of dive sites matching filters.

**Query Parameters:**
- `name`: Search term for dive site name
- `difficulty_level`: Filter by difficulty (beginner, intermediate, advanced, expert)
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
```

#### GET /dive-sites/
Get dive sites (alphabetically sorted).

**Query Parameters:**
- `page`: Page number (1-based, default: 1)
- `page_size`: Page size (25, 50, or 100, default: 25)
- `name`: Search term for dive site name
- `difficulty_level`: Filter by difficulty (beginner, intermediate, advanced, expert)
- `country`: Filter by country
- `region`: Filter by region
- `min_rating`: Minimum rating filter
- `max_rating`: Maximum rating filter
- `tag_ids`: Comma-separated tag IDs

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
    "difficulty_level": "intermediate",
    "marine_life": "Coral, fish, turtles, sharks",
    "safety_information": "Follow dive safety guidelines",
    "max_depth": 30.0,
    "alternative_names": "GBR, The Reef",
    "country": "Australia",
    "region": "Queensland",
    "view_count": 1250,
    "average_rating": 9.2,
    "tags": ["coral", "marine-life", "sharks"],
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
]
```

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
  "difficulty_level": "intermediate",
  "marine_life": "Marine life description",
  "safety_information": "Safety guidelines",
  "max_depth": 25.0,
  "alternative_names": "Alternative names",
  "country": "Australia",
  "region": "Queensland"
}
```

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
  "difficulty_level": "intermediate",
  "marine_life": "Coral, fish, turtles, sharks",
  "safety_information": "Follow dive safety guidelines",
  "max_depth": 30.0,
  "alternative_names": "GBR, The Reef",
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
```

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
```

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
```

#### POST /dive-sites/{dive_site_id}/comments
Add comment to dive site.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "content": "Great dive site with amazing marine life!"
}
```

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
```

#### GET /diving-centers/
Get all diving centers (alphabetically sorted).

**Query Parameters:**
- `page`: Page number (1-based, default: 1)
- `page_size`: Page size (25, 50, or 100, default: 25)
- `name`: Search term for diving center name
- `min_rating`: Minimum rating filter
- `max_rating`: Maximum rating filter

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
```

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
```

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
```

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
```

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
```

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
```

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
```

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
```

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
```

#### POST /tags/
Create new tag (admin/moderator only).

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:**
```json
{
  "name": "wreck",
  "description": "Shipwreck dive sites"
}
```

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
```

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
```

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
```

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
```

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
```

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
```

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
```

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
```

#### PATCH /user-certifications/my-certifications/{certification_id}/toggle
Toggle certification active status.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "message": "Certification activated successfully",
  "is_active": true
}
```

#### DELETE /user-certifications/my-certifications/{certification_id}
Delete certification for current user.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "message": "Certification deleted successfully"
}
```

#### DELETE /tags/dive-sites/{dive_site_id}/tags/{tag_id}
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
```

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
  "difficulty_level": "enum (beginner, intermediate, advanced, expert)",
  "marine_life": "string (optional)",
  "safety_information": "string (optional)",
  "max_depth": "float (optional)",
  "alternative_names": "string (optional)",
  "country": "string (optional)",
  "region": "string (optional)",
  "view_count": "integer",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

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
```

### Tag Model
```json
{
  "id": "integer",
  "name": "string (unique)",
  "description": "string (optional)"
}
```

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
  "difficulty_level": "enum (beginner, intermediate, advanced, expert)",
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
```

### Dive Media Model
```json
{
  "id": "integer",
  "dive_id": "integer",
  "media_type": "enum (photo, video, dive_plan, external_link)",
  "url": "string",
  "description": "string (optional)",
  "title": "string (optional)",
  "thumbnail_url": "string (optional)",
  "created_at": "datetime"
}
```

### Dive Tag Model
```json
{
  "id": "integer",
  "dive_id": "integer",
  "tag_id": "integer",
  "created_at": "datetime"
}
```

## Rate Limiting

The API implements comprehensive rate limiting to prevent abuse and ensure fair usage. The rate limiting system includes special exemptions for localhost requests and admin users.

### Rate Limits by Endpoint

| Endpoint Category | Rate Limit | Description |
|------------------|------------|-------------|
| **Dive Sites** | 100/minute | GET requests for dive site listings |
| **Dive Site Details** | 200/minute | GET requests for individual dive sites |
| **Dive Site Creation** | 10/minute | POST requests to create dive sites |
| **Dive Site Updates** | 20/minute | PUT requests to update dive sites |
| **Dive Site Deletion** | 10/minute | DELETE requests for dive sites |
| **Dive Site Ratings** | 10/minute | POST requests to rate dive sites |
| **Dive Site Comments** | 5/minute | POST requests to create comments |
| **Dive Site Media** | 20/minute | POST/DELETE requests for media |
| **Diving Centers** | 10/minute | POST requests for diving center operations |
| **User Registration** | 5/minute | POST requests for user registration |
| **User Login** | 10/minute | POST requests for authentication |
| **Google OAuth** | 10/minute | POST requests for Google authentication |

### Rate Limiting Exemptions

#### Localhost Requests
Requests from localhost IP addresses are exempt from rate limiting:
- `127.0.0.1` (IPv4 localhost)
- `::1` (IPv6 localhost)
- `localhost` (hostname)

This exemption facilitates development and testing.

#### Admin Users
Users with `is_admin=True` are exempt from rate limiting on **authenticated endpoints**. This allows administrators to perform bulk operations without being blocked.

**Note**: Admin exemptions only apply to endpoints that require authentication. Public endpoints like `/register` and `/login` still apply rate limiting to all users for security reasons.

### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640995200
```

### Rate Limit Response
```json
{
  "detail": "Rate limit exceeded",
  "error_code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 60
}
```

### Rate Limiting Implementation

The rate limiting system uses a custom decorator `@skip_rate_limit_for_admin()` that:

1. **Checks for localhost requests** and skips rate limiting
2. **Extracts and verifies JWT tokens** for admin user detection
3. **Queries the database** to check if the user has admin privileges
4. **Falls back to normal rate limiting** if neither condition is met

This ensures robust protection while allowing legitimate administrative operations.

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
```

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
       "difficulty_level": "intermediate",
       "country": "Australia",
       "region": "Queensland"
     }'
```

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
```

### Searching Dive Sites

```bash
# Search dive sites with filters
curl "https://divemap-backend.fly.dev/api/v1/dive-sites/?search=coral&difficulty_level=intermediate&country=Australia"
```

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
```

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
```

### Managing User Certifications

```bash
# Get user's certifications
curl -H "Authorization: Bearer USER_TOKEN" \
     "https://divemap-backend.fly.dev/api/v1/user-certifications/my-certifications"

# Get public certifications for a user
curl "https://divemap-backend.fly.dev/api/v1/user-certifications/users/1/certifications"

# Add a new certification
curl -X POST "https://divemap-backend.fly.dev/api/v1/user-certifications/my-certifications" \
     -H "Authorization: Bearer USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "diving_organization_id": 1,
       "certification_level": "Open Water Diver",
       "is_active": true
     }'

# Update a certification
curl -X PUT "https://divemap-backend.fly.dev/api/v1/user-certifications/my-certifications/1" \
     -H "Authorization: Bearer USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "certification_level": "Advanced Open Water Diver",
       "is_active": true
     }'

# Toggle certification active status
curl -X PATCH "https://divemap-backend.fly.dev/api/v1/user-certifications/my-certifications/1/toggle" \
     -H "Authorization: Bearer USER_TOKEN"

# Delete a certification
curl -X DELETE "https://divemap-backend.fly.dev/api/v1/user-certifications/my-certifications/1" \
     -H "Authorization: Bearer USER_TOKEN"
```

### Managing Dives

The dive system allows users to log their diving experiences with comprehensive details including media uploads, tags, and statistics. Dives can be associated with both dive sites and diving centers, providing a complete record of the diving experience.

#### Dive-Diving Center Relationship

Dives can be associated with diving centers to track which diving center organized or facilitated the dive. This relationship is optional and can be:

- **Added**: When creating or updating a dive, include `diving_center_id`
- **Changed**: Update the `diving_center_id` to a different diving center
- **Removed**: Set `diving_center_id` to `null`

The API response includes both the diving center ID and the full diving center object with details like name, description, contact information, and location.

#### Dive Endpoints

```bash
# Get total count of dives
curl -H "Authorization: Bearer USER_TOKEN" \
     "https://divemap-backend.fly.dev/api/v1/dives/count"

# Get all dives for the authenticated user (alphabetically sorted)
curl -H "Authorization: Bearer USER_TOKEN" \
     "https://divemap-backend.fly.dev/api/v1/dives/?page=1&page_size=25"

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
       "difficulty_level": "intermediate",
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
```

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
```

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
```

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
```

#### Dive Search and Filtering

```bash
# Search dives with filters (alphabetically sorted)
curl -H "Authorization: Bearer USER_TOKEN" \
     "https://divemap-backend.fly.dev/api/v1/dives/?dive_site_name=coral&min_depth=20&max_depth=30&difficulty_level=intermediate&page=1&page_size=25"

# Search with date range (alphabetically sorted)
curl -H "Authorization: Bearer USER_TOKEN" \
     "https://divemap-backend.fly.dev/api/v1/dives/?start_date=2024-01-01&end_date=2024-01-31&page=1&page_size=25"
```

## Conclusion

This API documentation provides comprehensive information for integrating with the Divemap application. The API is designed to be:

1. **RESTful**: Following standard REST conventions
2. **Secure**: Comprehensive authentication and authorization
3. **Well-documented**: Auto-generated OpenAPI documentation
4. **Scalable**: Rate limiting and performance optimization
5. **User-friendly**: Clear error messages and validation

For interactive API documentation, visit: https://divemap-backend.fly.dev/docs 