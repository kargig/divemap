#!/bin/bash
set -e

# Helper script to compile Linux x86_64 binary wheels in a clean Debian environment
# and upload them to the GitHub Release wheelhouse.
#
# Usage:
#   ./scripts/publish_wheel_release.sh [package_name] [version] [release_tag] [python_version]
#
# Examples:
#   ./scripts/publish_wheel_release.sh octo-deco 2.0.3 deps-v1 3.11
#   ./scripts/publish_wheel_release.sh octo-deco 2.0.3 deps-v1 3.13

PACKAGE="${1:-octo-deco}"
VERSION="${2:-2.0.3}"
TAG="${3:-deps-v1}"
PYTHON_VERSION="${4:-3.13}"
REPO="kargig/divemap"

# Check if gh CLI is available and authenticated
if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI ('gh') is not installed. Please install and authenticate via 'gh auth login'."
    exit 1
fi

echo "🔨 Building Linux x86_64 wheel for ${PACKAGE}==${VERSION} in python:${PYTHON_VERSION}-slim container..."
TMP_DIR=$(mktemp -d)

docker run --rm -v "${TMP_DIR}:/out" "python:${PYTHON_VERSION}-slim" bash -c "apt-get update -qq && apt-get install -y -qq gcc python3-dev > /dev/null && pip wheel --no-deps ${PACKAGE}==${VERSION} -w /out"

WHEEL_FILE=$(ls "${TMP_DIR}"/"${PACKAGE//-/_}"-"${VERSION}"-*.whl 2>/dev/null | head -n 1)

if [ -z "$WHEEL_FILE" ] || [ ! -f "$WHEEL_FILE" ]; then
    echo "❌ Error: Wheel was not generated."
    rm -rf "${TMP_DIR}"
    exit 1
fi

WHEEL_NAME=$(basename "$WHEEL_FILE")
WHEEL_SIZE=$(du -h "$WHEEL_FILE" | cut -f1)
echo "✅ Built wheel: ${WHEEL_NAME} (${WHEEL_SIZE})"

# Verify if release tag exists or create it
if ! gh release view "${TAG}" --repo "${REPO}" > /dev/null 2>&1; then
    echo "📦 Release '${TAG}' not found. Creating it on ${REPO}..."
    gh release create "${TAG}" "${WHEEL_FILE}" --repo "${REPO}" --title "Binary Dependency Wheels" --notes "Pre-compiled Linux x86_64 wheels for packages without official wheels on PyPI."
else
    echo "🚀 Uploading wheel to existing release '${TAG}' on ${REPO}..."
    gh release upload "${TAG}" "${WHEEL_FILE}" --clobber --repo "${REPO}"
fi

URL="https://github.com/${REPO}/releases/download/${TAG}/${WHEEL_NAME}"
echo "🎉 Wheel published successfully!"
echo "🔗 Direct download URL: ${URL}"
echo ""
echo "Next steps in backend/pyproject.toml:"
echo "------------------------------------"
echo "1. Set version constraint in dependencies: "${PACKAGE}==${VERSION}""
echo "2. Add/update the source URL:"
echo "   [tool.uv.sources]"
echo "   ${PACKAGE} = { url = "${URL}" }"
echo "3. Run 'make backend-lock' to update uv.lock and requirements.txt."
echo ""

rm -rf "${TMP_DIR}"
