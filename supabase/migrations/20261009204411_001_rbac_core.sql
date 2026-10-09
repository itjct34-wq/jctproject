/*
# RBAC Core Foundation - Japan Circular Trading Mini ERP

Creates the foundational database schema for role-based access control,
user management, teams, company settings, and audit logging.

## New Tables

1. **profiles** - Extends auth.users with ERP-specific profile data
2. **roles** - Defines the 8 ERP roles
3. **permissions** - Granular permissions per module and action
4. **role_permissions** - Many-to-many mapping between roles and permissions
5. **user_roles** - Maps users to roles (a user can have multiple roles)
6. **teams** - Team/department groupings
7. **team_members** - Maps users to teams with optional team lead flag
8. **company_settings** - Single-row table for company configuration
9. **audit_logs** - Immutable record of sensitive operations
10. **notifications** - In-app notifications for users
11. **tasks** - Assignable tasks linked to various record types

## Security

- RLS enabled on ALL tables
- Policies use auth.uid() for ownership checks
- Profiles: users can view all profiles, edit only their own (admins can edit any)
- Roles/permissions: readable by all authenticated users, writable only by super_admin
- Team membership checks via subqueries
- Audit logs: insert by any authenticated user, read restricted to admin/auditor
- Company settings: readable by all, writable only by super_admin/admin
- Notifications/tasks: owner-scoped with assignment support

## Notes

1. The first super_admin must be bootstrapped server-side, NOT through the app UI.
2. The handle_new_user trigger auto-creates a profile row when a user signs up.
3. Helper functions (has_role, has_permission, is_admin_user, is_super_admin) are
   SECURITY DEFINER for use in RLS policies.
4. A trigger prevents users from assigning roles to themselves (no self-escalation).
*/

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  display_name text,
  phone text,
  avatar_url text,
  job_title text,
  department text,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- ROLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  is_system_role boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- PERMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  action text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module, action)
);

-- ============================================
-- ROLE_PERMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);

-- ============================================
-- USER_ROLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  assigned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);

-- ============================================
-- TEAMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  department text,
  manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- TEAM_MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_team_lead boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

-- ============================================
-- COMPANY_SETTINGS TABLE (single-row)
-- ============================================
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'Japan Circular Trading Co., Ltd.',
  legal_name text,
  logo_url text,
  address_line1 text,
  address_line2 text,
  city text DEFAULT 'Nagoya',
  prefecture text DEFAULT 'Aichi',
  postal_code text,
  country text DEFAULT 'Japan',
  phone text,
  email text,
  website text DEFAULT 'https://japancirculartrading.com/',
  tax_id text,
  default_currency text NOT NULL DEFAULT 'JPY',
  supported_currencies text[] NOT NULL DEFAULT ARRAY['JPY', 'USD'],
  invoice_prefix text NOT NULL DEFAULT 'JCT',
  invoice_next_number int NOT NULL DEFAULT 1,
  quotation_prefix text NOT NULL DEFAULT 'QUO',
  quotation_next_number int NOT NULL DEFAULT 1,
  payment_instructions text,
  bank_details jsonb,
  timezone text NOT NULL DEFAULT 'Asia/Tokyo',
  date_format text NOT NULL DEFAULT 'YYYY-MM-DD',
  reservation_default_days int NOT NULL DEFAULT 7,
  low_stock_alert_days int NOT NULL DEFAULT 60,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- AUDIT_LOGS TABLE (append-only)
-- ============================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  module text NOT NULL,
  record_id uuid,
  record_type text,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error', 'auction', 'payment', 'shipment', 'task', 'approval')),
  related_module text,
  related_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

-- ============================================
-- TASKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assigned_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date date,
  related_module text,
  related_id uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);

-- ============================================
-- HELPER FUNCTIONS (SECURITY DEFINER for RLS use)
-- Created after tables so they can reference them
-- ============================================

CREATE OR REPLACE FUNCTION public.has_role(_role_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name = _role_name
      AND ur.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_module text, _action text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
      AND p.module = _module
      AND p.action = _action
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name IN ('super_admin', 'admin')
      AND ur.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'super_admin'
      AND ur.is_active = true
  );
