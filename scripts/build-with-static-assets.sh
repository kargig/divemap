#!/bin/bash
set -e

# Build script for content-hashed assets with Nginx static serving
# This script builds the frontend, precompresses assets, and prepares for Nginx

echo "🚀 Building Divemap with content-hashed static assets..."

# Check if we're in the right directory
if [ ! -f "frontend/package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Build frontend with compression
echo "📦 Building frontend..."
cd frontend

# Update browserslist data to prevent warnings (silent if already up to date)
echo "🔄 Updating browserslist data..."
npx update-browserslist-db@latest --silent 2>/dev/null || true

npm run build:with-compression
cd ..

# Clean up previous build and create nginx frontend-build directory
echo "🧹 Cleaning up previous build..."
rm -rf nginx/frontend-build
mkdir -p nginx/frontend-build

# Copy frontend build to nginx directory
echo "📋 Copying frontend build to nginx directory..."
cp -r frontend/build/* nginx/frontend-build/

# Show build summary
echo "✅ Build complete! Summary:"
echo "  - Frontend build: frontend/build/"
echo "  - Nginx static assets: nginx/frontend-build/"
echo "  - Precompressed files: $(find nginx/frontend-build -name "*.gz" | wc -l) .gz files"

# Show example hashed filenames
echo "📋 Example hashed assets:"
find nginx/frontend-build -name "*.js" -o -name "*.css" | head -3 | sed 's/^/  /'

echo "🎯 Ready for Nginx Docker build with static assets!"
echo "   Run: docker build -f nginx/Dockerfile.prod -t divemap-nginx nginx/"

