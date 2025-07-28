# Getting Started

Welcome to Divemap! This guide will help you get the application up and running quickly.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Environment Setup](#environment-setup)
4. [Verification](#verification)
5. [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Docker** (version 20.10+)
- **Docker Compose** (version 2.0+)
- **Git** (for cloning the repository)

### Installing Docker

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install docker.io docker-compose
sudo usermod -aG docker $USER
sudo systemctl start docker
sudo systemctl enable docker
```

#### macOS
```bash
brew install --cask docker
```

#### Windows
Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop)

## Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd divemap
```

### 2. Set Up Environment Variables
```bash
# Copy the example environment file
cp env.example .env

# Edit the environment file with your settings
nano .env
```

**Important**: Update the following variables in your `.env` file:
- `SECRET_KEY` - Generate a secure random string
- `DATABASE_PASSWORD` - Set a strong database password
- `GOOGLE_CLIENT_ID` - Your Google OAuth client ID (optional)
- `GOOGLE_CLIENT_SECRET` - Your Google OAuth client secret (optional)

### 3. Start the Application
```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps
```

### 4. Access the Application

Once all services are running, you can access:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Database**: Accessible via Docker container

### 5. Default Credentials

- **Admin Username**: `admin`
- **Admin Password**: `ADMIN_PASSWORD`

**⚠️ Security Note**: Change these credentials immediately in production environments.

## Environment Setup

### Required Environment Variables

```bash
# Database Configuration
DATABASE_URL=mysql+pymysql://divemap_user:divemap_password@db:3306/divemap
DATABASE_PASSWORD=your_secure_password

# Application Security
SECRET_KEY=your_secure_secret_key
JWT_SECRET_KEY=your_jwt_secret_key

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Application Settings
DEBUG=false
ENVIRONMENT=production
```

### Generating Secure Keys

```bash
# Generate SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Generate JWT_SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Verification

### 1. Check Service Status
```bash
# Check all services are running
docker-compose ps

# Expected output:
# Name                    Command               State           Ports
# divemap_backend_1      python -m uvicorn ... Up      0.0.0.0:8000->8000/tcp
# divemap_db_1           docker-entrypoint.sh mysqld   Up      0.0.0.0:3306->3306/tcp
# divemap_frontend_1     npm start              Up      0.0.0.0:3000->3000/tcp
```

### 2. Test Application Health
```bash
# Test frontend
curl -f http://localhost:3000

# Test backend API
curl -f http://localhost:8000/health

# Test database connection
docker-compose exec db mysql -u divemap_user -p divemap -e "SELECT 1"
```

### 3. Verify Features
- [ ] Frontend loads at http://localhost:3000
- [ ] Backend API responds at http://localhost:8000
- [ ] API documentation available at http://localhost:8000/docs
- [ ] Database connection working
- [ ] Admin login works with default credentials

## Troubleshooting

### Common Issues

#### 1. Docker Services Not Starting
```bash
# Check Docker status
docker --version
docker-compose --version

# Restart Docker service
sudo systemctl restart docker

# Check available ports
netstat -tulpn | grep :3000
netstat -tulpn | grep :8000
```

#### 2. Database Connection Issues
```bash
# Check database container
docker-compose logs db

# Restart database
docker-compose restart db

# Check database connectivity
docker-compose exec db mysql -u root -p -e "SHOW DATABASES"
```

#### 3. Frontend Not Loading
```bash
# Check frontend logs
docker-compose logs frontend

# Restart frontend
docker-compose restart frontend

# Check Node.js dependencies
docker-compose exec frontend npm list
```

#### 4. Backend API Issues
```bash
# Check backend logs
docker-compose logs backend

# Restart backend
docker-compose restart backend

# Check Python dependencies
docker-compose exec backend pip list
```

#### 5. Environment Variable Issues
```bash
# Verify environment file
cat .env

# Check if variables are loaded
docker-compose exec backend env | grep DATABASE

# Restart with new environment
docker-compose down
docker-compose up -d
```

### Debug Mode

For detailed debugging, enable debug mode:

```bash
# Set debug environment variable
echo "DEBUG=true" >> .env

# Restart services
docker-compose down
docker-compose up -d

# Check debug logs
docker-compose logs -f
```

### Performance Issues

#### High Resource Usage
```bash
# Check resource usage
docker stats

# Monitor specific containers
docker stats divemap_frontend_1 divemap_backend_1 divemap_db_1
```

#### Slow Response Times
```bash
# Test response times
curl -w "Time: %{time_total}s\n" -o /dev/null -s http://localhost:3000
curl -w "Time: %{time_total}s\n" -o /dev/null -s http://localhost:8000/health
```

## Next Steps

### For Users
1. **Explore the Application**: Navigate through the different sections
2. **Create an Account**: Register for a user account
3. **Add Content**: Create dive sites and diving centers
4. **Use the Map**: Explore the interactive map features

### For Developers
1. **Review Development Guide**: See [Development Documentation](../development/README.md)
2. **Check API Documentation**: Visit http://localhost:8000/docs
3. **Run Tests**: Follow the testing procedures
4. **Contribute**: Review contribution guidelines

### For Administrators
1. **Security Setup**: Configure Google OAuth and security settings
2. **Production Deployment**: Follow deployment guides
3. **Monitoring**: Set up monitoring and alerting
4. **Backup Strategy**: Implement database backup procedures

## Support

If you encounter issues:

1. **Check this troubleshooting guide**
2. **Review application logs**: `docker-compose logs`
3. **Verify environment setup**: Check all prerequisites
4. **Test individual components**: Verify each service separately
5. **Check documentation**: Review development and deployment guides

For additional help, refer to:
- [Development Guide](../development/README.md) - Technical setup and development
- [Deployment Guide](../deployment/README.md) - Production deployment
- [Security Guide](../security/README.md) - Security configuration
- [Maintenance Guide](../maintenance/README.md) - Ongoing maintenance 