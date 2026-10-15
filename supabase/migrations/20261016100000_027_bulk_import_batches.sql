/*
  Bulk import history for spreadsheet and photo ZIP batches.

  Staff who can create vehicles/auctions (admin, operations, manager) may
  select/insert batches and delete any row. Sales/freelancer have no access.
  Undo of created stock/photos is performed by the inventory staff API
  (service role) because vehicles DELETE remains admin-only in RLS.
*/

CREATE TABLE IF NOT EXISTS public.bulk_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('car', 'machinery', 'parts', 'auctions', 'photos')),
  source text NOT NULL CHECK (source IN ('sheet', 'zip')),
  filename text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted'))
);

CREATE INDEX IF NOT EXISTS bulk_import_batches_created_at_idx
  ON public.bulk_import_batches (created_at DESC);

CREATE INDEX IF NOT EXISTS bulk_import_batches_status_created_idx
  ON public.bulk_import_batches (status, created_at DESC);

ALTER TABLE public.bulk_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bulk_import_batches_select_staff" ON public.bulk_import_batches;
CREATE POLICY "bulk_import_batches_select_staff"
  ON public.bulk_import_batches FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR public.has_role('operations')
    OR public.has_role('manager')
  );

DROP POLICY IF EXISTS "bulk_import_batches_insert_staff" ON public.bulk_import_batches;
CREATE POLICY "bulk_import_batches_insert_staff"
  ON public.bulk_import_batches FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.is_admin_user()
      OR public.has_role('operations')
      OR public.has_role('manager')
    )
  );

DROP POLICY IF EXISTS "bulk_import_batches_update_staff" ON public.bulk_import_batches;
CREATE POLICY "bulk_import_batches_update_staff"
  ON public.bulk_import_batches FOR UPDATE TO authenticated
  USING (
    public.is_admin_user()
    OR public.has_role('operations')
    OR public.has_role('manager')
  )
  WITH CHECK (
    public.is_admin_user()
    OR public.has_role('operations')
    OR public.has_role('manager')
  );

DROP POLICY IF EXISTS "bulk_import_batches_delete_staff" ON public.bulk_import_batches;
CREATE POLICY "bulk_import_batches_delete_staff"
  ON public.bulk_import_batches FOR DELETE TO authenticated
  USING (
    public.is_admin_user()
    OR public.has_role('operations')
    OR public.has_role('manager')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bulk_import_batches TO authenticated;
GRANT ALL ON public.bulk_import_batches TO service_role;
