/**
 * Copy to repo-root `capacitor.config.ts` and set `server.url` to your deployed ERP origin.
 * Capacitor loads the live Next.js app (not a static export).
 *
 * After `npm i @capacitor/core @capacitor/cli @capacitor/android`, you can type this as CapacitorConfig.
 */
const config = {
  appId: 'com.jct.erp',
  appName: 'ERP',
  webDir: 'public',
  server: {
    url: 'https://YOUR_ERP_HOST',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
