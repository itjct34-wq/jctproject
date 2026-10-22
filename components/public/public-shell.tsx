import { HomeFooter } from './home/home-footer';
import { HomeHeader } from './home/home-header';
import { TopNotice } from './home/top-notice';
import { FloatingWhatsApp } from '@/components/public/floating-whatsapp';

/** Public catalog site — Enamel Yard Board world (shared tokens with ERP desk chrome). */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="jct-home public-site flex min-h-screen min-w-0 flex-col overflow-x-clip">
      <TopNotice />
      <HomeHeader />
      <main className="min-w-0 flex-1">{children}</main>
      <HomeFooter />
      <FloatingWhatsApp />
    </div>
  );
}
