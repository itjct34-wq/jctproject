import { PublicShell } from '@/components/public/public-shell';

export function HomeShell({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
