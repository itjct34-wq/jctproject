'use client';

import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';

function whatsappHref(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_WHATSAPP ||
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ||
    '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

/** Site-wide floating WhatsApp CTA on public pages; hides while typing in forms. */
export function FloatingWhatsApp() {
  const [hidden, setHidden] = useState(false);
  const href = whatsappHref();

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) {
        setHidden(true);
      }
    };
    const onFocusOut = () => setHidden(false);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className={`fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-all hover:scale-105 active:scale-95 md:bottom-6 ${
        hidden ? 'pointer-events-none translate-y-4 opacity-0' : 'opacity-100'
      }`}
    >
      <MessageCircle className="h-7 w-7" fill="currentColor" aria-hidden />
    </a>
  );
}
