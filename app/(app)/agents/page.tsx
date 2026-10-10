'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Plus, Pencil, Trash2, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';

type Agent = {
  id: string;
  agent_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  is_active: boolean;
  verified_until: string | null;
};

const empty = {
  agent_code: '',
  full_name: '',
  email: '',
  phone: '',
  title: 'Sales Agent',
  is_active: true,
  verified_until: '',
};

export default function AgentsPage() {
  const { profile } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('agent_verifications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    else setAgents((data || []) as Agent[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...empty,
      agent_code: `JCT-AGT-${String(agents.length + 1).padStart(3, '0')}`,
    });
    setOpen(true);
  };

  const openEdit = (a: Agent) => {
    setEditing(a);
    setForm({
      agent_code: a.agent_code,
      full_name: a.full_name,
      email: a.email || '',
      phone: a.phone || '',
      title: a.title || 'Sales Agent',
      is_active: a.is_active,
      verified_until: a.verified_until || '',
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.agent_code.trim()) return;
    setSubmitting(true);
    const row = {
      agent_code: form.agent_code.trim().toUpperCase(),
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      title: form.title.trim() || 'Sales Agent',
      is_active: form.is_active,
      verified_until: form.verified_until || null,
      created_by: profile?.id || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing
      ? await supabase.from('agent_verifications').update(row).eq('id', editing.id)
      : await supabase.from('agent_verifications').insert(row);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? 'Agent updated' : 'Agent code created');
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this agent code?')) return;
    const { error } = await supabase.from('agent_verifications').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Deleted');
      load();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent verification"
        description="Issue codes buyers can verify at /verify-agent"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" /> New agent code
          </Button>
        }
      />

      <Card className="border-border/60 overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : agents.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No agent codes yet</div>
        ) : (
          <div className="divide-y">
            {agents.map((a) => (
              <div key={a.id} className="flex items-center gap-4 p-4">
                <BadgeCheck className={`h-5 w-5 ${a.is_active ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{a.full_name}</p>
                    <Badge variant={a.is_active ? 'default' : 'secondary'}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">{a.agent_code}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.title}{a.phone ? ` · ${a.phone}` : ''}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => remove(a.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit agent' : 'New agent code'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="space-y-2">
              <Label>Agent code *</Label>
              <Input
                value={form.agent_code}
                onChange={(e) => setForm({ ...form, agent_code: e.target.value.toUpperCase() })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Full name *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone / WhatsApp</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Valid until (optional)</Label>
              <Input type="date" value={form.verified_until} onChange={(e) => setForm({ ...form, verified_until: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Active (visible on public verify)
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
