#!/bin/bash
set -e

echo "=== Divemap Capacitor WebView Artifact Builder ==="

# Configuration
KEYSTORE_PATH="/home/kargig/src/divemap/divemap-android/android.keystore"
KEY_ALIAS="android"
OUTPUT_DIR="/home/kargig/src/divemap/divemap-webview-android/releases"
NOTES_DIR="/home/kargig/src/divemap/divemap-webview-android/release-notes"

mkdir -p "$OUTPUT_DIR"
mkdir -p "$NOTES_DIR"

cd "$(dirname "$0")/../frontend/android" || exit 1

# Extract version info from build.gradle
VERSION_NAME=$(grep "versionName " app/build.gradle | awk '{print $2}' | tr -d '"' | tr -d "'")
VERSION_CODE=$(grep "versionCode " app/build.gradle | awk '{print $2}')

if [ -z "$VERSION_NAME" ] || [ -z "$VERSION_CODE" ]; then
    echo "❌ Error: Could not extract version info from build.gradle"
    exit 1
fi

echo "🚀 Building Divemap WebView v${VERSION_NAME} (Code: ${VERSION_CODE})..."

# Define Artifact Names
DEV_APK_TARGET="${OUTPUT_DIR}/Divemap-Dev-v${VERSION_NAME}-c${VERSION_CODE}.apk"
PROD_AAB_TARGET="${OUTPUT_DIR}/Divemap-v${VERSION_NAME}-c${VERSION_CODE}.aab"
NOTES_TARGET="${NOTES_DIR}/v${VERSION_NAME}-c${VERSION_CODE}.txt"

echo "Building Debug (Dev) APK..."
./gradlew assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk "$DEV_APK_TARGET"
echo "✅ Saved Dev APK: $DEV_APK_TARGET"

echo "Building Release AAB..."
./gradlew bundleRelease

echo "Signing Release AAB..."
# Note: User will need to provide passwords
jarsigner -keystore "$KEYSTORE_PATH" -sigalg SHA256withRSA -digestalg SHA-256 app/build/outputs/bundle/release/app-release.aab "$KEY_ALIAS"

cp app/build/outputs/bundle/release/app-release.aab "$PROD_AAB_TARGET"
echo "✅ Saved Production AAB: $PROD_AAB_TARGET"

# Generate empty release notes template if it doesn't exist
if [ ! -f "$NOTES_TARGET" ]; then
    echo "Divemap v${VERSION_NAME}" > "$NOTES_TARGET"
    echo "Release Notes:" >> "$NOTES_TARGET"
    echo "- " >> "$NOTES_TARGET"
    echo "✅ Created release notes template: $NOTES_TARGET"
fi

echo "✨ Build and archive complete!"
