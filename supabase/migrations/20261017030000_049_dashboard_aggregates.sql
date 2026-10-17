-- Dashboard money totals by currency (respects RLS via SECURITY INVOKER).
create or replace function public.dashboard_money_by_currency()
returns table (
  bucket text,
  currency text,
  total numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select 'sales'::text as bucket,
         coalesce(nullif(trim(s.currency), ''), 'JPY') as currency,
         coalesce(sum(s.sale_price), 0)::numeric as total
  from public.sales s
  where s.status is distinct from 'cancelled'
  group by 2

  union all

  select 'outstanding'::text,
         coalesce(nullif(trim(i.currency), ''), 'JPY'),
         coalesce(sum(i.total), 0)::numeric
  from public.invoices i
  where i.payment_status in ('unpaid', 'partial')
  group by 2

  union all

  select 'payments'::text,
         coalesce(nullif(trim(p.currency), ''), 'JPY'),
         coalesce(sum(coalesce(p.remit_amount, p.amount)), 0)::numeric
  from public.payments p
  where p.status is distinct from 'rejected'
  group by 2

  union all

  select 'expenses'::text,
         coalesce(nullif(trim(e.currency), ''), 'JPY'),
         coalesce(sum(e.amount), 0)::numeric
  from public.expenses e
  where e.status in ('paid', 'approved')
  group by 2;
$$;

grant execute on function public.dashboard_money_by_currency() to authenticated;
