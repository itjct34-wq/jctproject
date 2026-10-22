import './globals.css';
import type { Metadata } from 'next';
import { Barlow, JetBrains_Mono, Noto_Sans_JP, Oswald } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { LocaleProvider } from '@/lib/i18n/locale-provider';
import { Toaster } from '@/components/ui/sonner';
import { Analytics } from '@vercel/analytics/next';

/** Lot-banner condensed display — classic dealership / yard-board voice */
const oswald = Oswald({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

/** Automotive workhorse UI sans — not Inter/Outfit */
const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const notoSansJp = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jp',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'ERP',
    template: '%s · ERP',
  },
  description:
    'Vehicle export management — CRM, inventory, auctions, invoicing, payments, and shipping.',
  manifest: '/manifest.webmanifest',
  applicationName: 'ERP',
  themeColor: '#E8EAED',
  appleWebApp: {
    capable: true,
    title: 'ERP',
    statusBarStyle: 'default',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${oswald.variable} ${barlow.variable} ${notoSansJp.variable} ${jetbrainsMono.variable} font-sans`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" enableSystem={false}>
          <LocaleProvider>
            <AuthProvider>
              {children}
              <Toaster richColors closeButton position="top-center" />
            </AuthProvider>
          </LocaleProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
