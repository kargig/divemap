# Divemap - Scuba Dive Site & Center Review Platform

A comprehensive web application for scuba diving enthusiasts to discover, rate, and review dive sites and diving centers.

## Features

- **User Management**: Registration, authentication, and user profiles
- **Dive Sites**: Browse, search, rate, and comment on dive sites with comprehensive details
- **Diving Centers**: Discover diving centers with pricing, gear rental costs, and associated dive sites
- **Interactive Map**: Visualize dive sites and centers on an interactive map with toggle controls
- **Admin Dashboard**: Manage dive sites, centers, media content, and gear rental costs
- **Edit Functionality**: Admin/moderator users can edit dive sites and diving centers
- **Media Management**: Upload and manage photos and videos for dive sites
- **Responsive Design**: Works on desktop and mobile devices

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

### Core Endpoints
- `GET /api/v1/dive-sites` - List dive sites
- `GET /api/v1/diving-centers` - List diving centers
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration

### Admin Endpoints
- `POST /api/v1/dive-sites` - Create dive site (admin only)
- `PUT /api/v1/dive-sites/{id}` - Update dive site (admin only)
- `DELETE /api/v1/dive-sites/{id}` - Delete dive site (admin only)
- `POST /api/v1/diving-centers` - Create diving center (admin only)
- `PUT /api/v1/diving-centers/{id}` - Update diving center (admin only)
- `DELETE /api/v1/diving-centers/{id}` - Delete diving center (admin only)

### Media and Gear Management
- `GET /api/v1/dive-sites/{id}/media` - Get dive site media
- `POST /api/v1/dive-sites/{id}/media` - Add media to dive site
- `DELETE /api/v1/dive-sites/{id}/media/{media_id}` - Delete media
- `GET /api/v1/diving-centers/{id}/gear-rental` - Get gear rental costs
- `POST /api/v1/diving-centers/{id}/gear-rental` - Add gear rental cost
- `DELETE /api/v1/diving-centers/{id}/gear-rental/{gear_id}` - Delete gear rental cost

See the full API documentation at http://localhost:8000/docs

## Recent Enhancements

### Testing Infrastructure
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