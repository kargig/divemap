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

#### GET /dive-sites/
Get all dive sites.

**Query Parameters:**
- `skip`: Number of records to skip (default: 0)
- `limit`: Number of records to return (default: 100)
- `search`: Search term for name or description
- `difficulty_level`: Filter by difficulty (beginner, intermediate, advanced, expert)
- `country`: Filter by country
- `region`: Filter by region
- `min_depth`: Minimum depth filter
- `max_depth`: Maximum depth filter

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

#### GET /diving-centers/
Get all diving centers.

**Query Parameters:**
- `skip`: Number of records to skip (default: 0)
- `limit`: Number of records to return (default: 100)
- `search`: Search term for name or description
- `country`: Filter by country
- `region`: Filter by region

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

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **General Endpoints**: 60 requests per minute per IP
- **Authentication Endpoints**: 10 requests per minute per IP
- **Admin Endpoints**: 30 requests per minute per IP

### Rate Limit Headers
```
X-RateLimit-Limit: 60
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

## Conclusion

This API documentation provides comprehensive information for integrating with the Divemap application. The API is designed to be:

1. **RESTful**: Following standard REST conventions
2. **Secure**: Comprehensive authentication and authorization
3. **Well-documented**: Auto-generated OpenAPI documentation
4. **Scalable**: Rate limiting and performance optimization
5. **User-friendly**: Clear error messages and validation

For interactive API documentation, visit: https://divemap-backend.fly.dev/docs 