/*
# Auction house directory view

Physical storage: public.suppliers where supplier_type = 'auction_house'.
auction_listings.supplier_id references those rows.
*/

CREATE OR REPLACE VIEW public.auction_houses
WITH (security_invoker = true)
AS
SELECT
  id,
  supplier_code,
  name,
  city,
  country,
  status,
  created_at,
  updated_at
FROM public.suppliers
WHERE supplier_type = 'auction_house';

COMMENT ON VIEW public.auction_houses IS
  'Auction house directory; each row is a suppliers record with supplier_type = auction_house.';

GRANT SELECT ON public.auction_houses TO authenticated;
