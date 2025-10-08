#!/bin/bash
set -e

# Precompress assets script for content-hashed assets
# Run this after `npm run build` to create .gz files for Nginx gzip_static

echo "🔧 Precompressing assets for gzip_static serving..."

# Check if build directory exists
if [ ! -d "build" ]; then
    echo "❌ Error: build directory not found. Run 'npm run build' first."
    exit 1
fi

# Find and compress JS, CSS, and font files
echo "📦 Compressing JavaScript files..."
find build -type f -name "*.js" -print0 | xargs -0 -I{} gzip -9 -k "{}"

echo "📦 Compressing CSS files..."
find build -type f -name "*.css" -print0 | xargs -0 -I{} gzip -9 -k "{}"

echo "📦 Compressing font files..."
find build -type f \( -name "*.woff" -o -name "*.woff2" -o -name "*.ttf" -o -name "*.eot" \) -print0 | xargs -0 -I{} gzip -9 -k "{}"

# Count compressed files
compressed_count=$(find build -name "*.gz" | wc -l)
echo "✅ Precompression complete! Created $compressed_count .gz files"

# Show some examples
echo "📋 Example compressed files:"
find build -name "*.gz" | head -5 | sed 's/^/  /'

echo "🚀 Ready for Nginx gzip_static serving!"

