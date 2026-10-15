# Database

## Platform

- **Engine**: PostgreSQL (Supabase), project ref **`omlejtzwodudghqqgaiz`**.
- **Migrations**: SQL files in `supabase/migrations/` (timestamped filenames). Apply in filename order on fresh environments; on the live JCT project, ensure **019–033** are applied. Duplicate historical 009/013/014 names are documented in [MIGRATIONS.md](MIGRATIONS.md) — do not rewrite applied files. `supabase/config.toml` records `project_id = omlejtzwodudghqqgaiz`.
- **Types**: `lib/types/database.ts` and `lib/types/index.ts` mirror application usage (not auto-generated in repo).

## Core domains (selected tables)

| Domain | Tables / views |
|--------|----------------|
| RBAC | `profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`, `teams`, `team_members` |
| Payroll | `user_payroll` (salary amount + currency, default PKR) — migration **033** |
| CRM | `customers`, contacts, communications, requirements, `inquiries` |
| Inventory | `vehicles`, `vehicle_status_history`, `vehicle_images`, `bulk_import_batches` |
| Auctions | `auction_listings`, `auction_bids`, `suppliers` (incl. auction houses), view **`auction_houses`** |
| Sales | `sales`, `quotations`, `quotation_items` |
| Finance | `invoices`, `invoice_items`, `payments`, `expenses` |
| Shipping | `shipments`, `export_documents` (and related from migration 007) |
| Attachments | `record_attachments` + storage bucket **`record-attachments`** |
| Config | `system_config`, `company_settings` |
| Ops | `tasks`, `notifications`, `audit_logs`, `offices`, `shifts` |

## Vehicle columns (public + ERP)

| Column | Role |
|--------|------|
| `stock_category` | `car` \| `machinery` \| `parts` (default `car`) — migration **022** |
| `part_sku` | Optional SKU; ZIP folder matching — **022** |
| `source_country` | Display name for grouping |
| `source_country_code` | ISO 3166-1 alpha-2 — migration **019**; `GRANT SELECT` to `anon` in **021** |
| `status` | Lifecycle; public read limited to `in_stock`, `reserved` |
| `freight_mode` | `roro` \| `container` \| null — migration **032** |
| `commission_pkr` | Selling-agent commission in PKR — **033** |
| `commission_status` | `none` \| `due` \| `paid` — **033**; due when `payment_status = paid` **or** `shipping_status = delivered` and amount &gt; 0 |

## RLS posture (summary)

- **Authenticated** ERP users: policies combine `auth.uid()`, `is_admin_user()`, `has_role(...)`, and `has_permission(module, action)` (see migration `001_rbac_core` and later hardening).
- **Anon**: narrow `SELECT` grants on public catalog columns and `vehicle_images` for available stock only; verification uses API routes with controlled queries, not broad table access.
- **Storage**: public read on `vehicle-images`; private signed URLs for `record-attachments`.

Helper functions `has_role`, `has_permission`, `is_admin_user` are **`EXECUTE` granted to `authenticated` only** (not anon).

## Migrations 019–027 (run on JCT SQL editor if not applied)

Apply **in order** (file names under `supabase/migrations/`):

| # | File | Purpose |
|---|------|---------|
| **019** | `20261015020000_019_vehicle_source_country_code.sql` | Adds `source_country_code`, check constraint, index, backfill from `source_country` names |
| **020** | `20261015022000_020_vehicle_images_bucket.sql` | Ensures `vehicle_images` table, RLS for ops/public stock, **`vehicle-images`** bucket (public read) |
| **021** | `20261015023000_021_public_gallery_and_source_code_grant.sql` | Anon `SELECT` on gallery + `source_country_code`; public image policy for available vehicles |
| **022** | `20261015030000_022_vehicle_stock_category.sql` | `stock_category`, `part_sku`, anon grants for catalog split |
| **023** | `20261015040000_023_auction_houses_directory.sql` | View **`auction_houses`** over `suppliers` where `supplier_type = auction_house` |
| **024** | `20261015050000_024_sales_freelancer_stock_invoice_guard.sql` | Sales/freelancer cannot insert/delete vehicles |
| **025** | `20261015060000_025_vehicle_payment_shipping_rls.sql` | Payment/shipping tracks and sales-scoped RLS |
| **026** | `20261016090000_026_document_freight_notes.sql` | Optional `freight_notes` on invoices and quotations |
| **027** | `20261016100000_027_bulk_import_batches.sql` | `bulk_import_batches` history for sheet/ZIP imports; staff RLS (admin/operations/manager) |
| **028–030** | `20261016110000`–`20261016140000` | FOB/commercial workflow, sales own-records, TOTP/reservation expiry |
| **031** | `20261016150000_031_customer_assigned_to_ownership.sql` | Selling visibility keyed to `customers.assigned_to`; hand-off UPDATE; quotes/invoices/sales follow assignee |
| **032** | `20261016160000_032_vehicle_freight_mode.sql` | `vehicles.freight_mode` (`roro` \| `container`, nullable) |
| **033** | `20261016170000_033_payroll_commission.sql` | `user_payroll`; vehicle `commission_pkr` / `commission_status`; due trigger; paid restricted to admin/manager/accounts |

Earlier migrations **001–018** establish RBAC, CRM, inventory, sales/invoices, payments, security fixes, inquiries, avatars, invoice agent name, etc. New environments should run the full chain; production catch-up often needs **019–023** when enabling machinery/parts routes and photo ZIP gallery.

## Type generation

The repo maintains hand-edited TypeScript types. After schema changes, update `lib/types/database.ts` to match new columns and enums.

## Local Supabase CLI (optional)

Developers may use Supabase CLI for local stack and `supabase db push`; production JCT historically applies SQL via the **Supabase dashboard SQL editor** for migrations 019–023.
