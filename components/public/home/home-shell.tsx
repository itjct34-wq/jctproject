import { HomeFooter } from './home-footer';
import { HomeHeader } from './home-header';
import { TopNotice } from './top-notice';

export function HomeShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="jct-home min-h-screen flex flex-col">
      <TopNotice />
      <HomeHeader />
      <main className="flex-1">{children}</main>
      <HomeFooter />
    </div>
  );
}
