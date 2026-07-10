# ProNeighbor Android TWA (Trusted Web Activity)

Wraps the ProNeighbor PWA in a native Android shell so it can be published on the Google Play Store — **within a week**.

**Time-to-market approach**: Ship the existing PWA as-is via TWA, then build a full native app in parallel.

---

## 📦 Project Structure

```
android-twa/
├── app/
│   ├── build.gradle.kts          # App build config
│   ├── proguard-rules.pro
│   └── src/main/
│       ├── AndroidManifest.xml    # TWA launcher, deep links, FCM
│       ├── java/com/proneighbor/twa/   # (extend here if needed)
│       └── res/
│           ├── drawable/          # Splash logo, adaptive icon vectors
│           ├── mipmap-anydpi-v26/ # Adaptive icon defs
│           └── values/            # Colors, strings, theme
├── scripts/
│   ├── generate-keystore.sh      # Bash: keystore + SHA-256 generator
│   └── generate-keystore.ps1     # PowerShell: same
├── .well-known/
│   └── assetlinks.json            # ⬅ Deploy to Firebase Hosting root
├── build.gradle.kts               # Project-level Gradle
├── settings.gradle.kts
├── gradle.properties
└── README.md                      # ← You are here
```

---

## ✅ Prerequisites

| Tool | Version | Why |
|---|---|---|
| **Java JDK** | 17+ | Required by Android Gradle Plugin + keytool |
| **Android Studio** | Ladybug (2024.3+) | IDE, SDK manager, emulator |
| **Android SDK** | API 35 (compile), API 23 (min) | Install via SDK Manager in Android Studio |
| **Firebase CLI** | latest | Deploy `assetlinks.json` to hosting |
| Your PWA deployed | live at `neighbhorpro.web.app` | Already set up via Firebase Hosting |

---

## 🚀 Step-by-Step: Ship to Play Store

### Step 1: Generate a signing keystore

```bash
# Windows (PowerShell):
cd android-twa
.\scripts\generate-keystore.ps1

# macOS / Linux:
chmod +x scripts/generate-keystore.sh
./scripts/generate-keystore.sh
```

You'll be prompted for:
- **Keystore password** — remember this (store in password manager)
- **Key password** — can be same as keystore password
- **Distinguished name** — just your name/org is enough

This creates **`keystore.jks`** in the `android-twa/` directory and prints the **SHA-256 fingerprint**.

### Step 2: Deploy Digital Asset Links

First, copy the `assetlinks.json` into the PWA's public directory so it gets deployed:

```bash
# 1️⃣ Copy the SHA-256 fingerprint from Step 1

# 2️⃣ Edit .well-known/assetlinks.json — replace the placeholder:
#    "REPLACE_WITH_YOUR_SHA256_HASH" → "AA:BB:CC:...:FF" (59-char hex)

# 3️⃣ Copy it into the web app's public directory so Firebase Hosting serves it:
mkdir -p ../public/.well-known
cp .well-known/assetlinks.json ../public/.well-known/assetlinks.json

# 4️⃣ Rebuild and deploy the PWA:
cd ..
npm run build
firebase deploy --only hosting

# 5️⃣ Verify it's live:
curl https://neighbhorpro.web.app/.well-known/assetlinks.json
```

This `.well-known/assetlinks.json` tells Android: *"The website `neighbhorpro.web.app` trusts the app `com.proneighbor.twa`."*

> **Note**: The file MUST be served from the domain root at `/.well-known/assetlinks.json` with `Content-Type: application/json`. Firebase Hosting handles this correctly automatically.

### Step 3: Initialize the Gradle wrapper

The binary Gradle wrapper JAR (`gradle-wrapper.jar`) isn't committed to the repo.
Initialize it with:

