#!/bin/bash

# Deploy script for Divemap frontend
# This script reads environment variables from frontend/.env and deploys with build secrets

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if an environment file was passed as an argument
if [ -n "$1" ]; then
    ENV_FILE="$1"
    echo "Using environment file: $ENV_FILE"
else
    ENV_FILE="$SCRIPT_DIR/.env"
    echo "Using default environment file: $ENV_FILE"
fi

# Check if the specified environment file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: Environment file not found: $ENV_FILE"
    exit 1
fi

# Source the environment file to get environment variables
export $(grep -v '^#' "$ENV_FILE" | xargs)

# Check if VITE_GOOGLE_CLIENT_ID is set
if [ -z "$VITE_GOOGLE_CLIENT_ID" ]; then
    echo "Error: VITE_GOOGLE_CLIENT_ID not found in .env file"
    exit 1
fi

# Check if VITE_API_URL is set
if [ -z "$VITE_API_URL" ]; then
    echo "Error: VITE_API_URL not found in .env file"
    exit 1
fi

# Check if VITE_TURNSTILE_SITE_KEY is set (optional)
if [ -n "$VITE_TURNSTILE_SITE_KEY" ]; then
    echo "Turnstile Site Key: ${VITE_TURNSTILE_SITE_KEY:0:15}..."
    TURNSTILE_BUILD_ARG="--build-arg VITE_TURNSTILE_SITE_KEY=${VITE_TURNSTILE_SITE_KEY}"
else
    echo "Turnstile Site Key: Not set (Turnstile will be disabled)"
    TURNSTILE_BUILD_ARG=""
fi

echo "Deploying frontend with configuration from $ENV_FILE file..."
echo "Google Client ID: ${VITE_GOOGLE_CLIENT_ID:0:20}..."
echo "API URL: $VITE_API_URL"

# Deploy with build arguments
fly deploy -a divemap-frontend \
  --build-arg VITE_GOOGLE_CLIENT_ID="$VITE_GOOGLE_CLIENT_ID" \
  --build-arg VITE_API_URL="$VITE_API_URL" \
  $TURNSTILE_BUILD_ARG

echo "Deployment completed successfully!"
echo "Visit your app at: https://divemap.gr/" 
