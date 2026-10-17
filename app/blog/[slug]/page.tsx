'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { PublicShell } from '@/components/public/public-shell';
import { supabase } from '@/lib/supabase/client';
import { ArrowLeft, Loader2 } from 'lucide-react';

type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  category: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  author_name: string | null;
};

export default function BlogPostPage() {
  const params = useParams();
  const slug = String(params?.slug || '');
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();
      setPost((data as BlogPost) || null);
      setLoading(false);
    })();
  }, [slug]);

  return (
    <PublicShell>
      <article className="jct-home-wrap max-w-3xl py-12 md:py-16">
        <Link href="/blog" className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--jct-muted)] hover:text-[var(--jct-navy)]">
          <ArrowLeft className="h-4 w-4" /> All posts
        </Link>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-[var(--jct-muted-2)]">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : !post ? (
          <div className="mt-12 text-center">
            <p className="font-medium text-[var(--jct-navy)]">Post not found</p>
            <Link href="/blog" className="mt-4 inline-block text-sm text-[var(--jct-vermilion)]">Back to blog</Link>
          </div>
        ) : (
          <>
            <p className="mt-8 text-xs uppercase tracking-wider text-[var(--jct-vermilion)]">{post.category || 'Guide'}</p>
            <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-[var(--jct-navy)] md:text-4xl">{post.title}</h1>
            <p className="mt-3 text-sm text-[var(--jct-muted-2)]">
              {post.published_at ? new Date(post.published_at).toLocaleDateString() : ''}
              {post.author_name ? ` · ${post.author_name}` : ''}
            </p>
            {post.cover_image_url && (
              <span className="relative mt-8 block h-80 w-full overflow-hidden rounded-2xl border border-[var(--jct-border)]">
                <Image
                  src={post.cover_image_url}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 720px"
                  className="object-cover"
                  priority
                />
              </span>
            )}
            <div className="mt-8 max-w-none whitespace-pre-wrap text-sm leading-relaxed text-[var(--jct-muted)]">
              {post.body}
            </div>
          </>
        )}
      </article>
    </PublicShell>
  );
}
