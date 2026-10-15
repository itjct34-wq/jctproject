/*
# Vehicle payment/shipping tracks, payment allocation, sales-scoped RLS

- payment_status + shipping_status on vehicles (orthogonal to legacy status for public site)
- customer_id / reserved_by on vehicles for reservations
- payments.vehicle_id + payments.sales_agent_id (from customer owner)
- Sales/freelancer: reserve available stock, read TTs for their customers
- Courier documents on vehicles via record_attachments entity_type vehicles
*/

-- ---------------------------------------------------------------------------
-- Vehicles: dual-track columns + reservation linkage
-- ---------------------------------------------------------------------------

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'available'
    CHECK (payment_status IN ('available', 'reserved', 'partial_paid', 'paid')),
  ADD COLUMN IF NOT EXISTS shipping_status text NOT NULL DEFAULT 'not_booked'
    CHECK (shipping_status IN ('not_booked', 'booked', 'shipped', 'delivered')),
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reserved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shipping_port_of_loading text,
  ADD COLUMN IF NOT EXISTS shipping_port_of_discharge text,
  ADD COLUMN IF NOT EXISTS shipping_vessel_name text,
  ADD COLUMN IF NOT EXISTS shipping_bl_number text,
  ADD COLUMN IF NOT EXISTS shipping_line text,
  ADD COLUMN IF NOT EXISTS shipping_etd date,
  ADD COLUMN IF NOT EXISTS shipping_eta date,
  ADD COLUMN IF NOT EXISTS shipping_notes text;

CREATE INDEX IF NOT EXISTS vehicles_payment_status_idx ON public.vehicles (payment_status);
CREATE INDEX IF NOT EXISTS vehicles_shipping_status_idx ON public.vehicles (shipping_status);
CREATE INDEX IF NOT EXISTS vehicles_customer_id_idx ON public.vehicles (customer_id);
CREATE INDEX IF NOT EXISTS vehicles_reserved_by_idx ON public.vehicles (reserved_by);

UPDATE public.vehicles v
SET
  payment_status = CASE v.status
    WHEN 'in_stock' THEN 'available'
    WHEN 'reserved' THEN 'reserved'
    WHEN 'sold' THEN 'paid'
    WHEN 'in_transit' THEN 'paid'
    WHEN 'exported' THEN 'paid'
    WHEN 'on_hold' THEN 'available'
    WHEN 'archived' THEN 'paid'
    ELSE 'available'
  END,
  shipping_status = CASE v.status
    WHEN 'in_transit' THEN 'shipped'
    WHEN 'exported' THEN 'delivered'
    ELSE 'not_booked'
  END
WHERE v.payment_status = 'available' AND v.shipping_status = 'not_booked';

UPDATE public.vehicles
SET shipping_status = 'booked'
WHERE status IN ('sold', 'reserved') AND shipping_status = 'not_booked' AND payment_status = 'paid';

CREATE OR REPLACE FUNCTION public.sync_vehicle_legacy_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('on_hold', 'archived') THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_status = 'available' THEN
    NEW.status := 'in_stock';
  ELSIF NEW.payment_status IN ('reserved', 'partial_paid') THEN
    NEW.status := 'reserved';
  ELSIF NEW.payment_status = 'paid' THEN
    NEW.status := CASE NEW.shipping_status
      WHEN 'delivered' THEN 'exported'
      WHEN 'booked' THEN 'sold'
      WHEN 'shipped' THEN 'in_transit'
      ELSE 'sold'
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehicles_sync_legacy_status ON public.vehicles;
CREATE TRIGGER vehicles_sync_legacy_status
  BEFORE INSERT OR UPDATE OF payment_status, shipping_status ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_vehicle_legacy_status();

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
      RAISE EXCEPTION 'Sales users may only reserve vehicles (customer link and payment status)';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehicles_enforce_sales_update ON public.vehicles;
CREATE TRIGGER vehicles_enforce_sales_update
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.vehicles_enforce_sales_update();

