# Database

## Platform

- **Engine**: PostgreSQL (Supabase), project ref **`omlejtzwodudghqqgaiz`**.
- **Migrations**: SQL files in `supabase/migrations/` (timestamped filenames). Apply in filename order on fresh environments; on the live JCT project, ensure at least **019–023** are applied if public gallery, categories, or auction house view are missing.
- **Types**: `lib/types/database.ts` and `lib/types/index.ts` mirror application usage (not auto-generated in repo).

## Core domains (selected tables)

| Domain | Tables / views |
|--------|----------------|
| RBAC | `profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`, `teams`, `team_members` |
| CRM | `customers`, contacts, communications, requirements, `inquiries` |
| Inventory | `vehicles`, `vehicle_status_history`, `vehicle_images` |
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

## RLS posture (summary)

- **Authenticated** ERP users: policies combine `auth.uid()`, `is_admin_user()`, `has_role(...)`, and `has_permission(module, action)` (see migration `001_rbac_core` and later hardening).
- **Anon**: narrow `SELECT` grants on public catalog columns and `vehicle_images` for available stock only; verification uses API routes with controlled queries, not broad table access.
- **Storage**: public read on `vehicle-images`; private signed URLs for `record-attachments`.

Helper functions `has_role`, `has_permission`, `is_admin_user` are **`EXECUTE` granted to `authenticated` only** (not anon).

## Migrations 019–023 (run on JCT SQL editor if not applied)

Apply **in order** (file names under `supabase/migrations/`):

| # | File | Purpose |
|---|------|---------|
| **019** | `20261015020000_019_vehicle_source_country_code.sql` | Adds `source_country_code`, check constraint, index, backfill from `source_country` names |
| **020** | `20261015022000_020_vehicle_images_bucket.sql` | Ensures `vehicle_images` table, RLS for ops/public stock, **`vehicle-images`** bucket (public read) |
| **021** | `20261015023000_021_public_gallery_and_source_code_grant.sql` | Anon `SELECT` on gallery + `source_country_code`; public image policy for available vehicles |
| **022** | `20261015030000_022_vehicle_stock_category.sql` | `stock_category`, `part_sku`, anon grants for catalog split |
| **023** | `20261015040000_023_auction_houses_directory.sql` | View **`auction_houses`** over `suppliers` where `supplier_type = auction_house` |

Earlier migrations **001–018** establish RBAC, CRM, inventory, sales/invoices, payments, security fixes, inquiries, avatars, invoice agent name, etc. New environments should run the full chain; production catch-up often needs **019–023** when enabling machinery/parts routes and photo ZIP gallery.

## Type generation

The repo maintains hand-edited TypeScript types. After schema changes, update `lib/types/database.ts` to match new columns and enums.

## Local Supabase CLI (optional)

Developers may use Supabase CLI for local stack and `supabase db push`; production JCT historically applies SQL via the **Supabase dashboard SQL editor** for migrations 019–023.
