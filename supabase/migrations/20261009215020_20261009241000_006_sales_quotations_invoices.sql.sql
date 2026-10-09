/*
# Sales, quotations, and invoices

1. New Tables
- `sales`: Sales orders linking customers and vehicles with deposit tracking and delivery status.
- `quotations`: Price quotes to customers with FOB/CNF/CIF pricing, revision tracking, and approval workflow. Links to sale after conversion.
- `quotation_items`: Individual vehicle line items within a quotation.
- `invoices`: Proforma and commercial invoices with credit notes, numbering, and payment status.

2. Modified Tables
- None.

3. Security
- RLS enabled on all tables.
- Sales agents, freelancers, managers, and admins can manage quotations and sales.
- Accounts and admins can manage invoices.
- Auditors can view all records.

4. Important Notes
- Quotation, sale, and invoice codes generated from sequences.
- Quotations support FOB, CNF, and CIF price types.
- Sales link to customers and vehicles.
- Invoices track payment status: unpaid, partial, paid, cancelled, credited.
*/

CREATE SEQUENCE IF NOT EXISTS public.quotation_code_seq START WITH 1001;
CREATE OR REPLACE FUNCTION public.next_quotation_code()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'JCT-Q-' || nextval('public.quotation_code_seq')::text;
$$;

CREATE SEQUENCE IF NOT EXISTS public.sale_code_seq START WITH 1001;
CREATE OR REPLACE FUNCTION public.next_sale_code()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'JCT-SO-' || nextval('public.sale_code_seq')::text;
$$;

CREATE SEQUENCE IF NOT EXISTS public.invoice_code_seq START WITH 1001;
CREATE OR REPLACE FUNCTION public.next_invoice_code()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'JCT-INV-' || nextval('public.invoice_code_seq')::text;
$$;

CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_code text NOT NULL UNIQUE DEFAULT public.next_sale_code(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  sale_price numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'JPY',
  deposit_amount numeric(14,2) NOT NULL DEFAULT 0,
  deposit_date date,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'paid', 'shipped', 'delivered', 'cancelled')),
  delivery_date date,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_code text NOT NULL UNIQUE DEFAULT public.next_quotation_code(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  price_type text NOT NULL DEFAULT 'FOB' CHECK (price_type IN ('FOB', 'CNF', 'CIF')),
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  freight numeric(14,2) NOT NULL DEFAULT 0,
  insurance numeric(14,2) NOT NULL DEFAULT 0,
  other_fees numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'JPY',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')),
  valid_until date,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_code text NOT NULL UNIQUE DEFAULT public.next_invoice_code(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  invoice_type text NOT NULL DEFAULT 'commercial' CHECK (invoice_type IN ('proforma', 'commercial', 'credit_note')),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'JPY',
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'cancelled', 'credited')),
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_customer_id_idx ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS sales_vehicle_id_idx ON public.sales(vehicle_id);
CREATE INDEX IF NOT EXISTS sales_status_idx ON public.sales(status);
CREATE INDEX IF NOT EXISTS quotations_customer_id_idx ON public.quotations(customer_id);
CREATE INDEX IF NOT EXISTS quotations_status_idx ON public.quotations(status);
CREATE INDEX IF NOT EXISTS quotation_items_quotation_id_idx ON public.quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS invoices_customer_id_idx ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices(payment_status);
CREATE INDEX IF NOT EXISTS invoices_invoice_type_idx ON public.invoices(invoice_type);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_select_ops" ON public.sales;
CREATE POLICY "sales_select_ops" ON public.sales FOR SELECT TO authenticated
USING (is_admin_user() OR has_role('operations') OR has_role('manager') OR has_role('sales_agent') OR has_role('freelancer') OR has_role('auditor'));
DROP POLICY IF EXISTS "sales_insert_ops" ON public.sales;
CREATE POLICY "sales_insert_ops" ON public.sales FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND (is_admin_user() OR has_role('operations') OR has_role('manager') OR has_role('sales_agent') OR has_role('freelancer')));
DROP POLICY IF EXISTS "sales_update_ops" ON public.sales;
CREATE POLICY "sales_update_ops" ON public.sales FOR UPDATE TO authenticated
USING (is_admin_user() OR has_role('operations') OR has_role('manager') OR has_role('sales_agent'))
WITH CHECK (is_admin_user() OR has_role('operations') OR has_role('manager') OR has_role('sales_agent'));
DROP POLICY IF EXISTS "sales_delete_admin" ON public.sales;
CREATE POLICY "sales_delete_admin" ON public.sales FOR DELETE TO authenticated USING (is_admin_user());

DROP POLICY IF EXISTS "quotations_select_ops" ON public.quotations;
CREATE POLICY "quotations_select_ops" ON public.quotations FOR SELECT TO authenticated
USING (is_admin_user() OR has_role('operations') OR has_role('manager') OR has_role('sales_agent') OR has_role('freelancer') OR has_role('auditor'));
DROP POLICY IF EXISTS "quotations_insert_ops" ON public.quotations;
CREATE POLICY "quotations_insert_ops" ON public.quotations FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND (is_admin_user() OR has_role('operations') OR has_role('manager') OR has_role('sales_agent') OR has_role('freelancer')));
DROP POLICY IF EXISTS "quotations_update_ops" ON public.quotations;
CREATE POLICY "quotations_update_ops" ON public.quotations FOR UPDATE TO authenticated
USING (is_admin_user() OR has_role('operations') OR has_role('manager') OR has_role('sales_agent'))
WITH CHECK (is_admin_user() OR has_role('operations') OR has_role('manager') OR has_role('sales_agent'));
DROP POLICY IF EXISTS "quotations_delete_admin" ON public.quotations;
CREATE POLICY "quotations_delete_admin" ON public.quotations FOR DELETE TO authenticated USING (is_admin_user());

DROP POLICY IF EXISTS "quotation_items_select_parent" ON public.quotation_items;
CREATE POLICY "quotation_items_select_parent" ON public.quotation_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_id));
DROP POLICY IF EXISTS "quotation_items_insert_parent" ON public.quotation_items;
CREATE POLICY "quotation_items_insert_parent" ON public.quotation_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_id));
DROP POLICY IF EXISTS "quotation_items_update_parent" ON public.quotation_items;
CREATE POLICY "quotation_items_update_parent" ON public.quotation_items FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_id));
DROP POLICY IF EXISTS "quotation_items_delete_parent" ON public.quotation_items;
CREATE POLICY "quotation_items_delete_parent" ON public.quotation_items FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_id));

DROP POLICY IF EXISTS "invoices_select_ops" ON public.invoices;
CREATE POLICY "invoices_select_ops" ON public.invoices FOR SELECT TO authenticated
USING (is_admin_user() OR has_role('manager') OR has_role('accounts') OR has_role('auditor'));
DROP POLICY IF EXISTS "invoices_insert_ops" ON public.invoices;
CREATE POLICY "invoices_insert_ops" ON public.invoices FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND (is_admin_user() OR has_role('manager') OR has_role('accounts') OR has_role('sales_agent')));
DROP POLICY IF EXISTS "invoices_update_ops" ON public.invoices;
CREATE POLICY "invoices_update_ops" ON public.invoices FOR UPDATE TO authenticated
USING (is_admin_user() OR has_role('manager') OR has_role('accounts'))
WITH CHECK (is_admin_user() OR has_role('manager') OR has_role('accounts'));
DROP POLICY IF EXISTS "invoices_delete_admin" ON public.invoices;
CREATE POLICY "invoices_delete_admin" ON public.invoices FOR DELETE TO authenticated USING (is_admin_user());
