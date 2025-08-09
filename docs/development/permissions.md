# User Permissions and Access Control

This document outlines the different permission levels and capabilities for users, moderators, and administrators in the Divemap application.

## Permission Levels Overview

The application has three main permission levels:

1. **Regular User** - Basic authenticated user with limited privileges
2. **Moderator** - Elevated privileges for content moderation and management
3. **Admin** - Full system access and administrative capabilities

## Permission Comparison Table

| Feature/Action | Regular User | Moderator | Admin |
|----------------|--------------|-----------|-------|
| **Authentication** |
| Register account | ✅ | ✅ | ✅ |
| Login/Logout | ✅ | ✅ | ✅ |
| Google OAuth login | ✅ | ✅ | ✅ |
| Change own password | ✅ | ✅ | ✅ |
| View own profile | ✅ | ✅ | ✅ |
| Update own profile | ✅ | ✅ | ✅ |
| View public user profiles | ✅ | ✅ | ✅ |
| **User Management** |
| View all users | ❌ | ✅ | ✅ |
| Create new users | ❌ | ❌ | ✅ |
| Update any user | ❌ | ❌ | ✅ |
| Delete users | ❌ | ❌ | ✅ |
| Enable/disable users | ❌ | ❌ | ✅ |
| **Dive Sites** |
| View dive sites | ✅ | ✅ | ✅ |
| View dive site details | ✅ | ✅ | ✅ |
| Create dive sites | ✅ | ✅ | ✅ |
| Edit own dive sites | ✅ | ✅ | ✅ |
| Edit any dive site | ❌ | ✅ | ✅ |
| Delete own dive sites | ✅ | ✅ | ✅ |
| Delete any dive site | ❌ | ✅ | ✅ |
| Add media to dive sites | ✅ | ✅ | ✅ |
| Delete media from dive sites | ✅ | ✅ | ✅ |
| Rate dive sites | ✅ | ✅ | ✅ |
| Comment on dive sites | ✅ | ✅ | ✅ |
| Manage dive site aliases | ❌ | ✅ | ✅ |
| **Diving Centers** |
| View diving centers | ✅ | ✅ | ✅ |
| View diving center details | ✅ | ✅ | ✅ |
| Create diving centers | ✅ | ✅ | ✅ |
| Edit own diving centers | ✅ | ✅ | ✅ |
| Edit any diving center | ❌ | ✅ | ✅ |
| Delete own diving centers | ✅ | ✅ | ✅ |
| Delete any diving center | ❌ | ✅ | ✅ |
| Rate diving centers | ✅ | ✅ | ✅ |
| Comment on diving centers | ✅ | ✅ | ✅ |
| Manage gear rental costs | ✅ | ✅ | ✅ |
| Manage organization affiliations | ✅ | ✅ | ✅ |
| Claim diving center ownership | ✅ | ✅ | ✅ |
| Approve ownership requests | ❌ | ✅ | ✅ |
| **Dives** |
| View public dives | ✅ | ✅ | ✅ |
| View private dives | Own only | Own only | All |
| Create dives | ✅ | ✅ | ✅ |
| Edit own dives | ✅ | ✅ | ✅ |
| Edit any dive | ❌ | ❌ | ✅ |
| Delete own dives | ✅ | ✅ | ✅ |
| Delete any dive | ❌ | ❌ | ✅ |
| Add media to dives | ✅ | ✅ | ✅ |
| Delete media from dives | ✅ | ✅ | ✅ |
| Manage dive tags | ✅ | ✅ | ✅ |
| **Tags** |
| View all tags | ✅ | ✅ | ✅ |
| Create new tags | ❌ | ✅ | ✅ |
| Update tags | ❌ | ✅ | ✅ |
| Delete tags | ❌ | ✅ | ✅ |
| Assign tags to dive sites | ❌ | ✅ | ✅ |
| Remove tags from dive sites | ❌ | ✅ | ✅ |
| **Diving Organizations** |
| View diving organizations | ✅ | ✅ | ✅ |
| Create diving organizations | ❌ | ✅ | ✅ |
| Update diving organizations | ❌ | ✅ | ✅ |
| Delete diving organizations | ❌ | ✅ | ✅ |
| **User Certifications** |
| View own certifications | ✅ | ✅ | ✅ |
| View other users' certifications | ❌ | ❌ | ✅ |
| Add own certifications | ✅ | ✅ | ✅ |
| Update own certifications | ✅ | ✅ | ✅ |
| Delete own certifications | ✅ | ✅ | ✅ |
| **Newsletters** |
| View newsletters | ❌ | ✅ | ✅ |
| Upload newsletters | ❌ | ✅ | ✅ |
| Update newsletters | ❌ | ✅ | ✅ |
| Delete newsletters | ❌ | ✅ | ✅ |
| View parsed dive trips | ❌ | ✅ | ✅ |
| Manage dive trips | ❌ | ✅ | ✅ |
| **System Administration** |
| Access admin panel | ❌ | ❌ | ✅ |
| View system statistics | ❌ | ❌ | ✅ |
| Manage rate limiting | ❌ | ❌ | ✅ |
| Bypass rate limiting | ❌ | ❌ | ✅ |
| **Content Moderation** |
| Moderate comments | ❌ | ✅ | ✅ |
| Moderate ratings | ❌ | ✅ | ✅ |
| Moderate user-generated content | ❌ | ✅ | ✅ |
| **Data Management** |
| Export data | ❌ | ❌ | ✅ |
| Import data | ❌ | ❌ | ✅ |
| Backup/restore data | ❌ | ❌ | ✅ |

