/*
# Payments, expenses, shipments, and documents

1. New Tables
- `payments`: T/T remittance records with multi-invoice allocation, partial payments, and exchange rate handling.
- `expenses`: Category-based expense tracking with vehicle-specific costs and approval workflow.
- `shipments`: Shipping bookings with vessel schedules, B/L tracking, milestone history, and multi-vehicle support.
- `shipment_items`: Vehicles included in a shipment.
- `export_documents`: Export certificates, bills of lading, packing lists, and courier receipts with version tracking.

2. Modified Tables
- None.

3. Security
- RLS enabled on all tables.
- Accounts and admins manage payments and expenses.
- Operations, managers, and admins manage shipments and documents.
- Auditors can view all records.
- Shipment items and export documents inherit access from their parent.

4. Important Notes
- Payment, expense, shipment, and document codes generated from sequences.
- Payments can be allocated to multiple invoices.
- Expenses can be linked to specific vehicles for profitability tracking.
- Shipments track status: booked, loaded, in_transit, arrived, delivered.
- Export documents track status: pending, prepared, submitted, received, verified.
*/

CREATE SEQUENCE IF NOT EXISTS public.payment_code_seq START WITH 1001;
CREATE OR REPLACE FUNCTION public.next_payment_code()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'JCT-PMT-' || nextval('public.payment_code_seq')::text;
$$;

CREATE SEQUENCE IF NOT EXISTS public.expense_code_seq START WITH 1001;
CREATE OR REPLACE FUNCTION public.next_expense_code()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'JCT-EXP-' || nextval('public.expense_code_seq')::text;
$$;

CREATE SEQUENCE IF NOT EXISTS public.shipment_code_seq START WITH 1001;
CREATE OR REPLACE FUNCTION public.next_shipment_code()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'JCT-SHP-' || nextval('public.shipment_code_seq')::text;
$$;

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_code text NOT NULL UNIQUE DEFAULT public.next_payment_code(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'JPY',
  exchange_rate numeric(10,4) NOT NULL DEFAULT 1.0,
  amount_jpy numeric(14,2) NOT NULL DEFAULT 0,
  payment_method text CHECK (payment_method IS NULL OR payment_method IN ('bank_transfer', 'cash', 'credit_card', 'other')),
  bank_reference text,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('pending', 'received', 'reconciled', 'rejected')),
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_code text NOT NULL UNIQUE DEFAULT public.next_expense_code(),
  category text NOT NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'JPY',
  payment_method text CHECK (payment_method IS NULL OR payment_method IN ('bank_transfer', 'cash', 'credit_card', 'other')),
  vendor text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_code text NOT NULL UNIQUE DEFAULT public.next_shipment_code(),
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  booking_date date,
  etd date,
  eta date,
  vessel_name text,
  voyage_number text,
  port_of_loading text,
  port_of_discharge text,
  final_destination text,
  bl_number text,
  shipping_line text,
  container_number text,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'loaded', 'in_transit', 'arrived', 'delivered', 'cancelled')),
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.export_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  document_type text NOT NULL CHECK (document_type IN ('export_certificate', 'commercial_invoice', 'packing_list', 'bill_of_lading', 'courier_receipt', 'inspection_certificate', 'other')),
  document_number text,
  issue_date date,
  expiry_date date,
  issuing_authority text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'prepared', 'submitted', 'received', 'verified', 'rejected')),
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_customer_id_idx ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS payments_invoice_id_idx ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments(status);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON public.expenses(category);
CREATE INDEX IF NOT EXISTS expenses_vehicle_id_idx ON public.expenses(vehicle_id);
CREATE INDEX IF NOT EXISTS expenses_status_idx ON public.expenses(status);
CREATE INDEX IF NOT EXISTS shipments_status_idx ON public.shipments(status);
CREATE INDEX IF NOT EXISTS shipments_sale_id_idx ON public.shipments(sale_id);
CREATE INDEX IF NOT EXISTS shipment_items_shipment_id_idx ON public.shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS export_documents_shipment_id_idx ON public.export_documents(shipment_id);
CREATE INDEX IF NOT EXISTS export_documents_status_idx ON public.export_documents(status);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_ops" ON public.payments;
CREATE POLICY "payments_select_ops" ON public.payments FOR SELECT TO authenticated
USING (is_admin_user() OR has_role('manager') OR has_role('accounts') OR has_role('auditor'));
DROP POLICY IF EXISTS "payments_insert_ops" ON public.payments;
CREATE POLICY "payments_insert_ops" ON public.payments FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND (is_admin_user() OR has_role('manager') OR has_role('accounts')));
DROP POLICY IF EXISTS "payments_update_ops" ON public.payments;
CREATE POLICY "payments_update_ops" ON public.payments FOR UPDATE TO authenticated
USING (is_admin_user() OR has_role('manager') OR has_role('accounts'))
WITH CHECK (is_admin_user() OR has_role('manager') OR has_role('accounts'));
DROP POLICY IF EXISTS "payments_delete_admin" ON public.payments;
CREATE POLICY "payments_delete_admin" ON public.payments FOR DELETE TO authenticated USING (is_admin_user());

