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

# Check if REACT_APP_GOOGLE_CLIENT_ID is set
if [ -z "$REACT_APP_GOOGLE_CLIENT_ID" ]; then
    echo "Error: REACT_APP_GOOGLE_CLIENT_ID not found in .env file"
    exit 1
fi

# Check if REACT_APP_API_URL is set
if [ -z "$REACT_APP_API_URL" ]; then
    echo "Error: REACT_APP_API_URL not found in .env file"
    exit 1
fi

echo "Deploying frontend with configuration from $ENV_FILE file..."
echo "Google Client ID: ${REACT_APP_GOOGLE_CLIENT_ID:0:20}..."
echo "API URL: $REACT_APP_API_URL"

# Deploy with build arguments
fly deploy -a divemap-frontend \
  --build-arg REACT_APP_GOOGLE_CLIENT_ID="$REACT_APP_GOOGLE_CLIENT_ID" \
  --build-arg REACT_APP_API_URL="$REACT_APP_API_URL"

echo "Deployment completed successfully!"
echo "Visit your app at: https://divemap.gr/" 
