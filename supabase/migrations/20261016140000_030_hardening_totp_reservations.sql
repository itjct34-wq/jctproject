/*
# Hardening: per-agent TOTP secret, verification rate-limit columns,
# reservation expiry RPC, bidirectional vehicle status sync.

Do not rewrite 009/013/014; this is a new applied migration after 029.
*/

ALTER TABLE public.agent_verifications
  ADD COLUMN IF NOT EXISTS totp_secret text;

COMMENT ON COLUMN public.agent_verifications.totp_secret IS
  'Per-agent HMAC secret for 30s verification codes. Server-only; never expose via PostgREST to anon.';

REVOKE SELECT (totp_secret) ON public.agent_verifications FROM anon, authenticated;

ALTER TABLE public.agent_verification_attempts
  ADD COLUMN IF NOT EXISTS agent_code_hash text;

CREATE INDEX IF NOT EXISTS agent_verification_attempts_code_time_idx
  ON public.agent_verification_attempts (agent_code_hash, attempted_at DESC);

-- ---------------------------------------------------------------------------
-- Release expired holds (unpaid reserved units only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.expire_reserved_vehicles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.vehicles
  SET
    status = 'in_stock',
    payment_status = 'available',
    customer_id = NULL,
    reserved_until = NULL,
    sold_price = NULL,
    incoterm = NULL,
    updated_at = now()
  WHERE reserved_until IS NOT NULL
    AND reserved_until < CURRENT_DATE
    AND COALESCE(payment_status, 'available') IN ('reserved', 'available')
    AND COALESCE(shipping_status, 'not_booked') = 'not_booked'
    AND status IN ('reserved', 'in_stock');

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_reserved_vehicles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_reserved_vehicles() TO authenticated;

-- ---------------------------------------------------------------------------
-- Keep listing status aligned with payment/shipping (and the reverse when staff
-- only changes legacy status).
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

DROP TRIGGER IF EXISTS vehicles_sync_legacy_status ON public.vehicles;
CREATE TRIGGER vehicles_sync_legacy_status
  BEFORE INSERT OR UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_vehicle_legacy_status();
