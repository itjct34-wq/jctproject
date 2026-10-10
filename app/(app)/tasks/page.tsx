'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, MoreVertical, Loader2, CheckSquare, Clock, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { supabase } from '@/lib/supabase/client';
import type { Profile, Task } from '@/lib/types';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface TaskWithAssignee extends Task {
  assignee_name?: string;
  assigner_name?: string;
}

export default function TasksPage() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<TaskWithAssignee[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithAssignee | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [form, setForm] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium',
    due_date: '',
  });

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const { data: taskData } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (!taskData || taskData.length === 0) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const userIds = Array.from(new Set(
      taskData.flatMap((t: Task) => [t.assigned_to, t.assigned_by].filter(Boolean) as string[])
    ));

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    const nameMap: Record<string, string> = {};
    profileData?.forEach((p) => {
      nameMap[p.id] = p.full_name || p.email;
    });

    const enriched = taskData.map((t: Task) => ({
      ...t,
      assignee_name: nameMap[t.assigned_to] || 'Unknown',
      assigner_name: t.assigned_by ? nameMap[t.assigned_by] : undefined,
    }));

    setTasks(enriched);
    setLoading(false);
  }, []);

  const loadProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('full_name', { ascending: true });
    if (data) setProfiles(data as Profile[]);
  }, []);

  useEffect(() => {
    loadTasks();
    loadProfiles();
  }, [loadTasks, loadProfiles]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.assigned_to || !profile) return;
    setSubmitting(true);

    const { error } = await supabase.from('tasks').insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      assigned_to: form.assigned_to,
      assigned_by: profile.id,
      priority: form.priority,
      due_date: form.due_date || null,
    });

    setSubmitting(false);

    if (error) {
      toast.error('Failed to create task: ' + error.message);
      return;
    }

    toast.success('Task created successfully');
    setForm({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' });
    setDialogOpen(false);
    loadTasks();
  };

  const openEdit = (task: TaskWithAssignee) => {
    setEditingTask(task);
    setForm({ title: task.title, description: task.description || '', assigned_to: task.assigned_to || '', priority: task.priority, due_date: task.due_date || '' });
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !form.title.trim() || !form.assigned_to) return;
    setSubmitting(true);
    const { error } = await supabase.from('tasks').update({
      title: form.title.trim(),
      description: form.description.trim() || null,
      assigned_to: form.assigned_to,
      priority: form.priority,
      due_date: form.due_date || null,
    }).eq('id', editingTask.id);
    setSubmitting(false);
    if (error) { toast.error('Failed to update task: ' + error.message); return; }
    toast.success('Task updated'); setEditOpen(false); setEditingTask(null); loadTasks();
  };

  const confirmDelete = async () => {
    if (!editingTask) return;
    setSubmitting(true);
    const { error } = await supabase.from('tasks').delete().eq('id', editingTask.id);
    setSubmitting(false);
    if (error) { toast.error('Failed to delete: ' + error.message); return; }
    toast.success('Task deleted'); setDeleteOpen(false); setEditingTask(null); loadTasks();
  };

  const updateStatus = async (taskId: string, status: string) => {
    const updates: Record<string, unknown> = { status };
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    } else {
      updates.completed_at = null;
    }

    const { error } = await supabase.from('tasks').update(updates).eq('id', taskId);

    if (error) {
      toast.error('Failed to update task: ' + error.message);
      return;
    }

    toast.success('Task status updated');
    loadTasks();
  };

  const filtered = filterStatus === 'all'
    ? tasks
    : tasks.filter((t) => t.status === filterStatus);

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    overdue: tasks.filter((t) => {
      if (t.status === 'completed' || t.status === 'cancelled' || !t.due_date) return false;
      return t.due_date < format(new Date(), 'yyyy-MM-dd');
    }).length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks & Approvals"
        description="Manage tasks, approvals, and assignments across the team"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1.5" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Enter task title"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Add details..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Assign To *</Label>
                    <Select
                      value={form.assigned_to}
                      onValueChange={(v) => setForm({ ...form, assigned_to: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name || p.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={form.priority}
                      onValueChange={(v) => setForm({ ...form, priority: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={submitting || !form.title.trim() || !form.assigned_to}>
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Task'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/60">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-warning/10">
              <Clock className="w-4 h-4 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-lg font-bold">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-info/10">
              <Clock className="w-4 h-4 text-info" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">In Progress</p>
              <p className="text-lg font-bold">{stats.inProgress}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-success/10">
              <CheckSquare className="w-4 h-4 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-lg font-bold">{stats.completed}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-destructive/10">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className="text-lg font-bold">{stats.overdue}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tasks</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No tasks found. Create one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Task</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium text-foreground">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {task.assignee_name}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={task.priority} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={task.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {task.due_date
                        ? format(new Date(task.due_date), 'MMM d, yyyy')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-accent">
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {task.status !== 'in_progress' && task.status !== 'completed' && (
                            <DropdownMenuItem onClick={() => updateStatus(task.id, 'in_progress')}>
                              Start Task
                            </DropdownMenuItem>
                          )}
                          {task.status !== 'completed' && (
                            <DropdownMenuItem onClick={() => updateStatus(task.id, 'completed')}>
                              Mark Completed
                            </DropdownMenuItem>
                          )}
                          {task.status === 'in_progress' && (
                            <DropdownMenuItem onClick={() => updateStatus(task.id, 'pending')}>
                              Set Pending
                            </DropdownMenuItem>
                          )}
                          {task.status !== 'cancelled' && (
                            <DropdownMenuItem
                              onClick={() => updateStatus(task.id, 'cancelled')}
                              className="text-destructive"
                            >
                              Cancel Task
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openEdit(task)}>
                            <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit Task
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => { setEditingTask(task); setDeleteOpen(true); }}
                            className="text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Task
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input id="edit-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea id="edit-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Assign To *</Label>
                <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                  <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-due-date">Due Date</Label>
              <Input id="edit-due-date" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Saving...</> : 'Save Changes'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete task?"
        description="This will permanently remove the task. This action cannot be undone."
        confirmLabel="Delete permanently"
        destructive
        loading={submitting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
