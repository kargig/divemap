#!/bin/bash

# Deploy script for Divemap frontend
# This script reads environment variables from .env and deploys with build secrets

set -e

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found. Please create one based on env.example"
    exit 1
fi

# Source the .env file to get environment variables
export $(grep -v '^#' .env | xargs)

# Check if REACT_APP_GOOGLE_CLIENT_ID is set
if [ -z "$REACT_APP_GOOGLE_CLIENT_ID" ]; then
    echo "Error: REACT_APP_GOOGLE_CLIENT_ID not found in .env file"
    exit 1
fi

echo "Deploying frontend with Google Client ID from .env file..."
echo "Google Client ID: ${REACT_APP_GOOGLE_CLIENT_ID:0:20}..."

# Deploy with build argument
fly deploy -a divemap --build-arg REACT_APP_GOOGLE_CLIENT_ID="$REACT_APP_GOOGLE_CLIENT_ID"

echo "Deployment completed successfully!"
echo "Visit your app at: https://divemap.fly.dev/" 