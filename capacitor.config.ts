import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor loads the live Next.js ERP (not a static export).
 * Entry is /login — the authenticated app shell, not the public marketing site.
 */
const config: CapacitorConfig = {
  appId: 'com.jct.erp',
  appName: 'ERP',
  webDir: 'native-www',
  server: {
    url: 'https://jctproject.vercel.app/login',
    cleartext: false,
    // Allow Supabase auth / storage host alongside the ERP origin.
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