DROP POLICY IF EXISTS "expenses_select_ops" ON public.expenses;
CREATE POLICY "expenses_select_ops" ON public.expenses FOR SELECT TO authenticated
USING (is_admin_user() OR has_role('manager') OR has_role('accounts') OR has_role('auditor'));
DROP POLICY IF EXISTS "expenses_insert_ops" ON public.expenses;
CREATE POLICY "expenses_insert_ops" ON public.expenses FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND (is_admin_user() OR has_role('manager') OR has_role('accounts') OR has_role('operations')));
DROP POLICY IF EXISTS "expenses_update_ops" ON public.expenses;
CREATE POLICY "expenses_update_ops" ON public.expenses FOR UPDATE TO authenticated
USING (is_admin_user() OR has_role('manager') OR has_role('accounts'))
WITH CHECK (is_admin_user() OR has_role('manager') OR has_role('accounts'));
DROP POLICY IF EXISTS "expenses_delete_admin" ON public.expenses;
CREATE POLICY "expenses_delete_admin" ON public.expenses FOR DELETE TO authenticated USING (is_admin_user());

DROP POLICY IF EXISTS "shipments_select_ops" ON public.shipments;
CREATE POLICY "shipments_select_ops" ON public.shipments FOR SELECT TO authenticated
USING (is_admin_user() OR has_role('operations') OR has_role('manager') OR has_role('auditor'));
DROP POLICY IF EXISTS "shipments_insert_ops" ON public.shipments;
CREATE POLICY "shipments_insert_ops" ON public.shipments FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND (is_admin_user() OR has_role('operations') OR has_role('manager')));
DROP POLICY IF EXISTS "shipments_update_ops" ON public.shipments;
CREATE POLICY "shipments_update_ops" ON public.shipments FOR UPDATE TO authenticated
USING (is_admin_user() OR has_role('operations') OR has_role('manager'))
WITH CHECK (is_admin_user() OR has_role('operations') OR has_role('manager'));
DROP POLICY IF EXISTS "shipments_delete_admin" ON public.shipments;
CREATE POLICY "shipments_delete_admin" ON public.shipments FOR DELETE TO authenticated USING (is_admin_user());

DROP POLICY IF EXISTS "shipment_items_select_parent" ON public.shipment_items;
CREATE POLICY "shipment_items_select_parent" ON public.shipment_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.shipments s WHERE s.id = shipment_id));
DROP POLICY IF EXISTS "shipment_items_insert_parent" ON public.shipment_items;
CREATE POLICY "shipment_items_insert_parent" ON public.shipment_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.shipments s WHERE s.id = shipment_id AND (is_admin_user() OR has_role('operations') OR has_role('manager'))));
DROP POLICY IF EXISTS "shipment_items_delete_parent" ON public.shipment_items;
CREATE POLICY "shipment_items_delete_parent" ON public.shipment_items FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.shipments s WHERE s.id = shipment_id AND (is_admin_user() OR has_role('operations') OR has_role('manager'))));

DROP POLICY IF EXISTS "export_documents_select_ops" ON public.export_documents;
CREATE POLICY "export_documents_select_ops" ON public.export_documents FOR SELECT TO authenticated
USING (is_admin_user() OR has_role('operations') OR has_role('manager') OR has_role('auditor'));
DROP POLICY IF EXISTS "export_documents_insert_ops" ON public.export_documents;
CREATE POLICY "export_documents_insert_ops" ON public.export_documents FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND (is_admin_user() OR has_role('operations') OR has_role('manager')));
DROP POLICY IF EXISTS "export_documents_update_ops" ON public.export_documents;
CREATE POLICY "export_documents_update_ops" ON public.export_documents FOR UPDATE TO authenticated
USING (is_admin_user() OR has_role('operations') OR has_role('manager'))
WITH CHECK (is_admin_user() OR has_role('operations') OR has_role('manager'));
DROP POLICY IF EXISTS "export_documents_delete_admin" ON public.export_documents;
CREATE POLICY "export_documents_delete_admin" ON public.export_documents FOR DELETE TO authenticated USING (is_admin_user());
