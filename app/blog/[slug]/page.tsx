'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
      <article className="mx-auto max-w-3xl px-4 sm:px-6 py-12 md:py-16">
        <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> All posts
        </Link>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : !post ? (
          <div className="mt-12 text-center">
            <p className="text-white font-medium">Post not found</p>
            <Link href="/blog" className="mt-4 inline-block text-sm text-red-400">Back to blog</Link>
          </div>
        ) : (
          <>
            <p className="mt-8 text-[10px] uppercase tracking-wider text-red-400">{post.category || 'Guide'}</p>
            <h1 className="mt-2 text-3xl md:text-4xl font-bold text-white leading-tight">{post.title}</h1>
            <p className="mt-3 text-sm text-zinc-500">
              {post.published_at ? new Date(post.published_at).toLocaleDateString() : ''}
              {post.author_name ? ` · ${post.author_name}` : ''}
            </p>
            {post.cover_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.cover_image_url} alt="" className="mt-8 w-full rounded-2xl border border-white/10 object-cover max-h-80" />
            )}
            <div className="mt-8 prose prose-invert prose-sm max-w-none text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {post.body}
            </div>
          </>
        )}
      </article>
    </PublicShell>
  );
}
