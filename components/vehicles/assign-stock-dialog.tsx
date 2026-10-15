'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import type { Vehicle } from '@/lib/types';

type AgentOption = { id: string; label: string };

const AGENT_ROLES = new Set(['sales_agent', 'freelancer']);

function profileLabel(p: {
  id: string;
  full_name: string | null;
  display_name?: string | null;
  email: string | null;
}) {
  return p.full_name?.trim() || p.display_name?.trim() || p.email || p.id.slice(0, 8);
}

export type AssignStockDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | null;
  currentUserId?: string | null;
  onAssigned: (result: { vehicle: Vehicle; agentId: string; agentName: string }) => void;
};

export function AssignStockDialog({
  open,
  onOpenChange,
  vehicle,
  currentUserId,
  onAssigned,
}: AssignStockDialogProps) {
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [agentId, setAgentId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAgents = useCallback(async () => {
    setLoadingAgents(true);
    const [{ data: profiles }, { data: roleRows }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, display_name, email, is_active')
        .eq('is_active', true)
        .order('full_name')
        .limit(250),
      supabase.from('user_roles').select('user_id, is_active, roles(name)').eq('is_active', true),
    ]);
    const profilesList = (profiles || []) as Array<{
      id: string;
      full_name: string | null;
      display_name: string | null;
      email: string | null;
    }>;
    const allowedIds = new Set<string>();
    const roleUserIds = new Set<string>();
    for (const row of roleRows || []) {
      const r = row as {
        user_id: string;
        roles?: { name: string } | { name: string }[] | null;
      };
      roleUserIds.add(r.user_id);
      const role = Array.isArray(r.roles) ? r.roles[0] : r.roles;
      if (role?.name && AGENT_ROLES.has(role.name)) allowedIds.add(r.user_id);
    }
    const filtered =
      roleUserIds.size > 1 && allowedIds.size > 0
        ? profilesList.filter((p) => allowedIds.has(p.id))
        : profilesList;
    setAgents(filtered.map((p) => ({ id: p.id, label: profileLabel(p) })));
    setLoadingAgents(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    setAgentId(vehicle?.assigned_agent_id || currentUserId || '');
    void loadAgents();
  }, [open, vehicle?.assigned_agent_id, currentUserId, loadAgents]);

  const selectedLabel = useMemo(
    () => agents.find((a) => a.id === agentId)?.label || '',
    [agents, agentId]
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicle || !agentId) {
      toast.error('Select an agent');
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from('vehicles')
      .update({
        assigned_agent_id: agentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vehicle.id)
      .select('*')
      .maybeSingle();
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const updated = (data as Vehicle | null) || { ...vehicle, assigned_agent_id: agentId };
    onAssigned({
      vehicle: updated,
      agentId,
      agentName: selectedLabel || 'agent',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign stock</DialogTitle>
          <DialogDescription>
            {vehicle
              ? `Assign ${vehicle.stock_number} to a sales agent so they can reserve it from Cars.`
              : 'Pick a sales agent for this unit.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assign-agent">Sales agent</Label>
            {loadingAgents ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading agents…
              </div>
            ) : (
              <Select value={agentId || undefined} onValueChange={setAgentId}>
                <SelectTrigger id="assign-agent">
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !agentId || loadingAgents}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
