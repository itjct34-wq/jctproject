# Android app (Capacitor)

Wraps the hosted ERP web app in a native Android shell. Prefer the **PWA / Add to Home Screen** path on `/download` until you need a sideloadable APK or Play Store build.

## Prerequisites

- Node.js 20+
- JDK 17+
- Android Studio (SDK + platform tools)
- A deployed ERP URL (e.g. production or staging)

## One-time setup

From the repo root:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android --save-dev
npx cap init "ERP" "com.jct.erp" --web-dir=out
```

This project is Next.js (SSR). Capacitor should load the **live site**, not a static export:

1. Copy `android/capacitor.config.example.ts` to `capacitor.config.ts` at the repo root.
2. Set `server.url` to your deployed origin (HTTPS).
3. Generate the native project:

```bash
npx cap add android
npx cap sync android
npx cap open android
```

## Build a release APK / AAB

In Android Studio:

1. Open the `android/` folder Capacitor created.
2. **Build → Generate Signed Bundle / APK**.
3. For Play: upload the **AAB**. For sideload: distribute the **APK**.

Or from CLI (after Gradle sync):

```bash
cd android
./gradlew assembleRelease
```

APK output is typically under `android/app/build/outputs/apk/release/`.

## Host the download

1. Upload the APK to object storage or `public/downloads/erp-android.apk`.
2. Set `NEXT_PUBLIC_ANDROID_APK_URL` to that HTTPS URL.
3. The public page `/download` will enable the Download CTA.

## Notes

- Company / Mono Garam marks stay on **printed documents** only; the Android splash should use the neutral ERP icon from `public/icons/`.
- Do not commit keystore files or signing passwords.
