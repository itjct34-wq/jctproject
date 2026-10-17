import './globals.css';
import type { Metadata } from 'next';
import { JetBrains_Mono, Noto_Sans_JP, Outfit } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { LocaleProvider } from '@/lib/i18n/locale-provider';
import { Toaster } from '@/components/ui/sonner';

const outfit = Outfit({
  subsets: ['latin'],
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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f14' },
  ],
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
        className={`${outfit.variable} ${notoSansJp.variable} ${jetbrainsMono.variable} font-sans`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <LocaleProvider>
            <AuthProvider>
              {children}
              <Toaster richColors closeButton position="top-center" />
            </AuthProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
