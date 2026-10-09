/*
# Supplier and auction house directory

1. New Tables
- `suppliers`: Supplier identity, type (auction_house, dealer, wholesaler, individual), contact details, country, payment terms, status, and notes.
- `supplier_contacts`: Additional people connected to a supplier account.

2. Modified Tables
- None. These tables are ready to connect to purchases and vehicles in later phases via supplier_id foreign keys.

3. Security
- Row Level Security is enabled on both tables.
- Authenticated operational roles can view suppliers.
- Administrators, managers, and operations users can add or edit suppliers.
- Only administrators can delete supplier records.
- Supplier contacts inherit access from their parent supplier.

4. Important Notes
- Supplier codes are generated from a database sequence.
- A unique constraint prevents duplicate supplier codes.
- Payment terms are stored as a structured text field for flexibility across currencies and regions.
*/

CREATE SEQUENCE IF NOT EXISTS public.supplier_code_seq START WITH 1001;

CREATE OR REPLACE FUNCTION public.next_supplier_code()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT 'JCT-S-' || nextval('public.supplier_code_seq')::text;
$$;

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code text NOT NULL UNIQUE DEFAULT public.next_supplier_code(),
  supplier_type text NOT NULL DEFAULT 'dealer' CHECK (supplier_type IN ('auction_house', 'dealer', 'wholesaler', 'individual')),
  name text NOT NULL,
  category text,
  country text,
  city text,
  address_line1 text,
  address_line2 text,
  email text,
  phone text,
  website text,
  contact_person text,
  payment_terms text,
  default_currency text NOT NULL DEFAULT 'JPY',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplier_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  role text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS suppliers_status_idx ON public.suppliers(status);
CREATE INDEX IF NOT EXISTS suppliers_supplier_type_idx ON public.suppliers(supplier_type);
CREATE INDEX IF NOT EXISTS suppliers_country_idx ON public.suppliers(country);
CREATE INDEX IF NOT EXISTS supplier_contacts_supplier_id_idx ON public.supplier_contacts(supplier_id);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_select_operations" ON public.suppliers;
CREATE POLICY "suppliers_select_operations" ON public.suppliers FOR SELECT TO authenticated
USING (is_admin_user() OR has_role('operations') OR has_role('manager') OR has_role('sales_agent') OR has_role('freelancer') OR has_role('auditor'));

DROP POLICY IF EXISTS "suppliers_insert_operations" ON public.suppliers;
CREATE POLICY "suppliers_insert_operations" ON public.suppliers FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND (is_admin_user() OR has_role('operations') OR has_role('manager')));

DROP POLICY IF EXISTS "suppliers_update_operations" ON public.suppliers;
CREATE POLICY "suppliers_update_operations" ON public.suppliers FOR UPDATE TO authenticated
USING (is_admin_user() OR has_role('operations') OR has_role('manager'))
WITH CHECK (is_admin_user() OR has_role('operations') OR has_role('manager'));

DROP POLICY IF EXISTS "suppliers_delete_admin" ON public.suppliers;
CREATE POLICY "suppliers_delete_admin" ON public.suppliers FOR DELETE TO authenticated
USING (is_admin_user());

DROP POLICY IF EXISTS "supplier_contacts_select_parent_access" ON public.supplier_contacts;
CREATE POLICY "supplier_contacts_select_parent_access" ON public.supplier_contacts FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id));

DROP POLICY IF EXISTS "supplier_contacts_insert_parent_access" ON public.supplier_contacts;
CREATE POLICY "supplier_contacts_insert_parent_access" ON public.supplier_contacts FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND (is_admin_user() OR has_role('operations') OR has_role('manager'))));

DROP POLICY IF EXISTS "supplier_contacts_update_parent_access" ON public.supplier_contacts;
CREATE POLICY "supplier_contacts_update_parent_access" ON public.supplier_contacts FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND (is_admin_user() OR has_role('operations') OR has_role('manager'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND (is_admin_user() OR has_role('operations') OR has_role('manager'))));

DROP POLICY IF EXISTS "supplier_contacts_delete_parent_access" ON public.supplier_contacts;
CREATE POLICY "supplier_contacts_delete_parent_access" ON public.supplier_contacts FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND (is_admin_user() OR has_role('operations') OR has_role('manager'))));