$$;

-- Prevent self-escalation
CREATE OR REPLACE FUNCTION public.check_self_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id = NEW.assigned_by THEN
    RAISE EXCEPTION 'Users cannot assign roles to themselves';
  END IF;
  RETURN NEW;
END;
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS prevent_self_role_assignment ON public.user_roles;
CREATE TRIGGER prevent_self_role_assignment
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_self_role_assignment();

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS roles_updated_at ON public.roles;
CREATE TRIGGER roles_updated_at BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS teams_updated_at ON public.teams;
CREATE TRIGGER teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS company_settings_updated_at ON public.company_settings;
CREATE TRIGGER company_settings_updated_at BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Profiles: all authenticated can view, users edit own, admins edit any
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
CREATE POLICY "profiles_insert_admin"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user() OR auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- Roles: all authenticated can view, only super_admin can modify
DROP POLICY IF EXISTS "roles_select_authenticated" ON public.roles;
CREATE POLICY "roles_select_authenticated"
  ON public.roles FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "roles_all_super_admin" ON public.roles;
CREATE POLICY "roles_all_super_admin"
  ON public.roles FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Permissions: all authenticated can view, only super_admin can modify
DROP POLICY IF EXISTS "permissions_select_authenticated" ON public.permissions;
CREATE POLICY "permissions_select_authenticated"
  ON public.permissions FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "permissions_all_super_admin" ON public.permissions;
CREATE POLICY "permissions_all_super_admin"
  ON public.permissions FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Role permissions: all authenticated can view, only super_admin can modify
DROP POLICY IF EXISTS "role_permissions_select_authenticated" ON public.role_permissions;
CREATE POLICY "role_permissions_select_authenticated"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "role_permissions_all_super_admin" ON public.role_permissions;
CREATE POLICY "role_permissions_all_super_admin"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- User roles: users can view own, admins can view all and manage
DROP POLICY IF EXISTS "user_roles_select_own_or_admin" ON public.user_roles;
CREATE POLICY "user_roles_select_own_or_admin"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_user());

DROP POLICY IF EXISTS "user_roles_insert_admin" ON public.user_roles;
CREATE POLICY "user_roles_insert_admin"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "user_roles_update_admin" ON public.user_roles;
CREATE POLICY "user_roles_update_admin"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "user_roles_delete_admin" ON public.user_roles;
CREATE POLICY "user_roles_delete_admin"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_admin_user());

-- Teams: visible to members, their managers, and admins
DROP POLICY IF EXISTS "teams_select_authenticated" ON public.teams;
CREATE POLICY "teams_select_authenticated"
  ON public.teams FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = teams.id AND tm.user_id = auth.uid()
    )
    OR teams.manager_id = auth.uid()
  );

DROP POLICY IF EXISTS "teams_all_admin" ON public.teams;
CREATE POLICY "teams_all_admin"
  ON public.teams FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Team members: visible to the user, team manager, and admins
DROP POLICY IF EXISTS "team_members_select_authenticated" ON public.team_members;
CREATE POLICY "team_members_select_authenticated"
  ON public.team_members FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_admin_user()
    OR EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id AND t.manager_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "team_members_all_admin" ON public.team_members;
CREATE POLICY "team_members_all_admin"
  ON public.team_members FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Company settings: all authenticated can view, admins can edit
DROP POLICY IF EXISTS "company_settings_select_authenticated" ON public.company_settings;
CREATE POLICY "company_settings_select_authenticated"
  ON public.company_settings FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "company_settings_update_admin" ON public.company_settings;
CREATE POLICY "company_settings_update_admin"
  ON public.company_settings FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "company_settings_insert_admin" ON public.company_settings;
CREATE POLICY "company_settings_insert_admin"
  ON public.company_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

-- Audit logs: admin/auditor can read, any authenticated can insert, no update/delete
DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_admin_user() OR public.has_role('auditor'));

DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_authenticated"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- Notifications: owner-scoped
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert_own_or_admin" ON public.notifications;
CREATE POLICY "notifications_insert_own_or_admin"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin_user());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Tasks: visible to assignee, assigner, and admins
DROP POLICY IF EXISTS "tasks_select_assigned_or_admin" ON public.tasks;
CREATE POLICY "tasks_select_assigned_or_admin"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    auth.uid() = assigned_to
    OR auth.uid() = assigned_by
    OR public.is_admin_user()
  );

DROP POLICY IF EXISTS "tasks_insert_admin_or_assigner" ON public.tasks;
CREATE POLICY "tasks_insert_admin_or_assigner"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_user()
    OR auth.uid() = assigned_by
    OR auth.uid() = assigned_to
  );

DROP POLICY IF EXISTS "tasks_update_assigned_or_admin" ON public.tasks;
CREATE POLICY "tasks_update_assigned_or_admin"
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    auth.uid() = assigned_to
    OR auth.uid() = assigned_by
    OR public.is_admin_user()
  )
  WITH CHECK (
    auth.uid() = assigned_to
    OR auth.uid() = assigned_by
    OR public.is_admin_user()
  );

DROP POLICY IF EXISTS "tasks_delete_admin" ON public.tasks;
CREATE POLICY "tasks_delete_admin"
  ON public.tasks FOR DELETE TO authenticated
  USING (public.is_admin_user());

-- ============================================
-- SEED: ROLES
-- ============================================
INSERT INTO public.roles (name, display_name, description, sort_order, is_system_role) VALUES
  ('super_admin', 'Super Admin', 'Full system configuration and access', 1, true),
  ('admin', 'Admin', 'Manage customers, inventory, purchases, invoices, payments, shipments', 2, true),
  ('operations', 'Operations', 'Manage auction purchases, yard, inspections, shipments, documents', 3, true),
  ('manager', 'Manager', 'View team members, review quotations, approve transactions when authorized', 4, true),
  ('sales_agent', 'Sales Agent', 'Manage assigned customers, enquiries, quotations, follow-ups, orders', 5, true),
  ('freelancer', 'Freelancer', 'Access only assigned customers and tasks, limited access', 6, true),
  ('accounts', 'Accounts / Finance', 'Manage receipts, payments, expenses, financial reports', 7, true),
  ('auditor', 'Read-only Auditor', 'Read authorized records and audit trails without modifications', 8, true)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- SEED: PERMISSIONS
