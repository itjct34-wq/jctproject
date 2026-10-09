'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { PageHeader } from '@/components/layout/page-header';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ROLE_COLORS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import {
  Users,
  Car,
  Gavel,
  Receipt,
  CreditCard,
  Ship,
  CheckSquare,
  Bell,
  TrendingUp,
  DollarSign,
  Calendar,
  Clock,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';

interface DashboardData {
  totalUsers: number;
  activeUsers: number;
  totalTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  completedTasks: number;
  unreadNotifications: number;
  recentTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    assigned_to: string;
  }>;
  assigneeNames: Record<string, string>;
}

export default function DashboardPage() {
  const { profile, roles } = useAuth();
  const { isAdmin, isSuperAdmin, canView } = usePermissions();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      if (!profile) return;
      setLoading(true);

      const [usersRes, tasksRes, notifRes, recentTasksRes] = await Promise.all([
        supabase.from('profiles').select('id, is_active'),
        supabase.from('tasks').select('id, status, due_date'),
        supabase
          .from('notifications')
          .select('id')
          .eq('user_id', profile.id)
          .eq('is_read', false),
        supabase
          .from('tasks')
          .select('id, title, status, priority, due_date, assigned_to')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const totalUsers = usersRes.data?.length || 0;
      const activeUsers = usersRes.data?.filter((u) => u.is_active).length || 0;

      const allTasks = tasksRes.data || [];
      const now = format(new Date(), 'yyyy-MM-dd');
      const pendingTasks = allTasks.filter((t) => t.status === 'pending').length;
      const overdueTasks = allTasks.filter(
        (t) => t.status !== 'completed' && t.status !== 'cancelled' && t.due_date && t.due_date < now
      ).length;
      const completedTasks = allTasks.filter((t) => t.status === 'completed').length;

      const recentTasks = recentTasksRes.data || [];

      const assigneeIds = Array.from(new Set(recentTasks.map((t) => t.assigned_to)));
      const assigneeNames: Record<string, string> = {};
      if (assigneeIds.length > 0) {
        const { data: assignees } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', assigneeIds);
        assignees?.forEach((a) => {
          assigneeNames[a.id] = a.full_name || a.email;
        });
      }

      setData({
        totalUsers,
        activeUsers,
        totalTasks: allTasks.length,
        pendingTasks,
        overdueTasks,
        completedTasks,
        unreadNotifications: notifRes.data?.length || 0,
        recentTasks: recentTasks as DashboardData['recentTasks'],
        assigneeNames,
      });
      setLoading(false);
    }

    loadDashboard();
  }, [profile]);

  if (loading || !data) return <DashboardSkeleton />;

  const firstName = profile?.full_name?.split(' ')[0] || profile?.email?.split('@')[0] || 'there';
  const currentDate = format(new Date(), 'EEEE, MMMM d, yyyy');

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${firstName}`}
        description={`${currentDate} — Japan Circular Trading Co., Ltd. ERP System`}
      />

      {/* Role badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium">Your roles:</span>
        {roles.map((role) => (
          <span
            key={role.id}
            className={cn(
              'inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border',
              ROLE_COLORS[role.name]
            )}
          >
            {role.display_name}
          </span>
        ))}
      </div>

      {/* KPI Cards - Phase 1: user/task/notification metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {canView('users') && (
          <KpiCard
            label="Total Users"
            value={data.totalUsers}
            icon={<Users className="w-4 h-4" />}
            trend={{ value: 0, label: `${data.activeUsers} active` }}
            trendDirection="neutral"
          />
        )}
        {canView('tasks') && (
          <>
            <KpiCard
              label="Total Tasks"
              value={data.totalTasks}
              icon={<CheckSquare className="w-4 h-4" />}
              iconClassName="bg-info/10 text-info"
            />
            <KpiCard
              label="Pending Tasks"
              value={data.pendingTasks}
              icon={<Clock className="w-4 h-4" />}
              iconClassName="bg-warning/10 text-warning"
            />
            <KpiCard
              label="Overdue Tasks"
              value={data.overdueTasks}
              icon={<AlertTriangle className="w-4 h-4" />}
              iconClassName="bg-destructive/10 text-destructive"
            />
          </>
        )}
        <KpiCard
          label="Completed Tasks"
          value={data.completedTasks}
          icon={<CheckSquare className="w-4 h-4" />}
          iconClassName="bg-success/10 text-success"
        />
        <KpiCard
          label="Unread Alerts"
          value={data.unreadNotifications}
          icon={<Bell className="w-4 h-4" />}
          iconClassName="bg-primary/10 text-primary"
        />
      </div>

      {/* Phase 1 notice for business modules */}
      <Card className="border-info/30 bg-info/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 text-info shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Phase 1: Foundation Active</p>
              <p className="text-xs text-muted-foreground mt-1">
                Authentication, role-based access control, user management, and team management are operational.
                Business modules (CRM, inventory, auctions, invoicing, payments, shipping) will be activated in Phase 2-4.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Tasks */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Recent Tasks</CardTitle>
            <Link href="/tasks">
              <Button variant="ghost" size="sm" className="text-xs">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {data.recentTasks.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No tasks created yet
              </div>
            ) : (
              <div className="space-y-3">
                {data.recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Assigned to {data.assigneeNames[task.assigned_to] || 'Unknown'}
                        {task.due_date && ` · Due ${format(new Date(task.due_date), 'MMM d')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={task.priority} />
                      <StatusBadge status={task.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {canView('users') && (
              <Link href="/users">
                <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Manage Users & Teams</span>
                </div>
              </Link>
            )}
            {canView('tasks') && (
              <Link href="/tasks">
                <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                  <CheckSquare className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">View Tasks</span>
                </div>
              </Link>
            )}
            {canView('settings') && (isAdmin() || isSuperAdmin()) && (
              <Link href="/settings">
                <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">System Configuration</span>
                </div>
              </Link>
            )}
            {canView('audit') && (
              <Link href="/audit">
                <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Audit Logs</span>
                </div>
              </Link>
            )}
            <Link href="/notifications">
              <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Notifications</span>
                {data.unreadNotifications > 0 && (
                  <Badge className="ml-auto bg-primary text-primary-foreground text-[10px]">
                    {data.unreadNotifications}
                  </Badge>
                )}
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
