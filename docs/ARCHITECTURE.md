# Architecture

## System overview

JCT is a single **Next.js 13** application (`app/` App Router) deployed to **Vercel (`jct16`)**, backed by **Supabase** (Postgres, Auth, Storage, RLS) project **`omlejtzwodudghqqgaiz`**.

Two experiences share one codebase:

1. **Public export site** — Server and client components under `app/page.tsx`, `app/inventory`, `app/machinery`, `app/parts`, `app/source`, marketing pages, and verification routes. Data is read via anon-safe Supabase queries (`lib/public/*`, `lib/supabase/public.ts`) and public API routes under `app/api/public/*`.
2. **ERP** — Routes under `app/(app)/*` wrapped by `AppShell` (`components/layout/app-shell.tsx`). Requires Supabase session; client uses `lib/supabase/client.ts` and `AuthProvider` (`lib/auth-provider.tsx`).

There is no separate BFF service: privileged operations use **Next.js Route Handlers** with the service role (`lib/supabase/server.ts`, `lib/admin-auth.ts`).

## Dependency direction

```
app/(pages) → components → hooks / lib (types, utils, public, jct-official)
                ↓
         Supabase client (browser) or server admin client (API routes)
                ↓
         Postgres + Storage (RLS)
```

- **UI must not** embed service-role keys.
- **Business constants** for print (company, bank) are centralized in `lib/jct-official.ts`.
- **Navigation and module gates** are client-side in `lib/nav.tsx` + `hooks/use-permissions.ts`; **RLS** is the database enforcement layer.

## Route groups

| Area | Path prefix | Layout / guard |
|------|-------------|----------------|
| Public | `/`, `/inventory`, `/machinery`, `/parts`, `/source`, `/verify*`, `/blog`, `/login` | `PublicShell` / `HomeShell` where used; no auth |
| ERP | `/dashboard`, `/vehicles`, `/invoices`, … | `(app)/layout.tsx` → `AppShell` redirects to `/login` if no session |
| API | `/api/public/*`, `/api/admin/*`, `/api/vehicles/photo-zip` | Route handlers; admin routes require admin session + service role |

`middleware.ts` currently passes all requests through (no edge auth); ERP protection is implemented in `AppShell`.

## Major modules (ERP)

| Module | Primary routes | Key libraries / components |
|--------|----------------|----------------------------|
| CRM | `/customers`, `/inquiries` | Customer forms (fullscreen dialogs) |
| Sales | `/sales`, `/quotations` | Quotations print via `OfficialTradeDocument` |
| Inventory | `/vehicles` | Bulk import: `lib/vehicles/import-spreadsheet.ts`, `components/vehicles/vehicles-bulk-import-button.tsx`, ZIP: `lib/utils/vehicle-photo-zip.ts` |
| Auctions | `/auctions`, `/purchases` | `lib/auction-houses.ts`, `AuctionHouseSelect` |
| Finance | `/invoices`, `/auction-invoices`, `/payments`, `/remittance-insights`, `/expenses` | `components/invoices/invoices-workspace.tsx`, `components/payments/remittance-insights.tsx`, `components/shared/record-attachments.tsx` |
| Shipping | `/shipments`, `/documents` | Shipment fullscreen forms |
| Admin | `/users`, `/configuration`, `/settings`, `/audit` | Invite user API, `AuctionHousesPanel`, `system_config` |

## Public catalog

- All public stock rows live in **`public.vehicles`**, discriminated by **`stock_category`** (`car` \| `machinery` \| `parts`).
- Only vehicles with status **`in_stock`** or **`reserved`** are exposed to anon readers (RLS + query filters in `lib/public/vehicles.ts`).
- Images: **`vehicle_images`** table + **`vehicle-images`** storage bucket (migrations 020–021).
- Source markets: **`source_country`** (display) and **`source_country_code`** (ISO alpha-2 for flags/filters, migration 019).

## Print and export documents

- Shared layout: `components/documents/official-trade-document.tsx` (invoice and quotation).
- Invoice wrapper: `components/invoices/commercial-invoice-template.tsx`.
- PDF: `lib/utils/print-document-pdf.ts`; Excel/DOCX: `lib/utils/commercial-invoice-excel.ts`, `commercial-invoice-docx.ts`.
- Document numbers use **`formatDocumentNo`** — print-only **`NO.`** prefix without rewriting stored codes.

## Branch and evolution

Active development branch: **`feat/home-page-redesign`** (public home and catalog UX). ERP modules remain in the same app; no micro-frontend split.
