/*
# Vehicle shipping + courier fields (stock card / edit forms)

Reuse existing: freight_mode, shipping_port_of_loading, shipping_status,
shipping_vessel_name, shipping_line, shipping_etd, shipping_eta,
shipping_bl_number, shipping_port_of_discharge, shipping_notes.

Add booking/container/courier columns and expand attachment doc_kind.
Booking fields (ETD/ETA/booking number/etc.) still advance shipping_status → booked.
BL attachment → shipped; surrender/waybill → delivered (unchanged).
*/

-- ---------------------------------------------------------------------------
-- Shipping booking / container fields
-- ---------------------------------------------------------------------------

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS shipping_voyage_number text,
  ADD COLUMN IF NOT EXISTS shipping_cut_off_date date,
  ADD COLUMN IF NOT EXISTS shipping_booking_number text,
  ADD COLUMN IF NOT EXISTS shipping_track_url text,
  ADD COLUMN IF NOT EXISTS shipping_bl_date date,
  ADD COLUMN IF NOT EXISTS shipping_place_of_delivery text,
  ADD COLUMN IF NOT EXISTS shipping_forwarding_agent text,
  ADD COLUMN IF NOT EXISTS shipping_freight_charges numeric(14,2),
  ADD COLUMN IF NOT EXISTS shipping_vanning_charges numeric(14,2),
  ADD COLUMN IF NOT EXISTS shipping_container_number text;

-- ---------------------------------------------------------------------------
-- Courier fields
-- ---------------------------------------------------------------------------

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS courier_selection text,
  ADD COLUMN IF NOT EXISTS courier_company text,
  ADD COLUMN IF NOT EXISTS courier_tracking_id text,
  ADD COLUMN IF NOT EXISTS courier_date date,
  ADD COLUMN IF NOT EXISTS courier_details text,
  ADD COLUMN IF NOT EXISTS courier_charges numeric(14,2);

COMMENT ON COLUMN public.vehicles.shipping_voyage_number IS 'Voyage number for booked shipment';
COMMENT ON COLUMN public.vehicles.shipping_booking_number IS 'Carrier booking reference';
COMMENT ON COLUMN public.vehicles.shipping_container_number IS 'Container number when freight_mode = container';
COMMENT ON COLUMN public.vehicles.courier_selection IS 'Courier picker value (DHL, EMS, Japan Post, etc.)';

-- ---------------------------------------------------------------------------
-- Attachment doc kinds used by shipping / courier uploads
-- ---------------------------------------------------------------------------

ALTER TABLE public.record_attachments
  DROP CONSTRAINT IF EXISTS record_attachments_doc_kind_check;

ALTER TABLE public.record_attachments
  ADD CONSTRAINT record_attachments_doc_kind_check
  CHECK (
    doc_kind IS NULL
    OR doc_kind IN (
      'bl',
      'amend_bl',
      'surrender',
      'draft',
      'waybill',
      'shipping_invoice',
      'export_certificate',
      'export_certificate_en',
      'inspection',
      'auction_sheet',
      'spare_key',
      'dhl',
      'other'
    )
  );

-- ---------------------------------------------------------------------------
-- Booked when ETD/ETA/booking (or other booking cues) are filled
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
       OR COALESCE(NEW.shipping_place_of_delivery, '') <> ''
       OR COALESCE(NEW.shipping_vessel_name, '') <> ''
       OR COALESCE(NEW.shipping_bl_number, '') <> ''
       OR COALESCE(NEW.shipping_line, '') <> ''
       OR COALESCE(NEW.shipping_voyage_number, '') <> ''
       OR COALESCE(NEW.shipping_booking_number, '') <> ''
       OR COALESCE(NEW.shipping_container_number, '') <> ''
       OR NEW.shipping_etd IS NOT NULL
       OR NEW.shipping_eta IS NOT NULL
       OR NEW.shipping_cut_off_date IS NOT NULL
     )
  THEN
    NEW.shipping_status := 'booked';
  END IF;

  RETURN NEW;
END;
$$;
