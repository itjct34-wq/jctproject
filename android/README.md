# Android app (Capacitor) — ERP only

Native shell for the **hosted ERP**, not the public marketing site.

| Setting | Value |
| --- | --- |
| App id | `com.jct.erp` |
| App name | **ERP** |
| Entry URL | `https://jctproject.vercel.app/login` |
| Config | repo-root `capacitor.config.ts` |

The WebView starts at `/login`. Marketing paths (`/`, `/inventory`, `/about`, …) are redirected back to login via `ErpWebViewClient` + injected path guard in `MainActivity`.

## Prerequisites

- Node.js 20+
- **Android Studio** (Hedgehog or newer) with:
  - Android SDK Platform 35+ (or current compileSdk)
  - Android SDK Build-Tools
  - JDK 17 (Android Studio bundled JBR is fine)
- Network access to `https://jctproject.vercel.app`

## Recommended: build APK in Android Studio

Gradle distribution downloads from this agent environment timed out. **Use Android Studio** so the IDE manages the Gradle wrapper and SDK.

### Exact steps

1. From the repo root (one-time or after Cap config changes):

   ```bash
   npm install
   npx cap sync android
   ```

2. Open **Android Studio** → **Open** → select the `android/` folder (not the repo root).

3. Wait for Gradle sync to finish (Studio downloads the Gradle distribution and dependencies).

4. If prompted, accept SDK licenses / install missing SDK packages.

5. Menu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

6. When done, click **locate** in the notification, or open:

   `android/app/build/outputs/apk/debug/app-debug.apk`

7. Optional — host for `/download`:

   ```bash
   # from repo root
   copy android\app\build\outputs\apk\debug\app-debug.apk public\downloads\erp.apk
   ```

   Or upload the APK and set `NEXT_PUBLIC_ANDROID_APK_URL` to that HTTPS URL (preferred for production).

8. Install on a phone: enable **Install unknown apps**, transfer the APK, open it. Or:

   ```bash
   adb install -r android\app\build\outputs\apk\debug\app-debug.apk
   ```

## CLI alternative (same machine as Android Studio)

After Studio has synced Gradle once:

```bash
cd android
.\gradlew.bat assembleDebug
```

## Optional: GitHub Actions

`.github/workflows/android-apk.yml` can build a debug APK on **workflow_dispatch**. After it publishes a release asset, set Vercel env `NEXT_PUBLIC_ANDROID_APK_URL` to that HTTPS URL so `/download` shows **Download Android APK**.

## What staff should use today

Until an APK is hosted, use **Add to Home Screen** from `/login` (see the public `/download` page). That is the primary Android path.

## Do not commit

- `android/local.properties`
- Keystores / signing passwords
- `*.apk` / `*.aab` under `android/app/build/`
