# Database Connectivity Check

## Overview

The backend container now includes a robust database connectivity check during startup to ensure the database is available before starting the application.

## Implementation Details

### Netcat Version
- Uses `netcat-openbsd` instead of `netcat-traditional`
- Provides better IPv6 support required for fly.io deployment
- Includes timeout handling to prevent hanging connections

### Optimized Dependencies
- Uses `--only-binary=all` to install only pre-compiled wheels
- Removed `gcc` and `default-libmysqlclient-dev` dependencies
- Faster build times and smaller container size

### Retry Logic
- **Maximum attempts**: 10 retries
- **Random sleep**: 1-5 seconds between attempts
- **Timeout**: 5 seconds per connection attempt
- **Error handling**: Exits with error code 1 if all attempts fail

### Startup Script Features
- Uses `set -e` for strict error handling
- Visual indicators (emojis) for better log readability
- Proper error redirection to suppress netcat error messages
- IPv6-compatible connection testing
- Proper script file instead of echo-generated script

## Testing

You can test the netcat IPv6 support using the included test script:

```bash
# Inside the container
./test_netcat_ipv6.sh

# Or from host
docker exec divemap_backend ./test_netcat_ipv6.sh
```

## Log Output Example

```
Waiting for database to be ready...
Attempt 1/10: Checking database connectivity...
❌ Database not ready yet. Attempt 1/10 failed.
⏳ Waiting 3 seconds before next attempt...
Attempt 2/10: Checking database connectivity...
✅ Database is ready!
🚀 Starting application...
```

## Fly.io Compatibility

The implementation is specifically designed for fly.io deployment:
- IPv6 support for network connectivity
- Random sleep intervals to prevent thundering herd
- Proper error handling for container orchestration
- Timeout handling for network delays

## Troubleshooting

If the database connectivity check fails:

1. **Check database service**: Ensure the database container is running
2. **Check network**: Verify the database hostname is resolvable
3. **Check ports**: Ensure port 3306 is accessible
4. **Check logs**: Review container logs for detailed error messages

## Configuration

The database host and port are configured in the startup script:
- **Host**: `db` (Docker service name)
- **Port**: `3306` (MySQL default port)
- **Timeout**: `5` seconds per attempt
- **Max attempts**: `10` retries

## File Structure

The startup script is now properly organized as a separate file:
- **Script**: `backend/startup.sh` - Main startup script with database connectivity check
- **Test**: `backend/test_netcat_ipv6.sh` - Test script for netcat IPv6 support
- **Dockerfile**: `backend/Dockerfile` - Copies and makes scripts executable 