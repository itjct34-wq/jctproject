/*
  Optional freight description for invoice / quotation freight tables.
  Amounts already live on invoices.freight_total and quotations.freight.
*/

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS freight_notes text;

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS freight_notes text;