-- ============================================
INSERT INTO public.permissions (module, action, description) VALUES
  ('dashboard', 'view', 'View dashboard'),
  ('customers', 'view', 'View customers'),
  ('customers', 'create', 'Create customers'),
  ('customers', 'edit', 'Edit customers'),
  ('customers', 'delete', 'Delete customers'),
  ('customers', 'export', 'Export customer data'),
  ('customers', 'assign', 'Assign customers to agents'),
  ('vehicles', 'view', 'View vehicle inventory'),
  ('vehicles', 'create', 'Create vehicles'),
  ('vehicles', 'edit', 'Edit vehicles'),
  ('vehicles', 'delete', 'Delete vehicles'),
  ('vehicles', 'export', 'Export vehicle data'),
  ('vehicles', 'import', 'Bulk import vehicles'),
  ('vehicles', 'view_costs', 'View purchase costs and margins'),
  ('auctions', 'view', 'View auction stock'),
  ('auctions', 'create', 'Create auction watchlist entries'),
  ('auctions', 'edit', 'Edit auction bids'),
  ('auctions', 'approve_bid', 'Approve auction bids'),
  ('auctions', 'export', 'Export auction data'),
  ('purchases', 'view', 'View purchase orders'),
  ('purchases', 'create', 'Create purchase orders'),
  ('purchases', 'edit', 'Edit purchase orders'),
  ('purchases', 'approve', 'Approve purchase orders'),
  ('purchases', 'cancel', 'Cancel purchase orders'),
  ('sales', 'view', 'View sales and reservations'),
  ('sales', 'create', 'Create quotations and reservations'),
  ('sales', 'edit', 'Edit quotations and reservations'),
  ('sales', 'approve', 'Approve quotations'),
  ('sales', 'cancel', 'Cancel reservations'),
  ('invoices', 'view', 'View invoices'),
  ('invoices', 'create', 'Create invoices'),
  ('invoices', 'edit', 'Edit invoices'),
  ('invoices', 'finalize', 'Finalize invoices'),
  ('invoices', 'cancel', 'Cancel invoices'),
  ('invoices', 'credit_note', 'Issue credit notes'),
  ('invoices', 'export', 'Export invoice data'),
  ('payments', 'view', 'View payments'),
  ('payments', 'create', 'Record payments'),
  ('payments', 'edit', 'Edit payments'),
  ('payments', 'confirm', 'Confirm payments'),
  ('payments', 'reverse', 'Reverse payments'),
  ('payments', 'export', 'Export payment data'),
  ('payments', 'view_costs', 'View payment details and costs'),
  ('expenses', 'view', 'View expenses'),
  ('expenses', 'create', 'Create expenses'),
  ('expenses', 'edit', 'Edit expenses'),
  ('expenses', 'approve', 'Approve expenses'),
  ('expenses', 'export', 'Export expense data'),
  ('shipments', 'view', 'View shipments'),
  ('shipments', 'create', 'Create shipments'),
  ('shipments', 'edit', 'Edit shipments'),
  ('shipments', 'export', 'Export shipment data'),
  ('documents', 'view', 'View export documents'),
  ('documents', 'create', 'Upload documents'),
  ('documents', 'edit', 'Edit document metadata'),
  ('documents', 'delete', 'Delete documents'),
  ('documents', 'download', 'Download private documents'),
  ('tasks', 'view', 'View tasks'),
  ('tasks', 'create', 'Create tasks'),
  ('tasks', 'edit', 'Edit tasks'),
  ('tasks', 'approve', 'Approve/complete tasks'),
  ('tasks', 'assign', 'Assign tasks to users'),
  ('reports', 'view', 'View reports'),
  ('reports', 'view_financials', 'View financial reports'),
  ('reports', 'export', 'Export reports'),
  ('users', 'view', 'View users and teams'),
  ('users', 'create', 'Create users'),
  ('users', 'edit', 'Edit users'),
  ('users', 'delete', 'Delete users'),
  ('users', 'assign_roles', 'Assign roles to users'),
  ('users', 'assign_teams', 'Assign users to teams'),
  ('settings', 'view', 'View system configuration'),
  ('settings', 'edit', 'Edit system configuration'),
  ('audit', 'view', 'View audit logs'),
  ('notifications', 'view', 'View notifications'),
  ('notifications', 'manage', 'Manage notifications')
ON CONFLICT (module, action) DO NOTHING;

