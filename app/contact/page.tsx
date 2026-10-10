'use client';

import { PublicShell } from '@/components/public/public-shell';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Inquiry from ${name || 'website'}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
    window.location.href = `mailto:info@japancirculartrading.com?subject=${subject}&body=${body}`;
    toast.success('Opening your email client…');
  };

  return (
    <PublicShell>
      <section className="mx-auto max-w-xl px-4 sm:px-6 py-16 md:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">Contact</p>
        <h1 className="mt-3 text-3xl font-bold text-white">Talk to our export team</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Share destination country, preferred models, and budget. We reply with availability and freight options.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label className="text-zinc-300">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required className="bg-zinc-900 border-white/10 text-white" />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-300">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-zinc-900 border-white/10 text-white" />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-300">Message</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} required className="bg-zinc-900 border-white/10 text-white" placeholder="Destination, models, quantity, Incoterms preference…" />
          </div>
          <Button type="submit" className="w-full bg-red-600 hover:bg-red-500">Send inquiry</Button>
        </form>
        <p className="mt-6 text-center text-xs text-zinc-500">
          Or call <a href="tel:+817022416356" className="text-red-400">+81 70-2241-6356</a>
        </p>
      </section>
    </PublicShell>
  );
}
