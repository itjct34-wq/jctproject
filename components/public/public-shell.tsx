import { SiteHeader } from './site-header';
import { SiteFooter } from './site-footer';

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col">
      <SiteHeader />
      <main className="flex-1 bg-zinc-50 text-zinc-900 [&_.text-white]:text-zinc-900 [&_.text-zinc-400]:text-zinc-600 [&_.text-zinc-500]:text-zinc-500 [&_.bg-zinc-950]:bg-white [&_.bg-zinc-900]:bg-white [&_.bg-zinc-900\/50]:bg-white [&_.bg-zinc-900\/60]:bg-white [&_.bg-zinc-900\/40]:bg-zinc-50 [&_.bg-zinc-900\/80]:bg-white [&_.border-white\/10]:border-zinc-200 [&_.border-white\/5]:border-zinc-100 [&_.border-white\/20]:border-zinc-200">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
