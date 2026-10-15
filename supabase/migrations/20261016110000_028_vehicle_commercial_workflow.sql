/*
# Vehicle commercial workflow (FOB formula, sold price, shipping docs, audit)

- Bid = purchase_price (JPY). expense_jpy + tt_rate produce fob_usd (listed FOB).
- Reservation stores sold_price + incoterm (FOB / C&F / CIF).
- Booking details on a reserved unit → shipping_status booked.
- BL attachment → shipped; surrender or waybill → delivered.
- Legacy vehicles.status stays aligned for the public catalog.
- Audit rows for vehicle status/prices and payment/invoice changes.
*/

-- ---------------------------------------------------------------------------
-- Commercial pricing + sale term
-- ---------------------------------------------------------------------------

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS expense_jpy numeric(14,2) DEFAULT 45000,
  ADD COLUMN IF NOT EXISTS tt_rate numeric(12,4) DEFAULT 155,
  ADD COLUMN IF NOT EXISTS fob_usd numeric(14,2),
  ADD COLUMN IF NOT EXISTS sold_price numeric(14,2),
  ADD COLUMN IF NOT EXISTS incoterm text;

ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_incoterm_check;
ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_incoterm_check
  CHECK (incoterm IS NULL OR incoterm IN ('FOB', 'C&F', 'CIF'));

UPDATE public.vehicles
SET
  expense_jpy = COALESCE(expense_jpy, 45000),
  tt_rate = COALESCE(tt_rate, 155)
WHERE expense_jpy IS NULL OR tt_rate IS NULL;

UPDATE public.vehicles
SET fob_usd = COALESCE(
  fob_usd,
  listed_price,
  CASE
    WHEN purchase_price IS NOT NULL AND COALESCE(tt_rate, 155) > 0
      THEN round((purchase_price * 1.1 + COALESCE(expense_jpy, 45000)) / COALESCE(tt_rate, 155), 2)
    ELSE NULL
  END
)
WHERE fob_usd IS NULL;

ALTER TABLE public.record_attachments
  ADD COLUMN IF NOT EXISTS doc_kind text;

ALTER TABLE public.record_attachments
  DROP CONSTRAINT IF EXISTS record_attachments_doc_kind_check;
ALTER TABLE public.record_attachments
  ADD CONSTRAINT record_attachments_doc_kind_check
  CHECK (doc_kind IS NULL OR doc_kind IN ('bl', 'surrender', 'waybill', 'other'));

-- ---------------------------------------------------------------------------
-- FOB from bid (purchase_price) when staff save cost fields
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.vehicles_apply_fob_from_bid()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tt_rate IS NULL OR NEW.tt_rate <= 0 THEN
    NEW.tt_rate := 155;
  END IF;
  IF NEW.expense_jpy IS NULL THEN
    NEW.expense_jpy := 45000;
  END IF;

  IF NEW.purchase_price IS NOT NULL THEN
    NEW.fob_usd := round((NEW.purchase_price * 1.1 + NEW.expense_jpy) / NEW.tt_rate, 2);
    NEW.listed_price := NEW.fob_usd;
    IF NEW.listed_currency IS NULL OR NEW.listed_currency = '' THEN
      NEW.listed_currency := 'USD';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehicles_apply_fob_from_bid ON public.vehicles;
CREATE TRIGGER vehicles_apply_fob_from_bid
  BEFORE INSERT OR UPDATE OF purchase_price, expense_jpy, tt_rate ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.vehicles_apply_fob_from_bid();

-- ---------------------------------------------------------------------------
-- Booking details on a reserved unit → booked (never downgrade shipped/delivered)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.vehicles_apply_shipping_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.shipping_status IN ('shipped', 'delivered') THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_status IS DISTINCT FROM 'available'
     AND NEW.customer_id IS NOT NULL
     AND (
       COALESCE(NEW.shipping_port_of_loading, '') <> ''
       OR COALESCE(NEW.shipping_port_of_discharge, '') <> ''
       OR COALESCE(NEW.shipping_vessel_name, '') <> ''
       OR COALESCE(NEW.shipping_bl_number, '') <> ''
       OR COALESCE(NEW.shipping_line, '') <> ''
       OR NEW.shipping_etd IS NOT NULL
       OR NEW.shipping_eta IS NOT NULL
     )
  THEN
    NEW.shipping_status := 'booked';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehicles_apply_shipping_lifecycle ON public.vehicles;
