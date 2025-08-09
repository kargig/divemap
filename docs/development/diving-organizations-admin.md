# Diving Organizations Admin Management

## Overview

The Diving Organizations Admin Management feature provides a comprehensive CRUD (Create, Read, Update, Delete) interface for managing diving certification organizations within the Divemap platform. This feature is accessible to admin users at `/admin/diving-organizations`.

## Features

### Core Functionality

- **List Organizations**: View all diving organizations with search and filtering capabilities
- **Create Organizations**: Add new diving certification organizations with detailed information
- **Edit Organizations**: Update existing organization details
- **Delete Organizations**: Remove organizations from the system
- **Bulk Operations**: Select and delete multiple organizations at once

### Organization Fields

Each diving organization includes the following fields:

- **Name** (required): Full name of the organization
- **Acronym** (required): Short code/abbreviation (e.g., PADI, SSI)
- **Website**: Official website URL
- **Logo URL**: URL to organization logo image
- **Description**: Detailed description of the organization
- **Country**: Country where the organization is based
- **Founded Year**: Year the organization was established

## User Interface

### Admin Dashboard Integration

The diving organizations management is integrated into the main admin dashboard with:

- **Card Layout**: Consistent with other admin sections
- **Icon**: Award icon to represent certification organizations
- **Color Scheme**: Indigo theme to distinguish from other sections

### Management Interface

#### Search and Filter
- Real-time search across organization names, acronyms, and countries
- Responsive search bar with clear visual feedback

#### Data Table
- **Checkbox Selection**: Select individual or all organizations
- **Organization Display**: Shows logo (or acronym fallback), name, and description
- **Key Information**: Displays acronym, country, founded year, and website link
- **Action Buttons**: Edit and delete actions for each organization

#### Modal Forms
- **Create Modal**: Comprehensive form for adding new organizations
- **Edit Modal**: Pre-populated form for updating existing organizations
- **Validation**: Client-side validation for required fields
- **Error Handling**: Clear error messages for API failures

## Technical Implementation

### Frontend Components

- **AdminDivingOrganizations.js**: Main component for the admin interface
- **React Query**: For data fetching and caching
- **React Hook Form**: For form state management
- **Toast Notifications**: For user feedback

### API Integration

The frontend integrates with the following backend endpoints:

- `GET /api/v1/diving-organizations/` - List all organizations
- `POST /api/v1/diving-organizations/` - Create new organization
- `PUT /api/v1/diving-organizations/{id}` - Update organization
- `DELETE /api/v1/diving-organizations/{id}` - Delete organization

### Data Flow

1. **Initial Load**: Fetch organizations on component mount
2. **Search**: Filter organizations based on user input
3. **Create**: Submit form data to create new organization
4. **Update**: Submit form data to update existing organization
5. **Delete**: Confirm and delete organization(s)
6. **Cache Invalidation**: Refresh data after mutations

## Security

### Access Control

- **Admin Only**: Restricted to users with `is_admin: true`
- **Route Protection**: Protected route component ensures proper access
- **API Authorization**: Backend validates admin permissions for all operations

### Data Validation

- **Frontend Validation**: Required field validation and format checking
- **Backend Validation**: Comprehensive server-side validation
- **Conflict Prevention**: Checks for duplicate names and acronyms

## Usage Examples

### Creating a New Organization

1. Navigate to `/admin/diving-organizations`
2. Click "Add Organization" button
3. Fill in required fields (Name, Acronym)
4. Optionally add additional details (Website, Logo URL, Description, Country, Founded Year)
5. Click "Create Organization"

### Editing an Organization

1. Find the organization in the table
2. Click the edit (pencil) icon
3. Modify the desired fields
4. Click "Update Organization"

### Deleting Organizations

#### Single Organization
1. Find the organization in the table
2. Click the delete (trash) icon
3. Confirm the deletion

#### Multiple Organizations
1. Select organizations using checkboxes
2. Click "Delete Selected" button
3. Confirm the bulk deletion

## Error Handling

### Common Error Scenarios

- **Network Errors**: Displayed via toast notifications
- **Validation Errors**: Field-specific error messages
- **Permission Errors**: Redirect to appropriate page
- **Duplicate Conflicts**: Clear messages for name/acronym conflicts

### User Feedback

- **Success Messages**: Confirmation for successful operations
- **Loading States**: Visual indicators during API calls
- **Error Messages**: Descriptive error text for failed operations

## Future Enhancements

### Potential Improvements

- **Organization Statistics**: Show usage statistics (certifications, centers)
- **Logo Upload**: Direct image upload functionality
- **Bulk Import**: CSV import for multiple organizations
- **Advanced Filtering**: Filter by country, founded year range
- **Export Functionality**: Export organization data
- **Audit Trail**: Track changes to organization data

### Integration Opportunities

- **Certification Management**: Link to user certification management
- **Center Affiliations**: Show which centers are affiliated with each organization
- **Analytics Dashboard**: Organization usage analytics

## Related Documentation

- [Admin Dashboard](./admin-dashboard.md)
- [User Management](./user-management.md)
- [API Documentation](./api.md)
- [Database Schema](./database.md)