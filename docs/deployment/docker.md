# Docker Setup

This document provides essential Docker information for the Divemap application.

## Overview

The application uses three containers: frontend (React), backend (FastAPI), and database (MySQL).

## Quick Start

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

## Container Configuration

### Frontend Container
- **Port**: 3000 (dev) / 80 (prod)
- **Hot Reloading**: Enabled in development
- **Build**: Optimized for production

### Backend Container
- **Port**: 8000
- **Health Checks**: Built-in monitoring
- **Database Migrations**: Run automatically
- **IPv6 Support**: Enabled

### Database Container
- **Port**: 3306
- **Data Persistence**: Volume mounted
- **Backup Support**: Automated backups

## Development Workflow

```bash
# Hot reloading
docker-compose logs -f frontend
docker-compose logs -f backend

# Database access
docker-compose exec db mysql -u divemap_user -p divemap

# Run migrations
docker-compose exec backend python run_migrations.py

# Testing
docker-compose exec backend python -m pytest
docker-compose exec frontend npm test
```

## Production Deployment

### Environment Variables
```bash
DATABASE_URL=mysql+pymysql://prod_user:prod_password@prod-host:3306/divemap
SECRET_KEY=your-secure-secret-key
DEBUG=false

# CORS Configuration
# Comma-separated list of allowed origins
ALLOWED_ORIGINS=https://divemap.fly.dev
```

### Deployment Commands
```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Health checks
curl -f http://localhost:3000/health
curl -f http://localhost:8000/health
```

## Troubleshooting

### Common Issues

1. **Container Startup Failures**
   ```bash
   docker-compose logs [service-name]
   docker-compose ps
   ```

2. **Database Connection Issues**
   ```bash
   docker-compose logs db
   docker-compose exec backend python -c "from app.database import engine; print(engine.connect())"
   ```

3. **Frontend Build Issues**
   ```bash
   docker-compose logs frontend
   docker-compose exec frontend npm run build
   ```

### Debug Commands
```bash
# Access container shell
docker-compose exec [service-name] sh

# Check network connectivity
docker-compose exec backend ping db

# Check volume mounts
docker volume ls
```

## CORS Configuration

### Overview
CORS (Cross-Origin Resource Sharing) controls which domains can access your API. This is configured via the `ALLOWED_ORIGINS` environment variable.


### Docker Compose Setup
The `docker-compose.yml` files automatically handle CORS configuration:

```yaml
environment:
  - ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-http://localhost:3000,http://127.0.0.1:3000}
```

## Best Practices

- Use non-root users in containers
- Set appropriate resource limits
- Regular security updates
- Monitor resource usage
- Backup data regularly
