'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PublicShell } from '@/components/public/public-shell';
import { supabase } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  author_name: string | null;
};

export default function BlogIndexPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('id, slug, title, excerpt, category, cover_image_url, published_at, author_name')
        .eq('is_published', true)
        .order('published_at', { ascending: false });
      setPosts((data || []) as BlogPost[]);
      setLoading(false);
    })();
  }, []);

  return (
    <PublicShell>
      <section className="jct-home-wrap py-12 md:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--jct-vermilion)]">Insights</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-[var(--jct-navy)] md:text-4xl">Export blog</h1>
        <p className="mt-3 max-w-xl text-sm text-[var(--jct-muted)]">
          Practical guides for importers, dealers, and fleet buyers sourcing from Japan.
        </p>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-[var(--jct-muted-2)]">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading posts…
          </div>
        ) : posts.length === 0 ? (
          <p className="mt-12 text-sm text-[var(--jct-muted-2)]">No published posts yet.</p>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group overflow-hidden rounded-2xl border border-[var(--jct-border)] bg-white hover:border-[var(--jct-navy)]/30"
              >
                <div className="h-36 overflow-hidden bg-[var(--jct-panel)]">
                  {post.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.cover_image_url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="h-full w-full bg-[var(--jct-navy)]" />
                  )}
                </div>
                <div className="p-5">
                  <p className="text-xs uppercase tracking-wider text-[var(--jct-vermilion)]">{post.category || 'Guide'}</p>
                  <h2 className="mt-1 line-clamp-2 text-lg font-semibold text-[var(--jct-navy)]">{post.title}</h2>
                  {post.excerpt && <p className="mt-2 line-clamp-2 text-sm text-[var(--jct-muted)]">{post.excerpt}</p>}
                  <p className="mt-3 text-xs text-[var(--jct-muted-2)]">
                    {post.published_at ? new Date(post.published_at).toLocaleDateString() : ''}{post.author_name ? ` · ${post.author_name}` : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
