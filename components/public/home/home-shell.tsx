import { IBM_Plex_Sans, Sora } from 'next/font/google';
import { HomeFooter } from './home-footer';
import { HomeHeader } from './home-header';
import { TopNotice } from './top-notice';

const sora = Sora({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-sora',
  display: 'swap',
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm',
  display: 'swap',
});

export function HomeShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${sora.variable} ${ibmPlexSans.variable} jct-home min-h-screen flex flex-col`}>
      <TopNotice />
      <HomeHeader />
      <main className="flex-1">{children}</main>
      <HomeFooter />
    </div>
  );
}
