# Frontend Deployment Guide

This guide explains how to deploy the Divemap frontend to Fly.io with proper secret management.

## Prerequisites

1. Install Fly.io CLI: https://fly.io/docs/hands-on/install-flyctl/
2. Authenticate with Fly.io: `fly auth login`
3. Set up your Google OAuth credentials (see `docs/security/google-oauth-credentials.md`)

## Environment Setup

1. Copy the example environment file:
   ```bash
   cp env.example .env
   ```

2. Update `.env` with your configuration:
   ```bash
   # API Configuration
   REACT_APP_API_URL=http://localhost:8000

   # Google OAuth Configuration
   REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id_here

   # Development Settings
   REACT_APP_ENVIRONMENT=development
   ```

## Deployment Methods

### Method 1: Using the Deployment Script (Recommended)

The easiest way to deploy is using the provided deployment script:

```bash
./deploy.sh
```

This script will:
- Read the Google Client ID from your local `.env` file
- Deploy with build arguments (no secrets committed to git)
- Show deployment progress

### Method 2: Manual Deployment

If you prefer to deploy manually:

```bash
# Deploy with build argument from .env file
fly deploy -a divemap --build-arg REACT_APP_GOOGLE_CLIENT_ID="$(grep REACT_APP_GOOGLE_CLIENT_ID .env | cut -d '=' -f2)"
```

### Method 3: Using Fly.io Secrets

You can also set the secret in Fly.io and reference it:

```bash
# Set the secret (one-time setup)
fly secrets set REACT_APP_GOOGLE_CLIENT_ID="your_google_client_id" -a divemap

# Deploy with the build argument
fly deploy -a divemap --build-arg REACT_APP_GOOGLE_CLIENT_ID="your_google_client_id_here"
```

## Security Notes

- ✅ `.env` file is excluded from git (see root `.gitignore`)
- ✅ No secrets are committed to version control
- ✅ Build arguments are only available during build time
- ✅ Runtime secrets are separate from build secrets

## Troubleshooting

### Google Login Button Not Appearing

If the Google login button doesn't appear:

1. Check that `REACT_APP_GOOGLE_CLIENT_ID` is set in your `.env` file
2. Verify the deployment used build arguments correctly
3. Check browser console for JavaScript errors
4. Ensure the Google Client ID is valid and configured for your domain

### Build Failures

If the build fails:

1. Check that all required environment variables are set
2. Verify the Google Client ID format is correct
3. Check Fly.io logs: `fly logs -n -a divemap`

## Development vs Production

- **Development**: Uses local `.env` file with `REACT_APP_API_URL=http://localhost:8000`
- **Production**: Uses build secrets with `REACT_APP_API_URL=https://divemap-backend.fly.dev`

## Related Documentation

- [Google OAuth Setup](../docs/security/google-oauth-credentials.md)
- [Fly.io Deployment](../docs/deployment/fly-io.md)
- [Security Documentation](../docs/security/README.md)