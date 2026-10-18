# Current State

Verified checkpoint for developers and operators. Update when infra, branch, or migration baseline changes.

## Repository

| Item | Value |
|------|--------|
| Workspace | `jctproject` (Next.js monolith) |
| Active branch | **`main`** |
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
- CI: `.github/workflows/ci.yml` (`npm ci`, lint, typecheck, build).

## Database evidence (expected on production)

For full public catalog + ERP auction directory + commercial workflow, production should include:

- Column **`vehicles.source_country_code`** (019)
- Table **`vehicle_images`** + bucket **`vehicle-images`** (020–021)
- Column **`vehicles.stock_category`**, **`part_sku`** (022)
- View **`auction_houses`** (023)
- Table **`bulk_import_batches`** (027)
- FOB / payment / shipping workflow columns and triggers (028)
- Sales own-records RLS (029)
- Per-agent TOTP secret, reservation expiry RPC, status sync (030)
- Customer `assigned_to` ownership + commercial follow (031)
- Vehicle `freight_mode` (032)
- `user_payroll` + vehicle commission PKR/status (033)

See [MIGRATIONS.md](MIGRATIONS.md) for duplicate historical 009/013/014 names — do not rewrite applied files.

If machinery/parts pages error or photos never load, run migrations **019–023** (and **028–033** for FOB/sales assignment, freight mode, payroll, and commission) in the Supabase SQL editor.

## Environment (local)

Copy **`.env.example`** to **`.env.local`**. Required names:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AGENT_TOTP_SECRET` (fallback if an agent has no per-row secret yet)
- `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` (sitemap, invoice QR)

See [DEPLOYMENT.md](DEPLOYMENT.md) and [SECURITY.md](SECURITY.md).

## Next phase

1. Keep shipping **`feat/vehicle-commercial-workflow`** to Vercel **jct16**.
2. Confirm production DB includes **028–033**.
3. Deferred: Next 14/15 upgrade, Playwright, Sentry (no DSN), WhatsApp alerts, admin SMS MFA.

## Consistency

This file must agree with [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) and the code under `app/`, `components/`, and `supabase/migrations/`. If code and docs diverge, update docs to match code.
