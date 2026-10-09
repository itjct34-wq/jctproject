/*
# Invoice line items

1. New Tables
- `invoice_items`: Line items for invoices with description, quantity, unit price, discounts, and line totals.

2. Security
- RLS enabled, inherits access from parent invoice.

3. Notes
- Links to invoices and optionally to vehicles for chassis details.
*/

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx ON public.invoice_items(invoice_id);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_items_select_parent" ON public.invoice_items;
CREATE POLICY "invoice_items_select_parent" ON public.invoice_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id));
DROP POLICY IF EXISTS "invoice_items_insert_parent" ON public.invoice_items;
CREATE POLICY "invoice_items_insert_parent" ON public.invoice_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (is_admin_user() OR has_role('manager') OR has_role('accounts') OR has_role('sales_agent'))));
DROP POLICY IF EXISTS "invoice_items_update_parent" ON public.invoice_items;
CREATE POLICY "invoice_items_update_parent" ON public.invoice_items FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (is_admin_user() OR has_role('manager') OR has_role('accounts') OR has_role('sales_agent'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (is_admin_user() OR has_role('manager') OR has_role('accounts') OR has_role('sales_agent'))));
DROP POLICY IF EXISTS "invoice_items_delete_parent" ON public.invoice_items;
CREATE POLICY "invoice_items_delete_parent" ON public.invoice_items FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (is_admin_user() OR has_role('manager') OR has_role('accounts'))));
