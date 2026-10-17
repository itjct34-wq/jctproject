-- Soft-hide for vehicles: keep the row, drop from default stock lists and reports.
-- `hidden` is orthogonal to payment/shipping tracks (like on_hold / archived).

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_status_check;
ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_status_check
  CHECK (status = ANY (ARRAY[
    'in_stock'::text,
    'reserved'::text,
    'sold'::text,
    'in_transit'::text,
    'exported'::text,
    'on_hold'::text,
    'archived'::text,
    'hidden'::text
  ]));

CREATE OR REPLACE FUNCTION public.sync_vehicle_legacy_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Manual overrides: do not auto-sync payment/shipping into legacy status.
  IF NEW.status IN ('on_hold', 'archived', 'hidden') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status
     AND NEW.shipping_status IS NOT DISTINCT FROM OLD.shipping_status
  THEN
    IF NEW.status = 'in_stock' THEN
      NEW.payment_status := 'available';
    ELSIF NEW.status = 'reserved' THEN
      IF NEW.payment_status = 'available' THEN
        NEW.payment_status := 'reserved';
      END IF;
    ELSIF NEW.status = 'sold' THEN
      IF NEW.payment_status IN ('available', 'reserved', 'partial_paid') THEN
        NEW.payment_status := 'paid';
      END IF;
    ELSIF NEW.status = 'in_transit' THEN
      NEW.shipping_status := 'shipped';
    ELSIF NEW.status = 'exported' THEN
      NEW.shipping_status := 'delivered';
    END IF;
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
    NEW.status := 'sold';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON CONSTRAINT vehicles_status_check ON public.vehicles IS
  'Lifecycle listing status; hidden = soft-hide (excluded from default stock + reports).';
