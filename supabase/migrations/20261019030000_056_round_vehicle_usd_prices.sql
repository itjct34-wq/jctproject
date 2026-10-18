-- Vehicle listing / FOB / sold USD prices: whole dollars only (no cents).
-- Trigger previously used round(..., 2), which reintroduced decimals on bid saves.

CREATE OR REPLACE FUNCTION public.vehicles_apply_fob_from_bid()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tt_rate IS NULL OR NEW.tt_rate <= 0 THEN
    NEW.tt_rate := 155;
  END IF;
  IF NEW.expense_jpy IS NULL THEN
    NEW.expense_jpy := 45000;
  END IF;

  IF NEW.purchase_price IS NOT NULL THEN
    NEW.fob_usd := round((NEW.purchase_price * 1.1 + NEW.expense_jpy) / NEW.tt_rate);
    NEW.listed_price := NEW.fob_usd;
    IF NEW.listed_currency IS NULL OR NEW.listed_currency = '' THEN
      NEW.listed_currency := 'USD';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.vehicles
SET
  fob_usd = CASE WHEN fob_usd IS NOT NULL THEN round(fob_usd) ELSE fob_usd END,
  listed_price = CASE WHEN listed_price IS NOT NULL THEN round(listed_price) ELSE listed_price END,
  sold_price = CASE WHEN sold_price IS NOT NULL THEN round(sold_price) ELSE sold_price END,
  fob_jpy = CASE WHEN fob_jpy IS NOT NULL THEN round(fob_jpy) ELSE fob_jpy END
WHERE
  (fob_usd IS NOT NULL AND fob_usd <> round(fob_usd))
  OR (listed_price IS NOT NULL AND listed_price <> round(listed_price))
  OR (sold_price IS NOT NULL AND sold_price <> round(sold_price))
  OR (fob_jpy IS NOT NULL AND fob_jpy <> round(fob_jpy));
