import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicShell } from '@/components/public/public-shell';
import { BLOG_POSTS, getPost } from '@/lib/content/blog';

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug);
  if (!post) return { title: 'Post not found' };
  return { title: `${post.title} — Japan Circular Trading`, description: post.excerpt };
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug);
  if (!post) notFound();

  return (
    <PublicShell>
      <article className="mx-auto max-w-3xl px-4 sm:px-6 py-12 md:py-16">
        <Link href="/blog" className="text-sm text-red-400 hover:text-red-300">
          ← All posts
        </Link>
        <p className="mt-6 text-[10px] uppercase tracking-wider text-red-400">{post.category}</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold text-white leading-tight">{post.title}</h1>
        <p className="mt-3 text-xs text-zinc-500">
          {post.date} · {post.readTime} read
        </p>
        <div className={`mt-8 h-40 rounded-2xl bg-gradient-to-br ${post.coverGradient}`} />
        <div className="mt-8 space-y-4 text-zinc-300 leading-relaxed text-[15px]">
          {post.content.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        <div className="mt-12 rounded-2xl border border-white/10 bg-zinc-900/50 p-6 text-center">
          <p className="text-white font-medium">Need stock for your market?</p>
          <Link
            href="/contact"
            className="mt-3 inline-flex rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-500"
          >
            Contact export sales
          </Link>
        </div>
      </article>
    </PublicShell>
  );
}
