import Link from 'next/link';
import { PublicShell } from '@/components/public/public-shell';
import { BLOG_POSTS } from '@/lib/content/blog';
import { ArrowRight, Ship, ShieldCheck, Gavel, Globe2 } from 'lucide-react';

export default function HomePage() {
  return (
    <PublicShell>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-red-950/40" />
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-red-600/40 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-20 md:py-28">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-red-400 mb-4">
            Nagoya · Japan Export
          </p>
          <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-[1.1]">
            Premium used vehicles from Japan, shipped worldwide.
          </h1>
          <p className="mt-6 max-w-xl text-base sm:text-lg text-zinc-400 leading-relaxed">
            Japan Circular Trading sources auction-grade stock, manages documentation, and delivers
            via RORO or container under FOB, C&amp;F, and CIF — for dealers and private buyers.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/inventory"
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-500 transition-colors"
            >
              Browse inventory <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white hover:bg-white/5 transition-colors"
            >
              Request a quote
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-zinc-900/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { label: 'Export hub', value: 'Nagoya' },
            { label: 'Shipping', value: 'RORO · Container' },
            { label: 'Incoterms', value: 'FOB · C&F · CIF' },
            { label: 'Markets', value: 'Worldwide' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-lg font-semibold text-white">{s.value}</p>
              <p className="text-xs text-zinc-500 mt-1 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 md:py-20">
        <h2 className="text-2xl md:text-3xl font-bold text-white">End-to-end export expertise</h2>
        <p className="mt-2 text-zinc-400 max-w-2xl text-sm md:text-base">
          From auction floor to your destination port — one accountable partner in Japan.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Gavel, title: 'Auction sourcing', desc: 'USS, CAA and partner houses. Bid execution with clear grade targets.' },
            { icon: ShieldCheck, title: 'Quality control', desc: 'Sheet review, optional inspection, and honest condition reporting.' },
            { icon: Ship, title: 'RORO & containers', desc: '20ft / 40ft and RORO vessels from major Japanese ports.' },
            { icon: Globe2, title: 'Global delivery', desc: 'Documentation, BL, and Incoterms aligned to your market.' },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 hover:border-red-500/40 transition-colors"
            >
              <item.icon className="h-6 w-6 text-red-500 mb-3" />
              <h3 className="font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/5 bg-zinc-900/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-white">From the blog</h2>
              <p className="text-sm text-zinc-400 mt-1">Guides for importers and fleet buyers</p>
            </div>
            <Link href="/blog" className="text-sm text-red-400 hover:text-red-300">
              View all →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {BLOG_POSTS.slice(0, 3).map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group rounded-2xl border border-white/10 overflow-hidden hover:border-red-500/40 transition-colors"
              >
                <div className={`h-28 bg-gradient-to-br ${post.coverGradient}`} />
                <div className="p-4">
                  <p className="text-[10px] uppercase tracking-wider text-red-400">{post.category}</p>
                  <h3 className="mt-1 font-semibold text-white group-hover:text-red-100 transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="mt-2 text-xs text-zinc-500">{post.readTime} · {post.date}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
        <div className="rounded-3xl bg-gradient-to-r from-red-700 to-red-900 p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Ready to source from Japan?</h2>
          <p className="mt-3 text-red-100/90 text-sm md:text-base max-w-lg mx-auto">
            Tell us your destination, budget, and preferred models — we respond with available stock and freight options.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-red-700 hover:bg-zinc-100 transition-colors"
          >
            Contact sales
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