CREATE OR REPLACE FUNCTION public.customer_owned_by_agent(p_customer_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = p_customer_id
      AND (c.assigned_to = p_user_id OR c.created_by = p_user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_vehicle(p_vehicle_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id = p_vehicle_id
      AND (
        public.is_admin_user()
        OR public.has_role('operations')
        OR public.has_role('manager')
        OR public.has_role('accounts')
        OR public.has_role('auditor')
        OR public.has_role('sales_agent')
        OR public.has_role('freelancer')
        OR v.reserved_by = auth.uid()
        OR (v.customer_id IS NOT NULL AND public.customer_owned_by_agent(v.customer_id, auth.uid()))
      )
  );
$$;

DROP POLICY IF EXISTS "vehicles_update_operations" ON public.vehicles;
CREATE POLICY "vehicles_update_staff" ON public.vehicles
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_user()
    OR public.has_role('operations')
    OR public.has_role('manager')
  )
  WITH CHECK (
    public.is_admin_user()
    OR public.has_role('operations')
    OR public.has_role('manager')
  );

DROP POLICY IF EXISTS "vehicles_update_sales_reserve" ON public.vehicles;
CREATE POLICY "vehicles_update_sales_reserve" ON public.vehicles
  FOR UPDATE TO authenticated
  USING (
    (public.has_role('sales_agent') OR public.has_role('freelancer'))
    AND payment_status = 'available'
  )
  WITH CHECK (
    (public.has_role('sales_agent') OR public.has_role('freelancer'))
    AND payment_status = 'reserved'
    AND customer_id IS NOT NULL
    AND reserved_by = auth.uid()
    AND public.customer_owned_by_agent(customer_id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Payments: vehicle allocation + sales agent tagging
-- ---------------------------------------------------------------------------

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sales_agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payments_vehicle_id_idx ON public.payments (vehicle_id);
CREATE INDEX IF NOT EXISTS payments_sales_agent_id_idx ON public.payments (sales_agent_id);

CREATE OR REPLACE FUNCTION public.payments_set_sales_agent_from_customer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  agent uuid;
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    SELECT COALESCE(c.assigned_to, c.created_by)
    INTO agent
    FROM public.customers c
    WHERE c.id = NEW.customer_id;
    NEW.sales_agent_id := agent;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_set_sales_agent ON public.payments;
CREATE TRIGGER payments_set_sales_agent
  BEFORE INSERT OR UPDATE OF customer_id ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.payments_set_sales_agent_from_customer();

CREATE OR REPLACE FUNCTION public.recompute_vehicle_payment_status(p_vehicle_id uuid)
RETURNS void
LANGUAGE plpgsql
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

  SELECT payment_status, listed_price
  INTO cur_status, listed
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

  IF listed IS NOT NULL AND listed > 0 AND paid >= listed THEN
    UPDATE public.vehicles SET payment_status = 'paid' WHERE id = p_vehicle_id;
  ELSE
    UPDATE public.vehicles SET payment_status = 'partial_paid' WHERE id = p_vehicle_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.payments_after_change_vehicle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_vehicle_payment_status(OLD.vehicle_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.vehicle_id IS DISTINCT FROM NEW.vehicle_id THEN
    PERFORM public.recompute_vehicle_payment_status(OLD.vehicle_id);
  END IF;

  IF NEW.vehicle_id IS NOT NULL AND NEW.status IN ('received', 'reconciled') THEN
    PERFORM public.recompute_vehicle_payment_status(NEW.vehicle_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_after_change_vehicle ON public.payments;
CREATE TRIGGER payments_after_change_vehicle
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.payments_after_change_vehicle();

UPDATE public.payments p
SET sales_agent_id = COALESCE(c.assigned_to, c.created_by)
FROM public.customers c
WHERE p.customer_id = c.id AND p.sales_agent_id IS NULL;

DROP POLICY IF EXISTS "payments_select_ops" ON public.payments;
CREATE POLICY "payments_select_ops" ON public.payments
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR public.has_role('manager')
    OR public.has_role('accounts')
    OR public.has_role('auditor')
    OR (
      (public.has_role('sales_agent') OR public.has_role('freelancer'))
      AND (
        sales_agent_id = auth.uid()
        OR (
          customer_id IS NOT NULL
          AND public.customer_owned_by_agent(customer_id, auth.uid())
        )
      )
    )
  );

DROP POLICY IF EXISTS "vehicle_history_insert_operations" ON public.vehicle_status_history;
CREATE POLICY "vehicle_history_insert_staff_or_sales" ON public.vehicle_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    changed_by = auth.uid()
    AND (
      public.is_admin_user()
      OR public.has_role('operations')
      OR public.has_role('manager')
      OR (
        (public.has_role('sales_agent') OR public.has_role('freelancer'))
        AND to_status = 'reserved'
      )
    )
  );

-- Insert/update/delete unchanged: admin, manager, accounts only

-- ---------------------------------------------------------------------------
-- record_attachments: vehicles (courier / shipping docs)
-- ---------------------------------------------------------------------------

ALTER TABLE public.record_attachments
  DROP CONSTRAINT IF EXISTS record_attachments_entity_type_check;

ALTER TABLE public.record_attachments
  ADD CONSTRAINT record_attachments_entity_type_check
  CHECK (entity_type IN ('invoices', 'quotations', 'payments', 'expenses', 'documents', 'vehicles'));

DROP POLICY IF EXISTS record_attachments_select ON public.record_attachments;
CREATE POLICY record_attachments_select
  ON public.record_attachments FOR SELECT TO authenticated
  USING (
    CASE entity_type
      WHEN 'invoices' THEN public.has_permission('invoices', 'view')
      WHEN 'quotations' THEN public.has_permission('sales', 'view')
      WHEN 'payments' THEN public.has_permission('payments', 'view')
      WHEN 'expenses' THEN public.has_permission('expenses', 'view')
      WHEN 'documents' THEN public.has_permission('documents', 'view')
      WHEN 'vehicles' THEN public.can_view_vehicle(entity_id)
      ELSE false
    END
  );

DROP POLICY IF EXISTS record_attachments_insert ON public.record_attachments;
CREATE POLICY record_attachments_insert
  ON public.record_attachments FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND CASE entity_type
      WHEN 'invoices' THEN public.has_permission('invoices', 'create') OR public.has_permission('invoices', 'edit')
      WHEN 'quotations' THEN public.has_permission('sales', 'create') OR public.has_permission('sales', 'edit')
      WHEN 'payments' THEN public.has_permission('payments', 'create') OR public.has_permission('payments', 'edit')
      WHEN 'expenses' THEN public.has_permission('expenses', 'create') OR public.has_permission('expenses', 'edit')
      WHEN 'documents' THEN public.has_permission('documents', 'create') OR public.has_permission('documents', 'edit')
      WHEN 'vehicles' THEN
        public.is_admin_user()
        OR public.has_role('operations')
        OR public.has_role('manager')
      ELSE false
    END
  );

DROP POLICY IF EXISTS record_attachments_delete ON public.record_attachments;
CREATE POLICY record_attachments_delete
  ON public.record_attachments FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR CASE entity_type
      WHEN 'invoices' THEN public.has_permission('invoices', 'edit')
      WHEN 'quotations' THEN public.has_permission('sales', 'edit')
      WHEN 'payments' THEN public.has_permission('payments', 'edit')
      WHEN 'expenses' THEN public.has_permission('expenses', 'edit')
      WHEN 'documents' THEN public.has_permission('documents', 'edit')
      WHEN 'vehicles' THEN
        public.is_admin_user()
        OR public.has_role('operations')
        OR public.has_role('manager')
      ELSE false
    END
  );

DROP POLICY IF EXISTS record_attachments_storage_insert ON storage.objects;
CREATE POLICY record_attachments_storage_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'record-attachments'
    AND CASE (storage.foldername(name))[1]
      WHEN 'invoices' THEN public.has_permission('invoices', 'create') OR public.has_permission('invoices', 'edit')
      WHEN 'quotations' THEN public.has_permission('sales', 'create') OR public.has_permission('sales', 'edit')
      WHEN 'payments' THEN public.has_permission('payments', 'create') OR public.has_permission('payments', 'edit')
      WHEN 'expenses' THEN public.has_permission('expenses', 'create') OR public.has_permission('expenses', 'edit')
      WHEN 'documents' THEN public.has_permission('documents', 'create') OR public.has_permission('documents', 'edit')
      WHEN 'vehicles' THEN
        public.is_admin_user()
        OR public.has_role('operations')
        OR public.has_role('manager')
      ELSE false
    END
  );

