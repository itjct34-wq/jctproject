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

Do not store service role keys in client bundles or public docs.

## Database releases

1. Add migration SQL under `supabase/migrations/`.
2. Apply to production via Supabase SQL editor or CLI (`supabase db push`), in order.
3. For JCT production catch-up, migrations **019–023** are the usual public-catalog increment (see [DATABASE.md](DATABASE.md)).

## Rollback

- **App**: Redeploy previous Vercel deployment or revert git on branch and redeploy.
- **Database**: Migrations are forward-only in ops practice; write compensating SQL if rollback is required; do not drop RLS-enabled tables without a plan.

## Backups

- Rely on Supabase project backups/PITR per Supabase plan settings.
- Export critical config (`system_config`) periodically if making large manual SQL edits.

## Branch workflow

Feature work for the public home and catalog: branch **`feat/home-page-redesign`**. Merge to production branch triggers Vercel deploy when connected.