-- ============================================
-- SEED: ROLE_PERMISSIONS
-- ============================================
-- Super Admin: ALL permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'super_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Admin: everything except settings edit, user role assignment, user delete
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'admin'
  AND NOT (
    (p.module = 'settings' AND p.action = 'edit')
    OR (p.module = 'users' AND p.action = 'assign_roles')
    OR (p.module = 'users' AND p.action = 'delete')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Operations
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'operations'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    OR (p.module = 'vehicles' AND p.action IN ('view', 'create', 'edit', 'export', 'view_costs'))
    OR (p.module = 'auctions' AND p.action IN ('view', 'create', 'edit', 'export'))
    OR (p.module = 'purchases' AND p.action IN ('view', 'create', 'edit'))
    OR (p.module = 'shipments' AND p.action IN ('view', 'create', 'edit', 'export'))
    OR (p.module = 'documents' AND p.action IN ('view', 'create', 'edit', 'download'))
    OR (p.module = 'tasks' AND p.action IN ('view', 'create', 'edit', 'assign'))
    OR (p.module = 'notifications' AND p.action IN ('view', 'manage'))
    OR (p.module = 'reports' AND p.action IN ('view', 'export'))
    OR (p.module = 'customers' AND p.action = 'view')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manager
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'manager'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    OR (p.module = 'customers' AND p.action IN ('view', 'export'))
    OR (p.module = 'vehicles' AND p.action IN ('view', 'export'))
    OR (p.module = 'sales' AND p.action IN ('view', 'create', 'edit', 'approve', 'cancel'))
    OR (p.module = 'invoices' AND p.action IN ('view', 'export'))
    OR (p.module = 'payments' AND p.action = 'view')
    OR (p.module = 'shipments' AND p.action = 'view')
    OR (p.module = 'tasks' AND p.action IN ('view', 'create', 'edit', 'approve', 'assign'))
    OR (p.module = 'notifications' AND p.action IN ('view', 'manage'))
    OR (p.module = 'reports' AND p.action IN ('view', 'export'))
    OR (p.module = 'users' AND p.action = 'view')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Sales Agent
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'sales_agent'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    OR (p.module = 'customers' AND p.action IN ('view', 'create', 'edit'))
    OR (p.module = 'vehicles' AND p.action = 'view')
    OR (p.module = 'sales' AND p.action IN ('view', 'create', 'edit'))
    OR (p.module = 'invoices' AND p.action IN ('view', 'create'))
    OR (p.module = 'payments' AND p.action = 'view')
    OR (p.module = 'tasks' AND p.action IN ('view', 'create', 'edit'))
    OR (p.module = 'notifications' AND p.action IN ('view', 'manage'))
    OR (p.module = 'reports' AND p.action = 'view')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Freelancer
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'freelancer'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    OR (p.module = 'customers' AND p.action IN ('view', 'edit'))
    OR (p.module = 'vehicles' AND p.action = 'view')
    OR (p.module = 'sales' AND p.action IN ('view', 'create', 'edit'))
    OR (p.module = 'tasks' AND p.action IN ('view', 'edit'))
    OR (p.module = 'notifications' AND p.action IN ('view', 'manage'))
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Accounts / Finance
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'accounts'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    OR (p.module = 'customers' AND p.action = 'view')
    OR (p.module = 'invoices' AND p.action IN ('view', 'create', 'edit', 'finalize', 'cancel', 'credit_note', 'export'))
    OR (p.module = 'payments' AND p.action IN ('view', 'create', 'edit', 'confirm', 'reverse', 'export', 'view_costs'))
    OR (p.module = 'expenses' AND p.action IN ('view', 'create', 'edit', 'approve', 'export'))
    OR (p.module = 'vehicles' AND p.action IN ('view', 'view_costs'))
    OR (p.module = 'tasks' AND p.action IN ('view', 'create', 'edit'))
    OR (p.module = 'notifications' AND p.action IN ('view', 'manage'))
    OR (p.module = 'reports' AND p.action IN ('view', 'view_financials', 'export'))
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Read-only Auditor
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'auditor'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    OR (p.module = 'customers' AND p.action = 'view')
    OR (p.module = 'vehicles' AND p.action IN ('view', 'view_costs'))
    OR (p.module = 'auctions' AND p.action = 'view')
    OR (p.module = 'purchases' AND p.action = 'view')
    OR (p.module = 'sales' AND p.action = 'view')
    OR (p.module = 'invoices' AND p.action IN ('view', 'export'))
    OR (p.module = 'payments' AND p.action IN ('view', 'view_costs', 'export'))
    OR (p.module = 'expenses' AND p.action IN ('view', 'export'))
    OR (p.module = 'shipments' AND p.action = 'view')
    OR (p.module = 'documents' AND p.action = 'view')
    OR (p.module = 'tasks' AND p.action = 'view')
    OR (p.module = 'reports' AND p.action IN ('view', 'view_financials', 'export'))
    OR (p.module = 'users' AND p.action = 'view')
    OR (p.module = 'settings' AND p.action = 'view')
    OR (p.module = 'audit' AND p.action = 'view')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- SEED: COMPANY SETTINGS (single row)
-- ============================================
INSERT INTO public.company_settings (company_name, legal_name, address_line1, city, prefecture, country, phone, email, website)
VALUES (
  'Japan Circular Trading Co., Ltd.',
  'Japan Circular Trading Co., Ltd.',
  '1-2-3 Minato-ku',
  'Nagoya',
  'Aichi',
  'Japan',
  '+81-52-000-0000',
  'info@japancirculartrading.com',
  'https://japancirculartrading.com/'
)
ON CONFLICT DO NOTHING;