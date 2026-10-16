/*
# Sync invoice payment_status from vehicle remittance allocations

1. New Functions
- `sync_invoices_for_vehicle_payment(uuid)`: updates linked invoices when a
  vehicle payment_status changes via remittance allocations.

2. Modified Functions
- `recompute_vehicle_payment_status(uuid)`: after recomputing vehicle status,
  calls sync so invoices mirror unpaid / partial / paid.

3. Schema
- `invoices.invoice_type` default changed from commercial to proforma.

4. Important Notes
- Linkage: invoice_items.vehicle_id OR invoices.sale_id → sales.vehicle_id.
- Multi-vehicle invoices: paid only if every linked vehicle is paid; otherwise
  partial if any is partial_paid/paid; else unpaid.
- Never overwrites cancelled or credited invoices.
- Reverse-safe on deallocate (hooks the existing recompute path).
*/

CREATE OR REPLACE FUNCTION public.sync_invoices_for_vehicle_payment(p_vehicle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  v_statuses text[];
  target text;
BEGIN
  IF p_vehicle_id IS NULL THEN
    RETURN;
  END IF;

  FOR inv IN
    SELECT DISTINCT i.id
    FROM public.invoices i
    WHERE i.payment_status NOT IN ('cancelled', 'credited')
      AND (
        EXISTS (
          SELECT 1
          FROM public.invoice_items ii
          WHERE ii.invoice_id = i.id
            AND ii.vehicle_id = p_vehicle_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.sales s
          WHERE s.id = i.sale_id
            AND s.vehicle_id = p_vehicle_id
        )
      )
  LOOP
    SELECT array_agg(DISTINCT v.payment_status)
    INTO v_statuses
    FROM (
      SELECT ii.vehicle_id AS vid
      FROM public.invoice_items ii
      WHERE ii.invoice_id = inv.id
        AND ii.vehicle_id IS NOT NULL
      UNION
      SELECT s.vehicle_id
      FROM public.invoices i2
      JOIN public.sales s ON s.id = i2.sale_id
      WHERE i2.id = inv.id
        AND s.vehicle_id IS NOT NULL
    ) linked
    JOIN public.vehicles v ON v.id = linked.vid;

    IF v_statuses IS NULL OR cardinality(v_statuses) = 0 THEN
      CONTINUE;
    END IF;

    IF (SELECT bool_and(st = 'paid') FROM unnest(v_statuses) AS st) THEN
      target := 'paid';
    ELSIF EXISTS (
      SELECT 1 FROM unnest(v_statuses) AS st
      WHERE st IN ('partial_paid', 'paid')
    ) THEN
      target := 'partial';
    ELSE
      target := 'unpaid';
    END IF;

    UPDATE public.invoices
    SET payment_status = target, updated_at = now()
    WHERE id = inv.id
      AND payment_status IS DISTINCT FROM target
      AND payment_status NOT IN ('cancelled', 'credited');
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_vehicle_payment_status(p_vehicle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listed numeric;
  paid numeric;
  cur_status text;
BEGIN
  IF p_vehicle_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    payment_status,
    COALESCE(sold_price, fob_usd, listed_price)
  INTO cur_status, listed
  FROM public.vehicles
  WHERE id = p_vehicle_id
  FOR UPDATE;

  IF cur_status IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(a.allocate_amount), 0)
  INTO paid
  FROM public.payment_allocations a
  JOIN public.payments p ON p.id = a.payment_id
  WHERE a.vehicle_id = p_vehicle_id
    AND p.status IN ('pending', 'received', 'reconciled');

  -- Legacy single-vehicle payments with no allocation row yet
  IF paid = 0 THEN
    SELECT COALESCE(SUM(p.amount), 0)
    INTO paid
    FROM public.payments p
    WHERE p.vehicle_id = p_vehicle_id
      AND p.status IN ('pending', 'received', 'reconciled')
      AND NOT EXISTS (
        SELECT 1 FROM public.payment_allocations a WHERE a.payment_id = p.id
      );
  END IF;

  IF paid <= 0 THEN
    IF cur_status IN ('partial_paid', 'paid') THEN
      UPDATE public.vehicles SET payment_status = 'reserved', updated_at = now()
      WHERE id = p_vehicle_id AND payment_status IN ('partial_paid', 'paid');
    END IF;
    PERFORM public.sync_invoices_for_vehicle_payment(p_vehicle_id);
    RETURN;
  END IF;

  IF listed IS NOT NULL AND listed > 0 AND paid >= listed THEN
    UPDATE public.vehicles SET payment_status = 'paid', updated_at = now()
    WHERE id = p_vehicle_id;
  ELSE
    UPDATE public.vehicles SET payment_status = 'partial_paid', updated_at = now()
    WHERE id = p_vehicle_id;
  END IF;

  PERFORM public.sync_invoices_for_vehicle_payment(p_vehicle_id);
END;
$$;

ALTER TABLE public.invoices
  ALTER COLUMN invoice_type SET DEFAULT 'proforma';

REVOKE ALL ON FUNCTION public.sync_invoices_for_vehicle_payment(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_vehicle_payment_status(uuid) FROM PUBLIC, anon, authenticated;