```bash
# Option A: If you have Gradle installed
cd android-twa
gradle wrapper --gradle-version 8.9

# Option B: Install Android Studio and open the android-twa/
# project. Android Studio will download the wrapper automatically.

# Option C: Download the wrapper manually (Windows)
# Download gradle-wrapper.jar from:
# https://raw.githubusercontent.com/gradle/gradle/v8.9.0/gradle/wrapper/gradle-wrapper.jar
# Place it in gradle/wrapper/
```

### Step 4: Configure the app (already done)

The `AndroidManifest.xml` already has:
- ✅ Correct `DEFAULT_URL` → `https://neighbhorpro.web.app`
- ✅ `asset_statements` matching the website URL
- ✅ Deep link intent-filters for both `.web.app` and `.firebaseapp.com`
- ✅ Splash screen with brand colors
- ✅ FCM notification service

No changes needed unless you change the URL.

### Step 4: Build the release APK (for testing)

```bash
# Set your keystore passwords as env vars
export KEYSTORE_PASSWORD="your-store-password"
export KEY_PASSWORD="your-key-password"
export KEY_ALIAS="proneighbor"

# Windows PowerShell:
$env:KEYSTORE_PASSWORD = "your-store-password"
$env:KEY_PASSWORD = "your-key-password"
$env:KEY_ALIAS = "proneighbor"

# Build a release APK (signed with your real keystore, TWA mode works)
./gradlew :app:assembleRelease
```

APK output: `app/build/outputs/apk/release/app-release.apk`

### Step 5: Test locally on your device

```bash
# Plug in your Android phone via USB (enable Developer Options + USB Debugging)
# Install the release APK:
adb install app/build/outputs/apk/release/app-release.apk

# Or for a debug build (no keystore needed, but shows address bar):
./gradlew :app:assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

Open the app on your phone. If Digital Asset Links verification passes, it runs as a **full-screen TWA** (no address bar). If it fails (e.g. dev build), it falls back to a Custom Tab with a visible URL bar — still functional for UI review.

### Step 6: Share with reviewers via Firebase App Distribution

For UI reviews without going through Play Store, use **Firebase App Distribution** — it's already in your Firebase project:

```bash
# 1️⃣ Install the App Distribution Gradle plugin
#    Add this to app/build.gradle.kts:
#
#    plugins {
#        id("com.google.firebase.appdistribution") version "5.0.0"
#    }
#
#    dependencies {
#        implementation("com.google.firebase:firebase-appdistribution:16.1.0")
#        implementation("com.google.firebase:firebase-appdistribution-api:16.1.0")
#    }

# 2️⃣ Authenticate with your Firebase account:
firebase login

# 3️⃣ Upload the APK and add testers:
./gradlew :app:assembleRelease \
    :app:firebaseAppDistributionUploadRelease \
    -PfirebaseAppDistributionTesters="reviewer1@email.com,reviewer2@email.com" \
    -PfirebaseAppDistributionReleaseNotes="Pre-launch UI review build"
```

Testers receive an email with a download link. They can install and provide feedback without any Play Store involvement.

> **Alternative**: For quick ad-hoc sharing, just upload the `.apk` to Google Drive / Dropbox and share the link. Testers tap to install (they must enable "Install from unknown apps" once).

### Step 7: Build AAB and submit to Play Store

Once local testing and UI review pass, build the Android App Bundle (AAB) for Play Store:

```bash
./gradlew :app:bundleRelease
```

Output: `app/build/outputs/bundle/release/app-release.aab`

Then upload to Play Console:

1. Go to [Google Play Console](https://play.google.com/console/)
2. Create a new app → "ProNeighbor"
3. Fill in the store listing (use existing PWA copy)
4. Upload the `app-release.aab` under **Production > Release > Create new release**
5. Complete the **App content** questionnaire (privacy policy — use your `/privacy` page URL)
6. Submit for review

> **⚠️ First-time setup**: You may need to wait 1–3 days for Play Console account verification and app review. Subsequent updates are typically reviewed within hours.

---

## 🧪 Testing TWA Verification Locally

### Check Digital Asset Links from your device

```bash
# From your phone, visit:
https://neighbhorpro.web.app/.well-known/assetlinks.json

