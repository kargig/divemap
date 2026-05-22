# Android Publisher Skill

This skill provides the procedural workflow for building and publishing updates to the Divemap Android app. It covers both the legacy PWA/TWA (Bubblewrap) approach and the modern Capacitor WebView approach.

---

## 🛠️ Option A: Modern WebView (Capacitor)

Use this for the latest version of the app which supports native features like Google Auth.

### 1. Update Version Info
If requested to change the version string (e.g., to "1.8.0") or the build number:
1. Open `frontend/android/app/build.gradle`
2. Update the `versionName` string to reflect the new public-facing version.
3. Increment the `versionCode` integer by 1.

### 2. Build and Archive
Navigate to the project root and execute the build. This requires Node and Android SDK on the host.
```bash
# Sync frontend to native project
cd frontend && npm run build && npx cap sync
cd ..

# Build and sign the Android artifacts
./scripts/build-webview-android.sh
```
*Note: User will need to enter the Keystore password and Key password interactively.*

**Artifacts generated in `divemap-webview-android/releases/`:**
- `Divemap-Dev-v[versionName]-c[versionCode].apk` (Local Testing)
- `Divemap-v[versionName]-c[versionCode].aab` (Play Store Upload)

---

## 🏗️ Option B: Legacy PWA/TWA (Bubblewrap)

Use this only for maintaining older versions or if explicitly requested to use Bubblewrap.

### 1. Update Version Info
1. Open `divemap-android/twa-manifest.json`
2. Update `"appVersionName"` and `"appVersion"`. Bubblewrap increments `appVersionCode` automatically.

### 2. Build and Archive
```bash
./scripts/build-android.sh
```
*Note: User will need to enter passwords interactively.*

**Artifacts generated in `divemap-android/releases/`:**
- `Divemap-v[versionName]-c[versionCode].apk`
- `Divemap-v[versionName]-c[versionCode].aab`

### 3. Verify Digital Asset Links (TWA Only)
1. Check `frontend/public/.well-known/assetlinks.json`.
2. Ensure it contains the SHA-256 fingerprints for both the Bubblewrap keystore and Google Play App Signing.
3. Verify at `https://divemap.gr/.well-known/assetlinks.json`.

---

## 🧪 Testing & Publishing (Applies to both)

### Local Testing
- Transfer the `.apk` to an Android device.
- Enable "Install from unknown sources".
- **For WebView:** Verify native features (Google Login, Geolocation).
- **For TWA:** Verify the browser address bar is **hidden**.

### Play Console Upload
1. Log into [Google Play Console](https://play.google.com/console).
2. Create a new release in **Production** or **Internal Testing**.
3. Upload the versioned `.aab` file.
4. Draft release notes (under 500 characters).

## 🔍 Troubleshooting

- **Google Login Fails (WebView)**: Check SHA-256 in Google Cloud Console.
- **Address Bar Visible (TWA)**: Digital Asset Link verification failed. Check `assetlinks.json`.
- **403 Forbidden on assetlinks.json**: Check Nginx configuration for `.well-known` access.
- **PWA Rotation**: Ensure `orientation: 'any'` in `frontend/vite.config.mjs`.