DROP POLICY IF EXISTS record_attachments_storage_select ON storage.objects;
CREATE POLICY record_attachments_storage_select
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'record-attachments'
    AND EXISTS (
      SELECT 1 FROM public.record_attachments a
      WHERE a.object_path = storage.objects.name
        AND CASE a.entity_type
          WHEN 'invoices' THEN public.has_permission('invoices', 'view')
          WHEN 'quotations' THEN public.has_permission('sales', 'view')
          WHEN 'payments' THEN public.has_permission('payments', 'view')
          WHEN 'expenses' THEN public.has_permission('expenses', 'view')
          WHEN 'documents' THEN public.has_permission('documents', 'view')
          WHEN 'vehicles' THEN public.can_view_vehicle(a.entity_id)
          ELSE false
        END
    )
  );

DROP POLICY IF EXISTS record_attachments_storage_delete ON storage.objects;
CREATE POLICY record_attachments_storage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'record-attachments'
    AND EXISTS (
      SELECT 1 FROM public.record_attachments a
      WHERE a.object_path = storage.objects.name
        AND (
          a.uploaded_by = auth.uid()
          OR CASE a.entity_type
            WHEN 'invoices' THEN public.has_permission('invoices', 'edit')
            WHEN 'quotations' THEN public.has_permission('sales', 'edit')
            WHEN 'payments' THEN public.has_permission('payments', 'edit')
            WHEN 'expenses' THEN public.has_permission('expenses', 'edit')
            WHEN 'documents' THEN public.has_permission('documents', 'edit')
            WHEN 'vehicles' THEN
              public.is_admin_user()
              OR public.has_role('operations')
              OR public.has_role('manager')
            ELSE false
          END
        )
    )
  );
