# Implementation Status

Snapshot aligned with codebase on branch **`feat/vehicle-commercial-workflow`**. No fabricated test metrics.

## Public export site

| Area | Status | Notes |
|------|--------|-------|
| Home redesign | In progress on branch | Hero, search, source markets, vehicle cards |
| `/inventory` (cars) | Done | `StockCatalogPage` category `car` |
| `/machinery`, `/parts` | Done | Requires migration **022** + stock rows |
| `/source/[slug]` | Done | Source market landings |
| Blog, about, contact | Done | Static/content-driven |
| Verify invoice / quotation / agent | Done | Public API + pages |

## ERP core

| Area | Status | Notes |
|------|--------|-------|
| Auth + RBAC | Done | RLS + UI role map |
| CRM (customers, inquiries) | Done | Fullscreen forms |
| Vehicles + bulk sheet/ZIP | Done | ExcelJS/CSV + photo ZIP + batch history undo |
| Auctions + purchases | Done | Auction house select |
| Sales + quotations | Done | Print matches invoice layout |
| Invoices + auction invoices | Done | Shared `InvoicesWorkspace` |
| Payments + attachments | Done | `record-attachments` |
| Expenses + attachments | Done | |
| Shipments + documents | Done | Fullscreen forms |
| Users + passwords | Done | Admin invite/update API |
| Configuration | Done | Super admin lists + auction houses panel |
| Reports, tasks, audit, offices | Done | Baseline modules present |

## Database

| Area | Status | Notes |
|------|--------|-------|
| Migrations 001–018 | Assumed on prod | RBAC through invoice agent name |
| Migrations 019–023 | Required for latest public features | See [DATABASE.md](DATABASE.md); apply on JCT Supabase if missing |
| Migration **027** | Applied on JCT project | `bulk_import_batches` sheet/ZIP history |
| Migrations **028–031** | Required | FOB workflow, sales own-records, TOTP/expiry, customer assignment RLS |

## Remaining / follow-up

- Automated tests not started ([TESTING.md](TESTING.md)).
- Next.js 14/15 upgrade, Playwright, Sentry, WhatsApp, admin SMS MFA (deferred).
- Confirm Vercel env has service role for all admin/public API routes in production.
- Optional: unify Netlify vs Vercel to single host if Netlify is retired.

## Evidence

- Typecheck/lint scripts in `package.json`.
- Manual module smoke tests recommended after each migration batch.
