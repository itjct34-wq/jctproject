/**
 * Example mirror of repo-root `capacitor.config.ts`.
 * Capacitor loads the hosted ERP (HTTPS), not a static Next export.
 */
const config = {
  appId: 'com.jct.erp',
  appName: 'ERP',
  webDir: 'native-www',
  server: {
    url: 'https://jctproject.vercel.app/login',
    cleartext: false,
    allowNavigation: [
      'jctproject.vercel.app',
      '*.supabase.co',
      'omlejtzwodudghqqgaiz.supabase.co',
    ],
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
