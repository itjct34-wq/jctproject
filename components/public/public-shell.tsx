import { HomeFooter } from './home/home-footer';
import { HomeHeader } from './home/home-header';
import { TopNotice } from './home/top-notice';

/** Public marketing site uses the JCT navy/red light shell, independent of ERP theme. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="jct-home public-site min-h-screen flex flex-col">
      <TopNotice />
      <HomeHeader />
      <main className="flex-1">{children}</main>
      <HomeFooter />
    </div>
  );
}
