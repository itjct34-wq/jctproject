# Deployment

## Production topology

| Component | Target |
|-----------|--------|
| Web app | **Vercel** project **`jct16`** |
| Database, auth, storage | **Supabase** project **`omlejtzwodudghqqgaiz`** |
| Public domain | Marketing domain (e.g. japancirculartrading.com) aliased in Vercel |

The repository also contains **`netlify.toml`** and `@netlify/plugin-nextjs` for optional Netlify builds; primary operations documentation assumes **Vercel**.

## Build

- Command: `npm run build` (`next build`).
- Node 18+ recommended (matches `@types/node` 20.x in dependencies).
- Env vars must be set in the Vercel project **before** build if pages require live Supabase at build time; client env uses `NEXT_PUBLIC_*` prefix.

## Required environment variables

| Name | Where | Purpose |
|------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + local | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + local | Browser/client Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (server) + local | Admin invite, verification, photo ZIP server paths |
| `AGENT_TOTP_SECRET` | Vercel (server) + local | Fallback HMAC for agent codes if a row has no `totp_secret` |
| `NEXT_PUBLIC_SITE_URL` | Vercel + local | Canonical URL for sitemap / invoice QR |
| `NEXT_PUBLIC_APP_URL` | Vercel + local | Alternate public origin |
| `CRON_SECRET` | Vercel (server) | Bearer token for `/api/cron/*` keep-alive routes |

Do not store service role keys in client bundles or public docs. Template: `.env.example`.

## Supabase keep-alive (Vercel Cron)

Free-tier Supabase projects can pause after inactivity. Production uses a Vercel Cron job defined in `vercel.json`:

| Item | Value |
|------|--------|
| Path | `/api/cron/supabase-ping` |
| Schedule | `0 */8 * * *` (every 8 hours) |
| Auth | `Authorization: Bearer <CRON_SECRET>` |

**Vercel setup**

1. Set `CRON_SECRET` in the Vercel project (Production + Preview if you want preview crons). Use a long random value.
2. Ensure Crons are enabled for the project (Hobby: at most daily schedules; Pro+ required for sub-daily such as every 8 hours).
3. Redeploy after adding `vercel.json` so the cron is registered.
4. Confirm in Vercel → Project → Settings → Cron Jobs that the path appears.

The route runs a lightweight service-role query, writes a row to `system_health_pings`, and updates `system_config.supabase_last_ping`. Admins can inspect status and run a manual check at `/admin/monitor`.

## Database releases

1. Add migration SQL under `supabase/migrations/`.
2. Apply to production via Supabase SQL editor or CLI (`supabase db push`), in order.
3. For JCT production catch-up, migrations **019–030** (FOB workflow, sales RLS, TOTP/reservations). See [DATABASE.md](DATABASE.md) and [MIGRATIONS.md](MIGRATIONS.md).

## Rollback

- **App**: Redeploy previous Vercel deployment or revert git on branch and redeploy.
- **Database**: Migrations are forward-only in ops practice; write compensating SQL if rollback is required; do not drop RLS-enabled tables without a plan.

## Backups

- Rely on Supabase project backups/PITR per Supabase plan settings.
- Export critical config (`system_config`) periodically if making large manual SQL edits.

## Branch workflow

Feature work: branch **`feat/vehicle-commercial-workflow`**. Pushing this branch to GitHub triggers Vercel team **jct16**. GitHub Actions CI runs lint, typecheck, and build on PR and push.
