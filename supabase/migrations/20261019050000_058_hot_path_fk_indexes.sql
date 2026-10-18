/*
  High-value FK covering indexes (Supabase performance advisor: unindexed_foreign_keys).
  Skips noisy created_by FKs on every table; targets join/filter paths used by
  sales, invoices, payments, quotations, and related ops queries.
*/

-- Sales document joins
CREATE INDEX IF NOT EXISTS invoices_sale_id_idx
  ON public.invoices (sale_id);

CREATE INDEX IF NOT EXISTS payments_sale_id_idx
  ON public.payments (sale_id);

CREATE INDEX IF NOT EXISTS quotations_sale_id_idx
  ON public.quotations (sale_id);

CREATE INDEX IF NOT EXISTS expenses_sale_id_idx
  ON public.expenses (sale_id);

CREATE INDEX IF NOT EXISTS export_documents_sale_id_idx
  ON public.export_documents (sale_id);

-- Payments shift filter / office ops
CREATE INDEX IF NOT EXISTS payments_shift_id_idx
  ON public.payments (shift_id);

-- Quotation line -> vehicle
CREATE INDEX IF NOT EXISTS quotation_items_vehicle_id_idx
  ON public.quotation_items (vehicle_id);

-- Procurement / auction path
CREATE INDEX IF NOT EXISTS purchases_auction_listing_id_idx
  ON public.purchases (auction_listing_id);

-- Vehicles commission audit join
CREATE INDEX IF NOT EXISTS vehicles_commission_paid_by_idx
  ON public.vehicles (commission_paid_by);

-- Agent verification lookups
CREATE INDEX IF NOT EXISTS agent_verifications_office_id_idx
  ON public.agent_verifications (office_id);

CREATE INDEX IF NOT EXISTS agent_verifications_user_id_idx
  ON public.agent_verifications (user_id);

-- RBAC join helper
CREATE INDEX IF NOT EXISTS role_permissions_permission_id_idx
  ON public.role_permissions (permission_id);