CREATE TRIGGER vehicles_apply_shipping_lifecycle
  BEFORE INSERT OR UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.vehicles_apply_shipping_lifecycle();

-- ---------------------------------------------------------------------------
-- Legacy public status: in_transit when shipped, exported when delivered
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_vehicle_legacy_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('on_hold', 'archived') THEN
    RETURN NEW;
  END IF;

  IF NEW.shipping_status = 'delivered' THEN
    NEW.status := 'exported';
  ELSIF NEW.shipping_status = 'shipped' THEN
    NEW.status := 'in_transit';
  ELSIF NEW.payment_status = 'available' THEN
    NEW.status := 'in_stock';
  ELSIF NEW.payment_status IN ('reserved', 'partial_paid') THEN
    NEW.status := 'reserved';
  ELSIF NEW.payment_status = 'paid' THEN
    NEW.status := CASE NEW.shipping_status
      WHEN 'booked' THEN 'sold'
      ELSE 'sold'
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehicles_sync_legacy_status ON public.vehicles;
CREATE TRIGGER vehicles_sync_legacy_status
  BEFORE INSERT OR UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_vehicle_legacy_status();

-- ---------------------------------------------------------------------------
-- Sales may set reservation commercial fields (not bid / specs / shipping)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.vehicles_enforce_sales_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.is_admin_user()
    OR public.has_role('operations')
    OR public.has_role('manager')
    OR public.has_role('accounts')
  THEN
    RETURN NEW;
  END IF;

  IF public.has_role('sales_agent') OR public.has_role('freelancer') THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.stock_number IS DISTINCT FROM OLD.stock_number
      OR NEW.chassis_number IS DISTINCT FROM OLD.chassis_number
      OR NEW.make IS DISTINCT FROM OLD.make
      OR NEW.model IS DISTINCT FROM OLD.model
      OR NEW.listed_price IS DISTINCT FROM OLD.listed_price
      OR NEW.purchase_price IS DISTINCT FROM OLD.purchase_price
      OR NEW.expense_jpy IS DISTINCT FROM OLD.expense_jpy
      OR NEW.tt_rate IS DISTINCT FROM OLD.tt_rate
      OR NEW.fob_usd IS DISTINCT FROM OLD.fob_usd
      OR NEW.shipping_status IS DISTINCT FROM OLD.shipping_status
      OR NEW.shipping_port_of_loading IS DISTINCT FROM OLD.shipping_port_of_loading
      OR NEW.shipping_port_of_discharge IS DISTINCT FROM OLD.shipping_port_of_discharge
      OR NEW.shipping_vessel_name IS DISTINCT FROM OLD.shipping_vessel_name
      OR NEW.shipping_bl_number IS DISTINCT FROM OLD.shipping_bl_number
      OR NEW.shipping_line IS DISTINCT FROM OLD.shipping_line
      OR NEW.shipping_etd IS DISTINCT FROM OLD.shipping_etd
      OR NEW.shipping_eta IS DISTINCT FROM OLD.shipping_eta
      OR NEW.shipping_notes IS DISTINCT FROM OLD.shipping_notes
    THEN
      RAISE EXCEPTION 'Sales users may only reserve vehicles (customer, sold price, and term)';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Paid / partial vs sold price (fallback listed / FOB)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.recompute_vehicle_payment_status(p_vehicle_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  due numeric;
  paid numeric;
  cur_status text;
BEGIN
  IF p_vehicle_id IS NULL THEN
    RETURN;
  END IF;

  SELECT payment_status, COALESCE(sold_price, listed_price, fob_usd)
  INTO cur_status, due
  FROM public.vehicles
  WHERE id = p_vehicle_id
  FOR UPDATE;

  IF cur_status = 'available' THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO paid
  FROM public.payments
  WHERE vehicle_id = p_vehicle_id
    AND status IN ('received', 'reconciled');

  IF paid <= 0 THEN
    UPDATE public.vehicles SET payment_status = 'reserved' WHERE id = p_vehicle_id AND payment_status IN ('partial_paid', 'paid');
    RETURN;
  END IF;

  IF due IS NOT NULL AND due > 0 AND paid >= due THEN
    UPDATE public.vehicles SET payment_status = 'paid' WHERE id = p_vehicle_id;
  ELSE
    UPDATE public.vehicles SET payment_status = 'partial_paid' WHERE id = p_vehicle_id;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Document kinds advance shipping_status
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.vehicle_docs_advance_shipping()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.entity_type IS DISTINCT FROM 'vehicles' OR NEW.entity_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.doc_kind = 'bl' THEN
    UPDATE public.vehicles
    SET shipping_status = 'shipped', updated_at = now()
    WHERE id = NEW.entity_id
      AND shipping_status IN ('not_booked', 'booked');
  ELSIF NEW.doc_kind IN ('surrender', 'waybill') THEN
    UPDATE public.vehicles
    SET shipping_status = 'delivered', updated_at = now()
    WHERE id = NEW.entity_id
      AND shipping_status IS DISTINCT FROM 'delivered';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_attachments_vehicle_shipping ON public.record_attachments;
CREATE TRIGGER record_attachments_vehicle_shipping
  AFTER INSERT ON public.record_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.vehicle_docs_advance_shipping();

REVOKE ALL ON FUNCTION public.vehicle_docs_advance_shipping() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.write_simple_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_action text;
  v_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'insert';
    v_id := NEW.id;
    v_new := to_jsonb(NEW);
    v_old := NULL;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_id := OLD.id;
    v_old := to_jsonb(OLD);
    v_new := NULL;
  ELSE
    v_action := 'update';
    v_id := NEW.id;
    IF TG_TABLE_NAME = 'vehicles' THEN
      IF NEW.status IS NOT DISTINCT FROM OLD.status
         AND NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status
         AND NEW.shipping_status IS NOT DISTINCT FROM OLD.shipping_status
         AND NEW.purchase_price IS NOT DISTINCT FROM OLD.purchase_price
         AND NEW.listed_price IS NOT DISTINCT FROM OLD.listed_price
         AND NEW.fob_usd IS NOT DISTINCT FROM OLD.fob_usd
         AND NEW.sold_price IS NOT DISTINCT FROM OLD.sold_price
         AND NEW.expense_jpy IS NOT DISTINCT FROM OLD.expense_jpy
         AND NEW.tt_rate IS NOT DISTINCT FROM OLD.tt_rate
         AND NEW.incoterm IS NOT DISTINCT FROM OLD.incoterm
         AND NEW.customer_id IS NOT DISTINCT FROM OLD.customer_id
      THEN
        RETURN NEW;
      END IF;
      v_old := jsonb_strip_nulls(jsonb_build_object(
        'status', OLD.status,
        'payment_status', OLD.payment_status,
        'shipping_status', OLD.shipping_status,
        'purchase_price', OLD.purchase_price,
        'listed_price', OLD.listed_price,
        'fob_usd', OLD.fob_usd,
        'sold_price', OLD.sold_price,
        'expense_jpy', OLD.expense_jpy,
        'tt_rate', OLD.tt_rate,
        'incoterm', OLD.incoterm,
        'customer_id', OLD.customer_id
      ));
      v_new := jsonb_strip_nulls(jsonb_build_object(
        'status', NEW.status,
        'payment_status', NEW.payment_status,
        'shipping_status', NEW.shipping_status,
        'purchase_price', NEW.purchase_price,
        'listed_price', NEW.listed_price,
        'fob_usd', NEW.fob_usd,
        'sold_price', NEW.sold_price,
        'expense_jpy', NEW.expense_jpy,
        'tt_rate', NEW.tt_rate,
        'incoterm', NEW.incoterm,
        'customer_id', NEW.customer_id
      ));
    ELSE
      v_old := to_jsonb(OLD);
      v_new := to_jsonb(NEW);
    END IF;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, module, record_id, record_type, old_values, new_values, severity)
  VALUES (auth.uid(), v_action, TG_TABLE_NAME, v_id, TG_TABLE_NAME, v_old, v_new, 'info');

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehicles_audit_log ON public.vehicles;
CREATE TRIGGER vehicles_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.write_simple_audit_log();

DROP TRIGGER IF EXISTS payments_audit_log ON public.payments;
CREATE TRIGGER payments_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.write_simple_audit_log();

DROP TRIGGER IF EXISTS invoices_audit_log ON public.invoices;
CREATE TRIGGER invoices_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.write_simple_audit_log();

REVOKE ALL ON FUNCTION public.write_simple_audit_log() FROM PUBLIC, anon, authenticated;
