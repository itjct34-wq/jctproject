# Testing

## Current state

The repository **does not include an automated test suite** (no Jest/Vitest/Playwright config or `*.test.*` files in the application tree).

## Quality gates in use

| Gate | Command | Purpose |
|------|---------|---------|
| TypeScript | `npm run typecheck` | Static type correctness |
| ESLint | `npm run lint` | Next.js ESLint rules |
| Manual ERP | — | Role-based smoke tests per module after schema changes |
| Manual public | — | Catalog routes, verify URLs, inquiry submit |

## What to verify manually (high value)

1. **Migrations 019–023** applied: public `/inventory`, `/machinery`, `/parts` load; images appear when ZIP imported.
2. **Invoice print**: `NO.` prefix, banking table, notes footer, QR toggle, bank notice optional second page.
3. **Bulk vehicle import**: spreadsheet + ZIP folder matching chassis/stock/SKU.
4. **Admin user invite**: password login for new user.
5. **Payment attachment** upload and signed download.
6. **Auction house** pickers on auctions and configuration panel.

## Adding tests (future)

- Prefer integration tests against Supabase local stack for RLS-sensitive flows.
- Print layout: snapshot or PDF regression on `OfficialTradeDocument` props fixtures.
- Do not document test counts or CI badges until tests exist in repo.
