/*
# Vehicle inventory and status history

1. New Tables
- `vehicles`: Stock number, chassis identity, specifications, source, pricing, location, and lifecycle status.
- `vehicle_status_history`: Immutable-style operational history for vehicle status changes and notes.

2. Modified Tables
- None. The tables are ready to connect to purchases, sales, customers, and shipments in later phases.

3. Security
- Row Level Security is enabled on both tables.
- Authenticated operational roles can view inventory.
- Administrators, managers, and operations users can add or edit stock.
- Only administrators can delete stock records.
- Status history visibility follows inventory visibility; new history entries require an authenticated user.

4. Important Notes
- Chassis numbers are unique to prevent duplicate vehicle records.
- Stock numbers are generated from a database sequence.
- Purchase and listed prices are stored as numeric values with an explicit currency.
- Status changes are recorded separately so the stock lifecycle is auditable.
*/

CREATE SEQUENCE IF NOT EXISTS public.vehicle_stock_seq START WITH 1001;

CREATE OR REPLACE FUNCTION public.next_vehicle_stock_number()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT 'JCT-V-' || nextval('public.vehicle_stock_seq')::text;
$$;

CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_number text NOT NULL UNIQUE DEFAULT public.next_vehicle_stock_number(),
  chassis_number text NOT NULL UNIQUE,
  make text NOT NULL,
  model text NOT NULL,
  model_grade text,
  model_year integer CHECK (model_year IS NULL OR model_year BETWEEN 1950 AND 2100),
  registration_year integer CHECK (registration_year IS NULL OR registration_year BETWEEN 1950 AND 2100),
  color text,
  mileage_km integer CHECK (mileage_km IS NULL OR mileage_km >= 0),
  transmission text CHECK (transmission IS NULL OR transmission IN ('automatic', 'manual', 'cvt', 'other')),
  fuel_type text CHECK (fuel_type IS NULL OR fuel_type IN ('petrol', 'diesel', 'hybrid', 'electric', 'other')),
  source_country text,
  source_supplier text,
  purchase_price numeric(14,2),
  purchase_currency text NOT NULL DEFAULT 'JPY',
  listed_price numeric(14,2),
  listed_currency text NOT NULL DEFAULT 'JPY',
  status text NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'reserved', 'sold', 'in_transit', 'exported', 'on_hold', 'archived')),
  location text,
  arrival_date date,
  reserved_until date,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vehicle_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  note text,
  changed_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehicles_status_idx ON public.vehicles(status);
CREATE INDEX IF NOT EXISTS vehicles_make_model_idx ON public.vehicles(make, model);
CREATE INDEX IF NOT EXISTS vehicles_source_country_idx ON public.vehicles(source_country);
CREATE INDEX IF NOT EXISTS vehicles_arrival_date_idx ON public.vehicles(arrival_date);
CREATE INDEX IF NOT EXISTS vehicle_status_history_vehicle_id_idx ON public.vehicle_status_history(vehicle_id, created_at DESC);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicles_select_operations" ON public.vehicles;
CREATE POLICY "vehicles_select_operations" ON public.vehicles FOR SELECT TO authenticated
USING (is_admin_user() OR has_role('operations') OR has_role('manager') OR has_role('sales_agent') OR has_role('freelancer') OR has_role('auditor'));

DROP POLICY IF EXISTS "vehicles_insert_operations" ON public.vehicles;
CREATE POLICY "vehicles_insert_operations" ON public.vehicles FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND (is_admin_user() OR has_role('operations') OR has_role('manager')));

DROP POLICY IF EXISTS "vehicles_update_operations" ON public.vehicles;
CREATE POLICY "vehicles_update_operations" ON public.vehicles FOR UPDATE TO authenticated
USING (is_admin_user() OR has_role('operations') OR has_role('manager'))
WITH CHECK (is_admin_user() OR has_role('operations') OR has_role('manager'));

DROP POLICY IF EXISTS "vehicles_delete_admin" ON public.vehicles;
CREATE POLICY "vehicles_delete_admin" ON public.vehicles FOR DELETE TO authenticated
USING (is_admin_user());

DROP POLICY IF EXISTS "vehicle_history_select_inventory_access" ON public.vehicle_status_history;
CREATE POLICY "vehicle_history_select_inventory_access" ON public.vehicle_status_history FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id));

DROP POLICY IF EXISTS "vehicle_history_insert_operations" ON public.vehicle_status_history;
CREATE POLICY "vehicle_history_insert_operations" ON public.vehicle_status_history FOR INSERT TO authenticated
WITH CHECK (changed_by = auth.uid() AND (is_admin_user() OR has_role('operations') OR has_role('manager')));

DROP POLICY IF EXISTS "vehicle_history_update_admin" ON public.vehicle_status_history;
CREATE POLICY "vehicle_history_update_admin" ON public.vehicle_status_history FOR UPDATE TO authenticated
USING (is_admin_user())
WITH CHECK (is_admin_user());

DROP POLICY IF EXISTS "vehicle_history_delete_admin" ON public.vehicle_status_history;
CREATE POLICY "vehicle_history_delete_admin" ON public.vehicle_status_history FOR DELETE TO authenticated
USING (is_admin_user());
