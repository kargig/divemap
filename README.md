# Divemap - Scuba Dive Site & Center Review Platform

A comprehensive web application for scuba diving enthusiasts to discover, rate, and review dive sites and diving centers.

## Features

- **User Management**: Registration, authentication, and user profiles
- **Dive Sites**: Browse, search, rate, and comment on dive sites
- **Diving Centers**: Discover diving centers with pricing and associated dive sites
- **Interactive Map**: Visualize dive sites and centers on an interactive map
- **Admin Dashboard**: Manage dive sites, centers, and media content
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
- Node.js (for local development)
- Python 3.11+ (for local development)

### Running Tests
```bash
# Backend tests
docker-compose exec backend python -m pytest

# Frontend tests
docker-compose exec frontend npm test
```

### Database
The application uses MySQL for data storage. The database is automatically initialized with sample data when the containers start.

## API Endpoints

- `GET /api/v1/dive-sites` - List dive sites
- `GET /api/v1/diving-centers` - List diving centers
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration

See the full API documentation at http://localhost:8000/docs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License. 