## Permission Inheritance

- **Admins** have all permissions that moderators and regular users have
- **Moderators** have all permissions that regular users have, plus content moderation capabilities
- **Regular users** have basic authenticated user permissions

## Permission Enforcement

### Backend Enforcement

Permissions are enforced at the API level using dependency injection:

```python
# Admin-only endpoints
@router.get("/admin/users")
async def list_all_users(
    current_user: User = Depends(get_current_admin_user)
):
    # Only admins can access this endpoint
    pass

# Admin or moderator endpoints
@router.post("/tags")
async def create_tag(
    current_user: User = Depends(is_admin_or_moderator)
):
    # Both admins and moderators can access this endpoint
    pass

# Regular authenticated user endpoints
@router.post("/dives")
async def create_dive(
    current_user: User = Depends(get_current_active_user)
):
    # Any authenticated user can access this endpoint
    pass
```

### Frontend Enforcement

Permissions are enforced at the component level:

```javascript
// Admin-only routes
<Route
  path="/admin"
  element={
    <ProtectedRoute requireAdmin={true}>
      <Admin />
    </ProtectedRoute>
  }
/>

// Admin/moderator or owner routes
<Route
  path="/dive-sites/:id/edit"
  element={
    <ProtectedEditRoute>
      <EditDiveSite />
    </ProtectedEditRoute>
  }
/>
```

## Permission Checks

### Authentication Functions

- `get_current_user()` - Basic authentication check
- `get_current_active_user()` - Ensures user account is enabled
- `get_current_admin_user()` - Ensures user is admin
- `get_current_moderator_user()` - Ensures user is admin or moderator
- `is_admin_or_moderator()` - Alternative check for admin/moderator permissions

### User Model Fields

```python
class User(Base):
    is_admin = Column(Boolean, default=False)
    is_moderator = Column(Boolean, default=False)
    enabled = Column(Boolean, default=True)
```

## Security Considerations

1. **Backend Validation**: All permissions are validated on the backend, never trust frontend-only checks
2. **Rate Limiting**: Admins can bypass rate limiting for administrative tasks
3. **Ownership Checks**: Users can only modify content they own, unless they have elevated permissions
4. **Account Status**: Disabled accounts cannot access any protected endpoints
5. **Token Validation**: All API requests require valid JWT tokens

## Best Practices

1. Always use the appropriate permission check function for each endpoint
2. Test permission boundaries thoroughly
3. Log administrative actions for audit purposes
4. Implement proper error messages for permission denials
5. Use the principle of least privilege - only grant necessary permissions

## Recent Permission Changes

### Version 1.1 - Enhanced Moderator Permissions

The following permission changes were implemented to provide moderators with enhanced content management capabilities:

#### 1. Diving Center Management
- **Moderators can now approve ownership requests** - Previously admin-only
- **Moderators can assign diving center owners** - Previously admin-only

#### 2. Diving Organizations Management
- **Moderators can create diving organizations** - Previously admin-only
- **Moderators can update diving organizations** - Previously admin-only
- **Moderators can delete diving organizations** - Previously admin-only

#### 3. Newsletter and Trip Management
- **Moderators can upload newsletters** - Previously admin-only
- **Moderators can update newsletters** - Previously admin-only
- **Moderators can delete newsletters** - Previously admin-only
- **Moderators can manage dive trips** - Previously admin-only

#### 4. User Management
- **Moderators can view all users** - Previously admin-only

## Related Documentation

- [Authentication System](./auth.md)
- [API Documentation](./api.md)
- [Security Guidelines](../security/README.md)
