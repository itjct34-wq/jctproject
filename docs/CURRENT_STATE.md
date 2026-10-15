# Current State

Verified checkpoint for developers and operators. Update when infra, branch, or migration baseline changes.

## Repository

| Item | Value |
|------|--------|
| Workspace | `jctproject` (Next.js monolith) |
| Active branch | **`feat/home-page-redesign`** |
| Entry README | [README.md](../README.md) |
| Docs | `docs/*.md` (this set) |

## Infrastructure

| Service | Identifier |
|---------|------------|
| Supabase project | **`omlejtzwodudghqqgaiz`** |
| Vercel project | **`jct16`** |
| Alternate build config | `netlify.toml` (optional) |

## Application stack

- Next.js **13.5.1**, React 18, TypeScript 5.2, Tailwind 3.3, Supabase JS 2.58.
- App Router: public routes at repo `app/` root; ERP under `app/(app)/`.

## Database evidence (expected on production)

For full public catalog + ERP auction directory, production should include:

- Column **`vehicles.source_country_code`** (019)
- Table **`vehicle_images`** + bucket **`vehicle-images`** (020–021)
- Column **`vehicles.stock_category`**, **`part_sku`** (022)
- View **`auction_houses`** (023)

If machinery/parts pages error or photos never load, run migrations **019–023** in the Supabase SQL editor (files in `supabase/migrations/`).

## Environment (local)

Create **`.env.local`** with:

- `NEXT_PUBLIC_SUPABASE_URL` → `https://omlejtzwodudghqqgaiz.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → anon JWT from Supabase dashboard (not committed)
- `SUPABASE_SERVICE_ROLE_KEY` → server-only, for admin APIs

See [DEPLOYMENT.md](DEPLOYMENT.md) and [SECURITY.md](SECURITY.md).

## Next phase

1. Finish **home page redesign** on `feat/home-page-redesign` and deploy to Vercel preview/prod.
2. Confirm production DB migration level (019–023).
3. Optional: add smoke tests for verify URLs and bulk import.

## Consistency

This file must agree with [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) and the code under `app/`, `components/`, and `supabase/migrations/`. If code and docs diverge, update docs to match code.
