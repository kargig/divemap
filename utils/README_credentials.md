# Utility Scripts Credentials Configuration

All utility scripts in this directory now support environment variables for credentials configuration, making them more secure and flexible.

## Environment Variables

### Required Variables

- `ADMIN_USER` - Admin username (default: `admin`)
- `ADMIN_PASS` - Admin password (**REQUIRED** - no working default)
- `TEST_USER` - Test user username (default: `securitytest`)
- `TEST_PASS` - Test user password (default: `SecurityTest123!`)
- `BASE_URL` - Base URL for API calls (default: `http://localhost`)

**⚠️ IMPORTANT**: The default admin password (`admin123`) will NOT work. You must set the correct admin password via the `ADMIN_PASS` environment variable.

### Usage Examples

#### Using Environment Variables (RECOMMENDED)
```bash
# Set the correct admin password (get from your system administrator or local_testme file)
export ADMIN_PASS="your_actual_admin_password"

# Scripts will use the correct credentials
./utils/validation_test.sh
./utils/security_test_simple.sh
./utils/performance_test_comprehensive.sh
```

**Note**: Scripts will fail if you don't set `ADMIN_PASS` because the default password is not valid.

#### Using Custom Credentials
```bash
# Set environment variables
export ADMIN_USER="myadmin"
export ADMIN_PASS="your_secure_password"
export BASE_URL="https://my-divemap-instance.com"

# Run scripts with custom credentials
./utils/validation_test.sh
./utils/security_test_simple.sh
```

#### Inline Environment Variables
```bash
# Set variables for single command execution
ADMIN_USER="myadmin" ADMIN_PASS="your_secure_password" ./utils/validation_test.sh
```

## Scripts Updated

The following scripts have been updated to use environment variables:

- ✅ `validation_test.sh` - Schema validation and data quality testing
- ✅ `security_test_simple.sh` - Security testing and vulnerability assessment
- ✅ `performance_test_comprehensive.sh` - Performance testing with 1000+ routes
- ✅ `e2e_routes.sh` - E2E testing helper (already had env var support)
- ✅ `e2e_permissions.sh` - Permission testing
- ✅ `focused_performance_test.sh` - Focused performance testing
- ✅ `performance_test_routes.sh` - Performance testing script

## Security Benefits

1. **No Hardcoded Passwords**: Scripts no longer contain hardcoded credentials
2. **Environment Flexibility**: Different credentials for different environments
3. **CI/CD Integration**: Easy integration with CI/CD pipelines using environment variables
4. **Production Safety**: Safe to use in production environments with proper credential management

## Fallback Behavior

If environment variables are not set, scripts will use the following defaults:
- `ADMIN_USER=admin`
- `ADMIN_PASS=admin123` (**⚠️ This default will NOT work - you must set the correct password**)
- `TEST_USER=securitytest`
- `TEST_PASS=SecurityTest123!`
- `BASE_URL=http://localhost`

## Production Recommendations

For production environments, always set environment variables explicitly:

```bash
# Example production configuration
export ADMIN_USER="production_admin"
export ADMIN_PASS="$(cat /secure/path/to/admin_password.txt)"
export BASE_URL="https://divemap.yourdomain.com"
```

**Security Best Practices:**
- Never put real passwords in documentation or code
- Use secure credential management systems in production
- Never rely on default passwords in production environments
- Store passwords in secure files or environment management systems
