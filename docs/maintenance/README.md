# Maintenance Overview

This document provides comprehensive information about maintaining the Divemap application, including regular maintenance tasks, troubleshooting procedures, and operational guidelines.

## Table of Contents

1. [Overview](#overview)
2. [Regular Maintenance Tasks](#regular-maintenance-tasks)
3. [Database Maintenance](#database-maintenance)
4. [Application Maintenance](#application-maintenance)
5. [Infrastructure Maintenance](#infrastructure-maintenance)
6. [Security Maintenance](#security-maintenance)
7. [Monitoring and Alerts](#monitoring-and-alerts)
8. [Troubleshooting](#troubleshooting)

## Overview

Regular maintenance is essential for ensuring the reliability, security, and performance of the Divemap application. This document outlines the maintenance procedures and schedules for different components of the system.

### Maintenance Objectives

- **Reliability**: Ensure consistent application availability
- **Performance**: Maintain optimal application performance
- **Security**: Keep the application secure against threats
- **Data Integrity**: Protect and maintain data quality
- **Compliance**: Meet operational and regulatory requirements

### Maintenance Schedule

| Task | Frequency | Priority | Owner |
|------|-----------|----------|-------|
| Security Updates | Weekly | High | DevOps |
| Database Backups | Daily | High | DevOps |
| Performance Monitoring | Daily | Medium | DevOps |
| Log Analysis | Weekly | Medium | DevOps |
| Dependency Updates | Monthly | Medium | Development |
| Infrastructure Review | Quarterly | Low | DevOps |

## Regular Maintenance Tasks

### Daily Tasks

#### 1. Health Checks
```bash
# Check application health
curl -f https://divemap.fly.dev/health
curl -f https://divemap-backend.fly.dev/health

# Check service status
fly status

# Check database connectivity
fly ssh console -C "mysql -u divemap_user -p divemap -e 'SELECT 1'"
```

#### 2. Backup Verification
```bash
# Verify backup completion
ls -la /backups/

# Test backup integrity
mysql -u root -p < /backups/latest_backup.sql
```

#### 3. Log Review
```bash
# Check application logs
fly logs

# Check error rates
grep -i error /var/log/application.log | wc -l

# Check performance metrics
curl https://divemap.fly.dev/metrics
```

### Weekly Tasks

#### 1. Security Updates
```bash
# Update dependencies
pip install --upgrade -r requirements.txt
npm update

# Check for security vulnerabilities
npm audit
safety check
```

#### 2. Performance Analysis
```bash
# Analyze slow queries
fly ssh console -a divemap-db -C "mysql -u divemap_user -p -e 'SHOW PROCESSLIST'"

# Check resource usage
fly status

# Analyze response times
curl -w "@curl-format.txt" -o /dev/null -s https://divemap.fly.dev/
```

#### 3. Log Analysis
```bash
# Analyze error patterns
fly logs | grep -i error | wc -l

# Check for unusual activity
fly logs | grep -i "failed login" | wc -l

# Monitor API usage
fly logs | grep -i "rate limit" | wc -l
```

### Monthly Tasks

#### 1. Dependency Updates
```bash
# Update Python dependencies
cd backend
source divemap_venv/bin/activate
pip install --upgrade -r requirements.txt

# Update Node.js dependencies
cd frontend
npm update
npm audit fix
```

#### 2. Database Optimization
```bash
# Analyze database performance
fly ssh console -a divemap-db -C "mysql -u root -p -e 'SHOW TABLE STATUS'"

# Check for unused indexes
fly ssh console -a divemap-db -C "mysql -u root -p -e 'SELECT * FROM information_schema.statistics'"
```

#### 3. Security Review
```bash
# Review access logs
fly logs | grep -i "unauthorized"

# Check for suspicious activity
fly logs | grep -i "failed"

# Review security headers
curl -I https://divemap.fly.dev/
```

## Database Maintenance

### Backup Procedures

#### Daily Backups
```bash
# Create database backup
fly ssh console -a divemap-db -C "mysqldump -u root -p divemap > /backups/divemap_$(date +%Y%m%d).sql"

# Verify backup integrity
fly ssh console -a divemap-db -C "mysql -u root -p -e 'SELECT COUNT(*) FROM dive_sites'"
```

#### Backup Retention
- **Daily backups**: Keep for 7 days
- **Weekly backups**: Keep for 4 weeks
- **Monthly backups**: Keep for 12 months

### Migration Management

#### Check Migration Status
```bash
# Check current migration
fly ssh console -a divemap-backend -C "alembic current"

# List all migrations
fly ssh console -a divemap-backend -C "alembic history"
```

#### Run Migrations
```bash
# Run pending migrations
fly ssh console -a divemap-backend -C "python run_migrations.py"

# Check migration status
fly ssh console -a divemap-backend -C "alembic current"
```

### Performance Optimization

#### Query Optimization
```bash
# Check slow queries
fly ssh console -a divemap-db -C "mysql -u root -p -e 'SHOW PROCESSLIST'"

# Analyze query performance
fly ssh console -a divemap-db -C "mysql -u root -p -e 'EXPLAIN SELECT * FROM dive_sites WHERE name LIKE \"%test%\"'"
```

#### Index Management
```bash
# Check index usage
fly ssh console -a divemap-db -C "mysql -u root -p -e 'SHOW INDEX FROM dive_sites'"

# Analyze index efficiency
fly ssh console -a divemap-db -C "mysql -u root -p -e 'SELECT * FROM information_schema.statistics WHERE table_name = \"dive_sites\"'"
```

## Application Maintenance

### Code Updates

#### Backend Updates
```bash
# Update backend code
git pull origin main

# Install new dependencies
cd backend
source divemap_venv/bin/activate
pip install -r requirements.txt

# Run tests
python -m pytest tests/ -v

# Deploy updates
fly deploy -a divemap-backend
```

#### Frontend Updates
```bash
# Update frontend code
cd frontend
npm install

# Run tests
npm test

# Build for production
npm run build

# Deploy updates
fly deploy -a divemap
```

### Configuration Management

#### Environment Variables
```bash
# List current secrets
fly secrets list -a divemap-backend

# Update secrets
fly secrets set NEW_SECRET=value -a divemap-backend

# Remove secrets
fly secrets unset OLD_SECRET -a divemap-backend
```

#### Configuration Files
```bash
# Update configuration
fly deploy -a divemap-backend

# Check configuration
fly ssh console -a divemap-backend -C "cat /app/config.py"
```

## Infrastructure Maintenance

### Container Management

#### Container Health
```bash
# Check container status
fly status

# Restart containers
fly restart -a divemap
fly restart -a divemap-backend
fly restart -a divemap-db
```

#### Resource Monitoring
```bash
# Check resource usage
fly status

# Monitor memory usage
fly ssh console -C "free -h"

# Check disk space
fly ssh console -C "df -h"
```

### Network Maintenance

#### SSL Certificate Management
```bash
# Check SSL certificate status
curl -I https://divemap.fly.dev/

# Verify certificate expiration
openssl s_client -connect divemap.fly.dev:443 -servername divemap.fly.dev
```

#### DNS Management
```bash
# Check DNS resolution
nslookup divemap.fly.dev

# Verify DNS propagation
dig divemap.fly.dev
```

## Security Maintenance

### Vulnerability Scanning

#### Dependency Scanning
```bash
# Scan Python dependencies
cd backend
source divemap_venv/bin/activate
safety check

# Scan Node.js dependencies
cd frontend
npm audit
```

#### Application Scanning
```bash
# Check for common vulnerabilities
curl -X POST https://divemap-backend.fly.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrong"}'
```

### Access Control

#### User Management
```bash
# Review user accounts
fly ssh console -a divemap-backend -C "mysql -u divemap_user -p divemap -e 'SELECT username, email, role, is_active FROM users'"

# Disable inactive users
fly ssh console -a divemap-backend -C "mysql -u divemap_user -p divemap -e 'UPDATE users SET is_active = 0 WHERE last_login < DATE_SUB(NOW(), INTERVAL 90 DAY)'"
```

#### Authentication Review
```bash
# Check failed login attempts
fly logs -a divemap-backend | grep -i "failed login"

# Review authentication logs
fly logs -a divemap-backend | grep -i "unauthorized"
```

## Monitoring and Alerts

### Health Monitoring

#### Application Health
```bash
# Monitor application health
curl -f https://divemap.fly.dev/health

# Check API endpoints
curl -f https://divemap-backend.fly.dev/health

# Monitor response times
curl -w "@curl-format.txt" -o /dev/null -s https://divemap.fly.dev/
```

#### Database Health
```bash
# Check database connectivity
fly ssh console -C "mysql -u divemap_user -p divemap -e 'SELECT 1'"

# Monitor database performance
fly ssh console -a divemap-db -C "mysql -u root -p -e 'SHOW PROCESSLIST'"
```

### Alert Configuration

#### Error Alerts
```bash
# Monitor error rates
fly logs | grep -i error | wc -l

# Check for critical errors
fly logs | grep -i "critical\|fatal\|panic"
```

#### Performance Alerts
```bash
# Monitor response times
curl -w "Time: %{time_total}s\n" -o /dev/null -s https://divemap.fly.dev/

# Check resource usage
fly status
```

## Troubleshooting

### Quick Diagnosis

#### Health Checks
```bash
# Check application health
curl -f https://divemap.fly.dev/health
curl -f https://divemap-backend.fly.dev/health

# Check service status
fly status

# Check database connectivity
fly ssh console -C "mysql -u divemap_user -p divemap -e 'SELECT 1'"
```

### Common Issues

#### 1. Application Not Responding
```bash
# Check logs
fly logs -a divemap

# Restart application
fly restart -a divemap

# Check resources
fly status
```

#### 2. Database Connection Issues
```bash
# Check database status
fly status -a divemap-db

# Test connectivity
fly ssh console -C "mysql -u divemap_user -p divemap -e 'SELECT 1'"

# Run migrations
fly ssh console -a divemap-backend -C "python run_migrations.py"
```

#### 3. Authentication Issues
```bash
# Check authentication logs
fly logs -a divemap-backend | grep -i auth

# Test authentication
curl -X POST https://divemap-backend.fly.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

#### 4. Migration Failures
```bash
# Check migration status
fly ssh console -a divemap-backend -C "alembic current"

# Run migrations
fly ssh console -a divemap-backend -C "python run_migrations.py"

# Reset migration state
fly ssh console -a divemap-backend -C "alembic stamp head"
```

#### 5. Performance Issues
```bash
# Check database performance
fly ssh console -a divemap-db -C "mysql -u root -p -e 'SHOW PROCESSLIST'"

# Check slow queries
fly ssh console -a divemap-db -C "tail -f /var/log/mysql/slow.log"

# Monitor resource usage
fly status
```

### Debug Procedures

#### Enable Debug Logging
```bash
# Enable debug mode
fly secrets set DEBUG=true -a divemap-backend

# Check debug logs
fly logs -a divemap-backend | grep -i debug
```

#### Manual Testing
```bash
# Test API endpoints
curl -X GET https://divemap-backend.fly.dev/dive-sites
curl -X GET https://divemap-backend.fly.dev/health

# Test frontend
curl -I https://divemap.fly.dev/
```

### Recovery Procedures

#### Database Recovery
```bash
# Restore from backup
fly ssh console -a divemap-db -C "mysql -u root -p divemap < /backups/divemap_backup.sql"

# Verify restoration
fly ssh console -a divemap-db -C "mysql -u divemap_user -p divemap -e 'SELECT COUNT(*) FROM dive_sites'"
```

#### Application Recovery
```bash
# Restart all services
fly restart -a divemap
fly restart -a divemap-backend
fly restart -a divemap-db

# Verify recovery
curl -f https://divemap.fly.dev/health
```

## Maintenance Checklist

### Daily
- [ ] Health checks
- [ ] Backup verification
- [ ] Log review
- [ ] Error monitoring

### Weekly
- [ ] Security updates
- [ ] Performance analysis
- [ ] Log analysis
- [ ] Dependency checks

### Monthly
- [ ] Dependency updates
- [ ] Database optimization
- [ ] Security review
- [ ] Infrastructure review

### Quarterly
- [ ] Comprehensive security audit
- [ ] Performance optimization
- [ ] Backup strategy review
- [ ] Disaster recovery testing

## Support

For maintenance issues:
1. Check this troubleshooting guide
2. Review logs for specific errors
3. Test manual procedures
4. Contact development team
5. Escalate to infrastructure team

## Conclusion

Regular maintenance ensures the Divemap application remains reliable, secure, and performant. Following these procedures helps prevent issues and maintain high availability. 