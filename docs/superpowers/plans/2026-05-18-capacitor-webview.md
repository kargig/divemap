# Capacitor WebView Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Capacitor-based Android WebView app that loads `https://divemap.gr` to bypass Google Play engagement tracking issues.

**Architecture:** A lightweight native shell using Capacitor that wraps the live website. It includes a "Dev" flavor for parallel installation and handles native back-button navigation.

**Tech Stack:** Capacitor, Android (Java/Kotlin), Gradle.

---

### Task 1: Project Setup & Dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install Capacitor CLI and Core**
Run: `cd frontend && npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/geolocation`

- [ ] **Step 2: Initialize Capacitor**
Run: `npx cap init Divemap gr.divemap.twa --web-dir dist`

- [ ] **Step 3: Commit**
```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: initialize capacitor and add dependencies"
```

---

### Task 2: Configuration for Live URL and Dev Package ID

**Files:**
- Create: `frontend/capacitor.config.ts`

- [ ] **Step 1: Create the Capacitor configuration**
Ensure the config supports a "Dev" mode via environment variables if possible, or provide instructions for a quick manual switch.

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: process.env.CAP_APP_ID || 'gr.divemap.twa',
  appName: 'Divemap',
  webDir: 'dist',
  server: {
    url: 'https://divemap.gr',
    allowNavigation: ['divemap.gr'],
    cleartext: true
  },
  plugins: {
    Geolocation: {
      permissions: ['location']
    }
  }
};

export default config;
```

- [ ] **Step 2: Verify the config**
Run: `ls frontend/capacitor.config.ts`

- [ ] **Step 3: Commit**
```bash
git add frontend/capacitor.config.ts
git commit -m "config: set live URL and basic capacitor setup"
```

---

### Task 3: Android Platform Initialization & Permissions

**Files:**
- Create: `frontend/android/` (via CLI)
- Modify: `frontend/android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Add Android Platform**
Run: `cd frontend && npx cap add android`

- [ ] **Step 2: Add Geolocation Permissions**
Open `frontend/android/app/src/main/AndroidManifest.xml` and add these before `<application>`:
```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-feature android:name="android.hardware.location.gps" />
```

- [ ] **Step 3: Sync changes**
Run: `npx cap sync android`

- [ ] **Step 4: Commit**
```bash
git add frontend/android/
git commit -m "feat: add android platform and configure permissions"
```

---

### Task 4: Native Implementation (Back Button & Package ID)

**Files:**
- Modify: `frontend/android/app/src/main/java/gr/divemap/twa/MainActivity.java`
- Modify: `frontend/android/app/build.gradle`

- [ ] **Step 1: Implement Back Button Logic**
We need to ensure the WebView handles back navigation.
Open `frontend/android/app/src/main/java/gr/divemap/twa/MainActivity.java` and override `onBackPressed`:

```java
package gr.divemap.twa;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onBackPressed() {
        if (this.bridge.getWebView().canGoBack()) {
            this.bridge.getWebView().goBack();
        } else {
            super.onBackPressed();
        }
    }
}
```

- [ ] **Step 2: Configure "Dev" Package ID in Gradle**
Open `frontend/android/app/build.gradle` and add a `applicationIdSuffix`:

```gradle
android {
    ...
    buildTypes {
        debug {
            applicationIdSuffix ".dev"
            resValue "string", "app_name", "Divemap (Dev)"
        }
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

- [ ] **Step 3: Commit**
```bash
git add frontend/android/app/src/main/java/gr/divemap/twa/MainActivity.java frontend/android/app/build.gradle
git commit -m "feat: handle back button and add dev build suffix"
```

---

### Task 5: Build & Signing Script

**Files:**
- Create: `scripts/build-webview-android.sh`

- [ ] **Step 1: Create the automated build script**
This script will mirror your existing TWA build script but use Gradle directly.

```bash
#!/bin/bash
set -e

# Configuration
KEYSTORE_PATH="/home/kargig/src/divemap/divemap-android/android.keystore"
KEY_ALIAS="android"
OUTPUT_DIR="divemap-webview-android/releases"
mkdir -p $OUTPUT_DIR

cd frontend/android

echo "Building Debug (Dev) APK..."
./gradlew assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk "../../$OUTPUT_DIR/Divemap-Dev.apk"

echo "Building Release AAB..."
./gradlew bundleRelease

echo "Signing Release AAB..."
# Note: User will need to provide passwords
jarsigner -keystore $KEYSTORE_PATH -sigalg SHA256withRSA -digestalg SHA-256 app/build/outputs/bundle/release/app-release.aab $KEY_ALIAS

cp app/build/outputs/bundle/release/app-release.aab "../../$OUTPUT_DIR/Divemap-Production.aab"

echo "Build complete! Artifacts in $OUTPUT_DIR"
```

- [ ] **Step 2: Make script executable**
Run: `chmod +x scripts/build-webview-android.sh`

- [ ] **Step 3: Commit**
```bash
git add scripts/build-webview-android.sh
git commit -m "feat: add build script for webview android app"
```
