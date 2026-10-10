'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  category: string | null;
  cover_image_url: string | null;
  is_published: boolean;
  published_at: string | null;
  author_name: string | null;
};

const empty = {
  slug: '',
  title: '',
  excerpt: '',
  body: '',
  category: 'Guides',
  cover_image_url: '',
  is_published: true,
  author_name: '',
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export default function BlogAdminPage() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('blog_posts').select('*').order('updated_at', { ascending: false });
    if (error) toast.error(error.message);
    else setPosts((data || []) as Post[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...empty, author_name: profile?.full_name || '' });
    setOpen(true);
  };

  const openEdit = (p: Post) => {
    setEditing(p);
    setForm({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt || '',
      body: p.body || '',
      category: p.category || 'Guides',
      cover_image_url: p.cover_image_url || '',
      is_published: p.is_published,
      author_name: p.author_name || '',
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const slug = form.slug.trim() || slugify(form.title);
    setSubmitting(true);
    const row = {
      slug,
      title: form.title.trim(),
      excerpt: form.excerpt.trim() || null,
      body: form.body,
      category: form.category.trim() || null,
      cover_image_url: form.cover_image_url.trim() || null,
      is_published: form.is_published,
      published_at: form.is_published ? new Date().toISOString() : null,
      author_name: form.author_name.trim() || null,
      created_by: profile?.id || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing
      ? await supabase.from('blog_posts').update(row).eq('id', editing.id)
      : await supabase.from('blog_posts').insert(row);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? 'Post updated' : 'Post created');
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this post?')) return;
    const { error } = await supabase.from('blog_posts').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Deleted');
      load();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blog posts"
        description="Publish guides to the public site"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" /> New post
          </Button>
        }
      />

      <Card className="border-border/60 overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No posts yet</div>
        ) : (
          <div className="divide-y">
            {posts.map((p) => (
              <div key={p.id} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{p.title}</p>
                    <Badge variant={p.is_published ? 'default' : 'secondary'}>
                      {p.is_published ? 'Published' : 'Draft'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">/blog/{p.slug}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => remove(p.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit post' : 'New post'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm({
                    ...form,
                    title: e.target.value,
                    slug: editing ? form.slug : slugify(e.target.value),
                  })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Excerpt</Label>
              <Textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={8} />
            </div>
            <div className="space-y-2">
              <Label>Cover image URL</Label>
              <Input value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
              />
              Published on public site
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