# It should show your SHA-256 fingerprint.
```

### Verify using Google's API

```bash
curl "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://neighbhorpro.web.app&relation=delegate_permission/common.handle_all_urls"
```

The response should contain your package name (`com.proneighbor.twa`) and SHA-256.

### Check TWA status on your device

```bash
adb logcat | grep -i "DigitalAssetLinks\|TWA\|CustomTab"
# Open the app and look for:
# - "Verification passed" → TWA mode (full screen, no URL bar)
# - "Verification failed" → Falls back to Custom Tab (URL bar visible)
# - Any connection refused → assetlinks.json not deployed
```

---

---

## 🔄 Updating the PWA

When you update the PWA (deploy via `firebase deploy --only hosting`), the TWA picks up changes automatically — **no Play Store update needed** for content changes. You only need to submit a new AAB if you change:
- The `AndroidManifest.xml` (e.g., new permissions)
- The app icon or splash screen
- The navigation URL
- Target SDK version (Google Play requirement)

---

## ⚠️ Known Limitations of TWA vs. Native

| Limitation | Impact | Will It Block Launch? |
|---|---|---|
| **Performance** | Same as browser — not native speed | ❌ No — PWA is already fast |
| **Offline support** | Service worker only (no Firestore offline persistence) | ❌ No — SW cache works for most cases |
| **Push reliability** | Depends on Chrome's service worker (less reliable on MIUI/Oppo) | ⚠️ Test on target devices |
| **Camera access** | Uses `<input type="file">` (slower, no preview) | ❌ No — still functional |
| **Phone OTP** | Manual OTP entry (no SMS auto-read) | ⚠️ Users must type OTP |
| **Biometric auth** | Not available | ❌ No — email/password + Google auth works |
| **Play Store review** | Google may ask: "Why not native?" Prepare an answer explaining TWA as Phase 1 | ⚠️ Prepare brief justification |

**Mitigation strategies** for push reliability on Xiaomi/Vivo/Oppo:
1. In your PWA code, add an in-app notification polling fallback (Firestore listener)
2. Guide users to enable "Autostart" and "Lock" permissions in Settings

---

## 🗺️ Migration Path: TWA → Full Native

```
Week 1:  TWA on Play Store ✅
Week 2+: Build native Android app (Kotlin + Compose) in parallel
Month 3: Ship v2 native app, retire TWA
```

When the native app is ready, you update the TWA's `DEFAULT_URL` to point to a migration landing page, or simply unpublish the TWA and publish the native app under the same package name (com.proneighbor.twa).

---

## 🔧 Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| App shows white screen | `assetlinks.json` not deployed or SHA-256 mismatch | Verify the file is at `/.well-known/assetlinks.json` and the fingerprint matches |
| App opens in Chrome instead of standalone | TWA verification failed → falls back to Custom Tab | Check `adb logcat \| grep -i "DigitalAssetLinks\|TWA"` |
| Notifications not working | FCM service worker not registered | Ensure your PWA's `sw.js` has Firebase messaging compat imports (already done) |
| App not showing on Play Store search | TWA has lower ranking than native apps | Invest in ASO; tell users to search exact name |
| Gradle build fails: "SDK location not found" | No `local.properties` file | Create it with `sdk.dir=C\:\\Users\\YourName\\AppData\\Local\\Android\\Sdk` or open project in Android Studio once |

---

## 📋 Files You MUST Touch Before Shipping

| File | Action |
|---|---|
| `.well-known/assetlinks.json` | Replace `REPLACE_WITH_YOUR_SHA256_HASH` with your real SHA-256 |
| `keystore.jks` | Generate via the script (do NOT commit to git) |
| `app/build.gradle.kts` (optional) | Update `versionCode` + `versionName` before each Play Store release |
| `app/src/main/res/drawable/splash_logo.xml` (optional) | Replace with your actual logo PNG for a polished splash screen |

---

## 📄 License

Same as ProNeighbor webapp.
