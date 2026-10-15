/*
# Vehicle reservation exclusivity

One vehicle may only be reserved by one sales agent / freelancer at a time.

- reserved_by remains a single FK (already unique per row).
- BEFORE UPDATE trigger rejects reserved_by changes from agent A to agent B
  unless admin / operations / manager override (or release to NULL first).
- Sales reserve RLS also requires reserved_by IS NULL on the current row.
- Expiry RPC clears reserved_by when releasing unpaid holds.
*/

-- ---------------------------------------------------------------------------
-- Reject stolen reservations (A → B) unless elevated override
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.vehicles_enforce_reservation_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  holder_name text;
BEGIN
  IF NEW.reserved_by IS NOT DISTINCT FROM OLD.reserved_by THEN
    RETURN NEW;
  END IF;

  -- Claiming a free unit, or releasing (NULL) after override / expiry
  IF OLD.reserved_by IS NULL OR NEW.reserved_by IS NULL THEN
    RETURN NEW;
  END IF;

  -- Reassign A → B only for admin / operations / manager
  IF public.is_admin_user()
    OR public.has_role('operations')
    OR public.has_role('manager')
  THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(trim(p.full_name), ''), NULLIF(trim(p.display_name), ''), NULLIF(trim(p.email), ''), 'another agent')
  INTO holder_name
  FROM public.profiles p
  WHERE p.id = OLD.reserved_by;

  RAISE EXCEPTION 'already reserved by %', COALESCE(holder_name, 'another agent')
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS vehicles_enforce_reservation_exclusivity ON public.vehicles;
CREATE TRIGGER vehicles_enforce_reservation_exclusivity
  BEFORE UPDATE OF reserved_by ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.vehicles_enforce_reservation_exclusivity();

REVOKE ALL ON FUNCTION public.vehicles_enforce_reservation_exclusivity() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sales may only start a reserve on a free unit (available + no holder)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "vehicles_update_sales_reserve" ON public.vehicles;
CREATE POLICY "vehicles_update_sales_reserve" ON public.vehicles
  FOR UPDATE TO authenticated
  USING (
    (public.has_role('sales_agent') OR public.has_role('freelancer'))
    AND payment_status = 'available'
    AND reserved_by IS NULL
  )
  WITH CHECK (
    (public.has_role('sales_agent') OR public.has_role('freelancer'))
    AND payment_status = 'reserved'
    AND customer_id IS NOT NULL
    AND reserved_by = auth.uid()
    AND public.customer_owned_by_agent(customer_id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Expiry must clear the holder so the unit is claimable again
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
    reserved_by = NULL,
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
