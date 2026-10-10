import Link from 'next/link';
import { PublicShell } from '@/components/public/public-shell';
import { BLOG_POSTS } from '@/lib/content/blog';

export const metadata = {
  title: 'Blog — Japan Circular Trading',
  description: 'Guides on buying used cars from Japan, shipping, and auctions.',
};

export default function BlogIndexPage() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12 md:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">Insights</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold text-white">Export blog</h1>
        <p className="mt-3 text-sm text-zinc-400 max-w-xl">
          Practical guides for importers, dealers, and fleet buyers sourcing from Japan.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {BLOG_POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group rounded-2xl border border-white/10 overflow-hidden hover:border-red-500/40 transition-colors"
            >
              <div className={`h-36 bg-gradient-to-br ${post.coverGradient}`} />
              <div className="p-5">
                <p className="text-[10px] uppercase tracking-wider text-red-400">{post.category}</p>
                <h2 className="mt-1 text-lg font-semibold text-white group-hover:text-red-50 line-clamp-2">
                  {post.title}
                </h2>
                <p className="mt-2 text-sm text-zinc-400 line-clamp-2">{post.excerpt}</p>
                <p className="mt-3 text-xs text-zinc-500">
                  {post.date} · {post.readTime}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
