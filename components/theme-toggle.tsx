'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        className={`flex items-center justify-center w-10 h-10 md:w-9 md:h-9 rounded-md hover:bg-accent transition-colors ${className}`}
      >
        <Sun className="w-4 h-4 text-muted-foreground" />
      </button>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`flex items-center justify-center w-10 h-10 md:w-9 md:h-9 rounded-md hover:bg-accent transition-colors ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-muted-foreground" />
      ) : (
        <Moon className="w-4 h-4 text-muted-foreground" />
      )}
    </button>
  );
}
