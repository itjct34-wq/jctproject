import { SiteHeader } from './site-header';
import { SiteFooter } from './site-footer';

/** Public marketing site is always light, independent of ERP dark mode. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-site min-h-screen bg-white text-zinc-900 flex flex-col">
      <SiteHeader />
      <main className="flex-1 bg-zinc-50 text-zinc-900">{children}</main>
      <SiteFooter />
    </div>
  );
}
