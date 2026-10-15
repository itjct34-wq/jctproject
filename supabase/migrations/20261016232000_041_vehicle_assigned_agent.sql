/*
# Vehicle assigned agent + bid requester (pre-reserve stock hand-off)

- Soft-assign available stock to a sales agent before they reserve
  (assigned_agent_id; distinct from reserved_by).
- Record who wanted to buy (bid_requester_id) with optional bid_request_price.
*/

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS assigned_agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bid_requester_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bid_request_price numeric(14,2);

CREATE INDEX IF NOT EXISTS vehicles_assigned_agent_id_idx
  ON public.vehicles (assigned_agent_id)
  WHERE assigned_agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS vehicles_bid_requester_id_idx
  ON public.vehicles (bid_requester_id)
  WHERE bid_requester_id IS NOT NULL;

COMMENT ON COLUMN public.vehicles.assigned_agent_id IS
  'Sales agent assigned to work this stock before reserve; cleared on make available.';

COMMENT ON COLUMN public.vehicles.bid_requester_id IS
  'User/agent who requested a bid on this unit (informational; optional).';

COMMENT ON COLUMN public.vehicles.bid_request_price IS
  'Optional requested bid amount for bid_requester_id; not required to set a requester.';

-- Staff + selling roles can set bid requester without opening full vehicle UPDATE.
CREATE OR REPLACE FUNCTION public.set_vehicle_bid_requester(
  p_vehicle_id uuid,
  p_requester_id uuid DEFAULT NULL,
  p_bid_price numeric DEFAULT NULL
)
RETURNS public.vehicles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.vehicles;
BEGIN
  IF NOT (
    public.is_elevated_staff()
    OR public.has_role('sales_agent')
    OR public.has_role('freelancer')
  ) THEN
    RAISE EXCEPTION 'Not allowed to set bid requester';
  END IF;

  IF p_requester_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = p_requester_id AND p.is_active IS DISTINCT FROM false
  ) THEN
    RAISE EXCEPTION 'Bid requester not found';
  END IF;

  UPDATE public.vehicles v
  SET
    bid_requester_id = p_requester_id,
    bid_request_price = CASE WHEN p_requester_id IS NULL THEN NULL ELSE p_bid_price END,
    updated_at = now()
  WHERE v.id = p_vehicle_id
  RETURNING * INTO row;

  IF row.id IS NULL THEN
    RAISE EXCEPTION 'Vehicle not found';
  END IF;

  RETURN row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_vehicle_bid_requester(uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_vehicle_bid_requester(uuid, uuid, numeric) TO authenticated;

-- Selling roles already see payment_status = available; also keep visibility when
-- assigned even if payment track drifts, mirroring reserved_by ownership.
CREATE OR REPLACE FUNCTION public.can_view_vehicle(p_vehicle_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    public.is_elevated_staff()
    OR public.has_role('auditor')
    OR EXISTS (
      SELECT 1
      FROM public.vehicles v
      WHERE v.id = p_vehicle_id
        AND public.is_selling_role()
        AND (
          v.payment_status = 'available'
          OR v.reserved_by = auth.uid()
          OR v.assigned_agent_id = auth.uid()
          OR (
            v.customer_id IS NOT NULL
            AND public.customer_owned_by_agent(v.customer_id, auth.uid())
          )
          OR EXISTS (
            SELECT 1
            FROM public.sales s
            WHERE s.vehicle_id = v.id
              AND (
                s.created_by = auth.uid()
                OR public.customer_owned_by_agent(s.customer_id, auth.uid())
              )
          )
        )
    );
$$;
