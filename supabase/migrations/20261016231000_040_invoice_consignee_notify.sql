/*
# Invoice consignee / notify-party snapshot for reservation invoices

Customer remains the source of truth; these columns capture what was on the
invoice at reservation time (buyer may edit consignee on the form).
*/

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS consignee_name text,
  ADD COLUMN IF NOT EXISTS consignee_country text,
  ADD COLUMN IF NOT EXISTS consignee_city text,
  ADD COLUMN IF NOT EXISTS consignee_address text,
  ADD COLUMN IF NOT EXISTS consignee_phone text,
  ADD COLUMN IF NOT EXISTS consignee_email text,
  ADD COLUMN IF NOT EXISTS notify_party_name text,
  ADD COLUMN IF NOT EXISTS notify_party_country text,
  ADD COLUMN IF NOT EXISTS notify_party_city text,
  ADD COLUMN IF NOT EXISTS notify_party_address text,
  ADD COLUMN IF NOT EXISTS notify_party_phone text,
  ADD COLUMN IF NOT EXISTS notify_party_email text,
  ADD COLUMN IF NOT EXISTS destination_country text,
  ADD COLUMN IF NOT EXISTS payment_due_date date,
  ADD COLUMN IF NOT EXISTS email_invoice boolean DEFAULT false;

COMMENT ON COLUMN public.invoices.consignee_name IS 'Consignee snapshot at invoice creation';
COMMENT ON COLUMN public.invoices.notify_party_name IS 'Notify party snapshot; may match consignee';
COMMENT ON COLUMN public.invoices.payment_due_date IS 'Payment due date (may differ from invoice due_date hold)';
