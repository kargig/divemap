#!/bin/bash
set -e

echo "=== Divemap Android Artifact Builder ==="

# Navigate to android directory
cd "$(dirname "$0")/../divemap-android" || exit 1

# Extract versions robustly using Node.js
VERSION_NAME=$(node -p "require('./twa-manifest.json').appVersionName")
VERSION_CODE=$(node -p "require('./twa-manifest.json').appVersionCode")

if [ -z "$VERSION_NAME" ] || [ -z "$VERSION_CODE" ] || [ "$VERSION_NAME" == "undefined" ]; then
    echo "❌ Error: Could not extract version info from twa-manifest.json"
    exit 1
fi

echo "🚀 Building Divemap v${VERSION_NAME}..."

# Run bubblewrap
bubblewrap build

# Re-extract versions after build because bubblewrap might have updated them (e.g. bumped version code)
VERSION_NAME=$(node -p "require('./twa-manifest.json').appVersionName")
VERSION_CODE=$(node -p "require('./twa-manifest.json').appVersionCode")

echo "✅ Build finished. Current version in manifest: v${VERSION_NAME} (Code: ${VERSION_CODE})"

# Create releases archive directory
mkdir -p releases

# Define artifact names
APK_TARGET="releases/Divemap-v${VERSION_NAME}-c${VERSION_CODE}.apk"
AAB_TARGET="releases/Divemap-v${VERSION_NAME}-c${VERSION_CODE}.aab"
IDSIG_TARGET="releases/Divemap-v${VERSION_NAME}-c${VERSION_CODE}.apk.idsig"

echo "📦 Archiving versioned artifacts..."

# Move and rename artifacts
if [ -f "app-release-signed.apk" ]; then
    mv app-release-signed.apk "$APK_TARGET"
    echo "✅ Saved APK: divemap-android/$APK_TARGET"
else
    echo "⚠️ Warning: APK not found after build."
fi

if [ -f "app-release-bundle.aab" ]; then
    mv app-release-bundle.aab "$AAB_TARGET"
    echo "✅ Saved AAB: divemap-android/$AAB_TARGET"
else
    echo "⚠️ Warning: AAB not found after build."
fi

if [ -f "app-release-signed.apk.idsig" ]; then
    mv app-release-signed.apk.idsig "$IDSIG_TARGET"
fi

# Clean up unsigned aligned apk if present to keep working directory clean
if [ -f "app-release-unsigned-aligned.apk" ]; then
    rm app-release-unsigned-aligned.apk
fi

echo "✨ Build and archive complete!"
