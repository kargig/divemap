# Infrastructure

This document provides essential infrastructure information for the Divemap application.

## Overview

The application runs on Fly.io with MySQL database, providing high availability and scalability.

## Architecture

### Components
- **Frontend**: React application (divemap.fly.dev)
- **Backend**: FastAPI application (divemap-backend.fly.dev)
- **Database**: MySQL 8.0 with persistent storage
- **Load Balancer**: Fly.io global edge network
- **SSL/TLS**: Automatic certificate management

## Fly.io Configuration

### Frontend (`frontend/fly.toml`)
```toml
app = "divemap"
primary_region = "iad"

[env]
  NODE_ENV = "production"
  REACT_APP_API_URL = "https://divemap-backend.fly.dev"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  min_machines_running = 0
```

### Backend (`backend/fly.toml`)
```toml
app = "divemap-backend"
primary_region = "iad"

[env]
  DATABASE_URL = "mysql+pymysql://divemap_user:divemap_password@divemap-db.internal:3306/divemap"
  SECRET_KEY = "your-secret-key"

[http_service]
  internal_port = 8000
  force_https = true
  min_machines_running = 1

[[http_service.checks]]
  path = "/health"
```

### Database (`database/fly.toml`)
```toml
app = "divemap-db"
primary_region = "iad"

[env]
  MYSQL_ROOT_PASSWORD = "your-root-password"
  MYSQL_DATABASE = "divemap"
  MYSQL_USER = "divemap_user"
  MYSQL_PASSWORD = "divemap_password"

[mounts]
  source = "divemap_data"
  destination = "/var/lib/mysql"
```

## Deployment

### Initial Setup
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh
fly auth login

# Create applications
fly apps create divemap
fly apps create divemap-backend
fly apps create divemap-db

# Create volume
fly volumes create divemap_data --size 10 --region iad
```

### Deploy Applications
```bash
# Deploy database
cd database && fly deploy

# Deploy backend
cd ../backend && fly deploy

# Deploy frontend
cd ../frontend && fly deploy
```

### Environment Variables
```bash
# Set secrets
fly secrets set DATABASE_URL="mysql+pymysql://user:pass@divemap-db.internal:3306/divemap" -a divemap-backend
fly secrets set SECRET_KEY="your-secure-secret-key" -a divemap-backend
```

## Monitoring

### Health Checks
```bash
# Check application health
curl -f https://divemap.fly.dev/health
curl -f https://divemap-backend.fly.dev/health

# Check service status
fly status
```

### Logs
```bash
# View logs (oneshot)
fly logs -n -a divemap-backend

# View logs (tail/follow)
fly logs -a divemap-backend

**Note**: The `-n` flag is required for oneshot commands. Without it, `fly logs` will tail the logs continuously.
```

## Security

### SSL/TLS
```bash
# Add custom domain
fly certs add divemap.com
fly certs show divemap.com
```

### Security Headers
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security: max-age=31536000
- Content-Security-Policy: default-src 'self'

## Scaling

### Auto-scaling
- Frontend: 0-1 machines (auto-stop enabled)
- Backend: 1+ machines (always running)
- Database: 1 machine (persistent)

### Manual Scaling
```bash
# Scale resources
fly scale memory 1024 -a divemap-backend
fly scale cpu 2 -a divemap-backend
```

## Troubleshooting

### Common Issues

1. **Database Connection**
   ```bash
   fly ssh console -C "mysql -u divemap_user -p divemap -e 'SELECT 1'"
   ```

2. **Application Deployment**
   ```bash
   fly logs -n -a divemap-backend
   fly status -a divemap-backend
   ```

3. **Network Issues**
   ```bash
   fly ssh console -C "ping divemap-db.internal"
   fly ssh console -C "nslookup divemap-db.internal"
   ```

### Debug Commands
```bash
# Access application shell
fly ssh console -a divemap-backend

# Check environment
fly ssh console -a divemap-backend -C "env"

# Test database connectivity
fly ssh console -a divemap-backend -C "python -c 'from app.database import engine; print(engine.connect())'"
```

## Backup

### Database Backup
```bash
# Create backup
fly ssh console -C "mysqldump -u divemap_user -p divemap > /tmp/backup.sql"

# Download backup
fly sftp shell
get /tmp/backup.sql ./backups/
```

## Performance

### Optimization
- Connection pooling for database
- Caching strategies
- Resource monitoring
- Performance tuning

### Monitoring
- Application metrics
- Database performance
- Network latency
- Resource usage