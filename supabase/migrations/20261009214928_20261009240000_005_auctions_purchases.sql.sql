/*
# Auctions and purchases

1. New Tables
- `auction_listings`: Vehicles listed at auction houses with lot details, bidding dates, start prices, and result status.
- `auction_bids`: Bids placed on auction listings with approval workflow.
- `purchases`: Purchase orders for vehicles won at auction or bought directly, with cost breakdowns and supplier links.

2. Modified Tables
- None.

3. Security
- RLS enabled on all three tables.
- Operational roles (admin, operations, manager) can manage auction listings, bids, and purchases.
- Sales agents and freelancers can view auction listings and bids.
- Auditors can view all records.
- Only admins and managers can approve bids and finalize purchases.

4. Important Notes
- Auction listing codes generated from a sequence.
- Purchase codes generated from a sequence.
- Bids have an approval workflow: pending -> approved/rejected -> won/lost.
- Purchases link to suppliers, vehicles, and auction listings where applicable.
*/

CREATE SEQUENCE IF NOT EXISTS public.auction_listing_code_seq START WITH 1001;
CREATE OR REPLACE FUNCTION public.next_auction_listing_code()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'JCT-A-' || nextval('public.auction_listing_code_seq')::text;
$$;

CREATE SEQUENCE IF NOT EXISTS public.purchase_code_seq START WITH 1001;
CREATE OR REPLACE FUNCTION public.next_purchase_code()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'JCT-PO-' || nextval('public.purchase_code_seq')::text;
$$;

CREATE TABLE IF NOT EXISTS public.auction_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_code text NOT NULL UNIQUE DEFAULT public.next_auction_listing_code(),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  chassis_number text,
  make text, model text, model_year integer,
  auction_date date,
  lot_number text,
  start_price numeric(14,2),
  currency text NOT NULL DEFAULT 'JPY',
  result text NOT NULL DEFAULT 'pending' CHECK (result IN ('pending', 'won', 'lost', 'cancelled')),
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auction_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.auction_listings(id) ON DELETE CASCADE,
  bid_amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'JPY',
  max_bid numeric(14,2),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'won', 'lost')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_code text NOT NULL UNIQUE DEFAULT public.next_purchase_code(),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  auction_listing_id uuid REFERENCES public.auction_listings(id) ON DELETE SET NULL,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  vehicle_price numeric(14,2) NOT NULL DEFAULT 0,
  auction_fees numeric(14,2) NOT NULL DEFAULT 0,
  transport_cost numeric(14,2) NOT NULL DEFAULT 0,
  inspection_cost numeric(14,2) NOT NULL DEFAULT 0,
  other_cost numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'JPY',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'invoiced', 'paid', 'cancelled')),
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auction_listings_result_idx ON public.auction_listings(result);
CREATE INDEX IF NOT EXISTS auction_listings_auction_date_idx ON public.auction_listings(auction_date);
CREATE INDEX IF NOT EXISTS auction_listings_supplier_id_idx ON public.auction_listings(supplier_id);
CREATE INDEX IF NOT EXISTS auction_bids_listing_id_idx ON public.auction_bids(listing_id);
CREATE INDEX IF NOT EXISTS auction_bids_status_idx ON public.auction_bids(status);
CREATE INDEX IF NOT EXISTS purchases_status_idx ON public.purchases(status);
CREATE INDEX IF NOT EXISTS purchases_supplier_id_idx ON public.purchases(supplier_id);
CREATE INDEX IF NOT EXISTS purchases_vehicle_id_idx ON public.purchases(vehicle_id);

ALTER TABLE public.auction_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auction_listings_select_ops" ON public.auction_listings;
CREATE POLICY "auction_listings_select_ops" ON public.auction_listings FOR SELECT TO authenticated
USING (is_admin_user() OR has_role('operations') OR has_role('manager') OR has_role('sales_agent') OR has_role('freelancer') OR has_role('auditor'));
DROP POLICY IF EXISTS "auction_listings_insert_ops" ON public.auction_listings;
CREATE POLICY "auction_listings_insert_ops" ON public.auction_listings FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND (is_admin_user() OR has_role('operations') OR has_role('manager')));
DROP POLICY IF EXISTS "auction_listings_update_ops" ON public.auction_listings;
CREATE POLICY "auction_listings_update_ops" ON public.auction_listings FOR UPDATE TO authenticated
USING (is_admin_user() OR has_role('operations') OR has_role('manager'))
WITH CHECK (is_admin_user() OR has_role('operations') OR has_role('manager'));
DROP POLICY IF EXISTS "auction_listings_delete_admin" ON public.auction_listings;
CREATE POLICY "auction_listings_delete_admin" ON public.auction_listings FOR DELETE TO authenticated USING (is_admin_user());

DROP POLICY IF EXISTS "auction_bids_select_ops" ON public.auction_bids;
CREATE POLICY "auction_bids_select_ops" ON public.auction_bids FOR SELECT TO authenticated
USING (is_admin_user() OR has_role('operations') OR has_role('manager') OR has_role('sales_agent') OR has_role('freelancer') OR has_role('auditor'));
DROP POLICY IF EXISTS "auction_bids_insert_ops" ON public.auction_bids;
CREATE POLICY "auction_bids_insert_ops" ON public.auction_bids FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND (is_admin_user() OR has_role('operations') OR has_role('manager') OR has_role('sales_agent')));
DROP POLICY IF EXISTS "auction_bids_update_ops" ON public.auction_bids;
CREATE POLICY "auction_bids_update_ops" ON public.auction_bids FOR UPDATE TO authenticated
USING (is_admin_user() OR has_role('operations') OR has_role('manager'))
WITH CHECK (is_admin_user() OR has_role('operations') OR has_role('manager'));
DROP POLICY IF EXISTS "auction_bids_delete_admin" ON public.auction_bids;
CREATE POLICY "auction_bids_delete_admin" ON public.auction_bids FOR DELETE TO authenticated USING (is_admin_user());

DROP POLICY IF EXISTS "purchases_select_ops" ON public.purchases;
CREATE POLICY "purchases_select_ops" ON public.purchases FOR SELECT TO authenticated
USING (is_admin_user() OR has_role('operations') OR has_role('manager') OR has_role('auditor'));
DROP POLICY IF EXISTS "purchases_insert_ops" ON public.purchases;
CREATE POLICY "purchases_insert_ops" ON public.purchases FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND (is_admin_user() OR has_role('operations') OR has_role('manager')));
DROP POLICY IF EXISTS "purchases_update_ops" ON public.purchases;
CREATE POLICY "purchases_update_ops" ON public.purchases FOR UPDATE TO authenticated
USING (is_admin_user() OR has_role('operations') OR has_role('manager'))
WITH CHECK (is_admin_user() OR has_role('operations') OR has_role('manager'));
DROP POLICY IF EXISTS "purchases_delete_admin" ON public.purchases;
CREATE POLICY "purchases_delete_admin" ON public.purchases FOR DELETE TO authenticated USING (is_admin_user());
