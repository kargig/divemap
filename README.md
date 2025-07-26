# Divemap - Scuba Dive Site & Center Review Platform

A comprehensive web application for scuba diving enthusiasts to discover, rate, and review dive sites and diving centers.

## Features

- **User Management**: Registration, login, and profile management
- **Dive Sites**: Comprehensive CRUD operations with detailed information
- **Diving Centers**: Full management with gear rental costs and dive site associations
- **Rating System**: Rate dive sites and diving centers (1-10 scale)
- **Comments**: User comments on dive sites and diving centers
- **Interactive Map**: View dive sites and diving centers on an interactive map
- **Search & Filtering**: Advanced search and filtering capabilities
- **Media Management**: Upload and display photos and videos for dive sites
- **Gear Rental**: Manage diving center gear rental costs
- **Tag System**: Comprehensive tag/label management for dive sites
- **Admin Dashboard**: Full administrative interface for content management

## Tech Stack

### Frontend
- **React** - UI framework
- **React Router DOM** - Client-side routing
- **React Query** - Data fetching and caching
- **React Hook Form** - Form handling
- **React Hot Toast** - Notifications
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **OpenLayers** - Interactive maps
- **Axios** - HTTP client

### Backend
- **Python** - Programming language
- **FastAPI** - Web framework
- **SQLAlchemy** - ORM
- **Pydantic** - Data validation
- **JWT** - Authentication
- **MySQL** - Database
- **Docker** - Containerization

### Testing
- **Pytest** - Backend testing framework
- **Node.js** - Frontend validation scripts
- **Automated Testing** - Regression prevention and data type validation

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd divemap
   ```

2. **Start the application**
   ```bash
   docker-compose up -d
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

4. **Default admin credentials**
   - Username: `admin`
   - Password: `admin123`

## Development

### Prerequisites
- Docker and Docker Compose
- Node.js (for local development and testing)
- Python 3.11+ (for local development)

### Running Tests
```bash
# Backend tests
docker-compose exec backend python -m pytest

# Frontend validation
node validate_frontend.js

# Regression testing
node test_regressions.js
```

### Testing Infrastructure

The project includes comprehensive testing infrastructure:

- **Backend Tests**: Pytest suite with fixtures for isolated testing
- **Frontend Validation**: Automated scripts for API health checks
- **Regression Testing**: Prevention of common frontend errors
- **Data Type Safety**: Validation of API response types

### Database
The application uses MySQL for data storage. The database is automatically initialized with sample data when the containers start.

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/me` - Get current user info

### Users
- `GET /api/v1/users/` - Get all users (admin only)
- `GET /api/v1/users/{user_id}` - Get user by ID
- `PUT /api/v1/users/{user_id}` - Update user profile

### Dive Sites
- `GET /api/v1/dive-sites/` - Get all dive sites
- `POST /api/v1/dive-sites/` - Create dive site (admin/moderator)
- `GET /api/v1/dive-sites/{id}` - Get dive site by ID
- `PUT /api/v1/dive-sites/{id}` - Update dive site (admin/moderator)
- `DELETE /api/v1/dive-sites/{id}` - Delete dive site (admin/moderator)
- `POST /api/v1/dive-sites/{id}/rate` - Rate dive site
- `GET /api/v1/dive-sites/{id}/comments` - Get dive site comments
- `POST /api/v1/dive-sites/{id}/comments` - Add comment to dive site

### Diving Centers
- `GET /api/v1/diving-centers/` - Get all diving centers
- `POST /api/v1/diving-centers/` - Create diving center (admin/moderator)
- `GET /api/v1/diving-centers/{id}` - Get diving center by ID
- `PUT /api/v1/diving-centers/{id}` - Update diving center (admin/moderator)
- `DELETE /api/v1/diving-centers/{id}` - Delete diving center (admin/moderator)
- `POST /api/v1/diving-centers/{id}/rate` - Rate diving center
- `GET /api/v1/diving-centers/{id}/comments` - Get diving center comments
- `POST /api/v1/diving-centers/{id}/comments` - Add comment to diving center

### Media Management
- `GET /api/v1/dive-sites/{id}/media` - Get dive site media
- `POST /api/v1/dive-sites/{id}/media` - Upload media to dive site
- `DELETE /api/v1/dive-sites/{id}/media/{media_id}` - Delete dive site media

### Gear Rental Management
- `GET /api/v1/diving-centers/{id}/gear-rental` - Get diving center gear rental costs
- `POST /api/v1/diving-centers/{id}/gear-rental` - Add gear rental cost
- `PUT /api/v1/diving-centers/{id}/gear-rental/{gear_id}` - Update gear rental cost
- `DELETE /api/v1/diving-centers/{id}/gear-rental/{gear_id}` - Delete gear rental cost

### Tag Management
- `GET /api/v1/tags/` - Get all available tags
- `POST /api/v1/tags/` - Create new tag (admin/moderator)
- `PUT /api/v1/tags/{tag_id}` - Update tag (admin/moderator)
- `DELETE /api/v1/tags/{tag_id}` - Delete tag (admin/moderator)
- `POST /api/v1/tags/dive-sites/{dive_site_id}/tags` - Add tag to dive site
- `DELETE /api/v1/tags/dive-sites/{dive_site_id}/tags/{tag_id}` - Remove tag from dive site

See the full API documentation at http://localhost:8000/docs

## Recent Enhancements

### **Map UI and Zoom Management**
- **Zoom Level Debugging**: Real-time zoom level indicator for optimal map configuration
- **Smart Zoom Behavior**: Keeps zoom 5 levels before maximum for better context
- **Map Counter Positioning**: Moved to bottom-left for improved UX
- **Configurable Max Zoom**: Set to level 18 for optimal detail without excessive zoom
- **Map Fit Optimization**: Different zoom behavior for single vs multiple site selection

### **Testing Infrastructure**
- ✅ Comprehensive backend test suite with Pytest
- ✅ Frontend validation scripts for regression prevention
- ✅ Data type safety testing and validation
- ✅ Automated testing for common frontend errors

### User Experience Improvements
- ✅ Rating display changed from stars to numeric format (X.X/10)
- ✅ Enhanced dive site details with comprehensive information
- ✅ Improved search and filtering with parameter validation
- ✅ Better error handling and loading states

### Admin Functionality
- ✅ Comprehensive edit forms for dive sites and diving centers
- ✅ Media management for dive sites
- ✅ Gear rental cost management for diving centers
- ✅ Protected routes for admin/moderator users

### Data Type Safety
- ✅ Fixed latitude/longitude type conversion issues
- ✅ Improved array safety checks
- ✅ API parameter filtering to prevent 422 errors
- ✅ Comprehensive error prevention guidelines

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run the testing suite:
   ```bash
   node validate_frontend.js
   node test_regressions.js
   ```
6. Submit a pull request

## License

This project is licensed under the MIT License. 