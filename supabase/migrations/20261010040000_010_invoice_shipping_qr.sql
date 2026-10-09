/*
  # Invoice shipping terms + QR verification

  Adds commercial invoice shipping fields (Incoterms, RORO/container, ports)
  and a public verification token for QR code authenticity checks.
*/

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS incoterms text DEFAULT 'FOB',
  ADD COLUMN IF NOT EXISTS shipment_type text DEFAULT 'RORO',
  ADD COLUMN IF NOT EXISTS container_mode text DEFAULT 'RORO Vessel',
  ADD COLUMN IF NOT EXISTS port_of_loading text DEFAULT 'Nagoya, Japan',
  ADD COLUMN IF NOT EXISTS port_of_discharge text,
  ADD COLUMN IF NOT EXISTS vessel_name text,
  ADD COLUMN IF NOT EXISTS bl_number text,
  ADD COLUMN IF NOT EXISTS freight_total numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insurance_total numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_charges numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_total numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  ADD COLUMN IF NOT EXISTS bank_details text,
  ADD COLUMN IF NOT EXISTS payment_terms text DEFAULT '100% T/T in advance / LC at sight';

CREATE INDEX IF NOT EXISTS invoices_verification_token_idx ON public.invoices(verification_token);

-- Public read-only access for verification page (anon can only read limited fields via RPC)
CREATE OR REPLACE FUNCTION public.verify_invoice(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'valid', true,
    'invoice_code', i.invoice_code,
    'invoice_type', i.invoice_type,
    'issue_date', i.issue_date,
    'currency', i.currency,
    'total', i.total,
    'payment_status', i.payment_status,
    'incoterms', i.incoterms,
    'shipment_type', i.shipment_type,
    'container_mode', i.container_mode,
    'port_of_loading', i.port_of_loading,
    'port_of_discharge', i.port_of_discharge,
    'customer_name', c.full_name,
    'company_name', 'Japan Circular Trading',
    'verified_at', now()
  )
  INTO result
  FROM public.invoices i
  LEFT JOIN public.customers c ON c.id = i.customer_id
  WHERE i.verification_token = p_token
    AND i.payment_status NOT IN ('cancelled');

  IF result IS NULL THEN
    RETURN json_build_object('valid', false, 'message', 'Invoice not found or invalid');
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_invoice(text) TO anon, authenticated;
