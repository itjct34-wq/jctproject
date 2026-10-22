# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary (public site):** Overseas buyers and importers evaluating used cars, machinery, and parts for export from Japan (and related source markets), typically researching stock, FOB pricing, shipping modes (RORO / container), and company trust before contacting sales.

**Primary (ERP):** Japan Circular Trading staff operating export workflows day to day — sales agents and freelancers (customers, quotations, stock reservation), operations/managers (yard, auctions, shipments, documents), accounts (payments, expenses, invoice finance), admins/super admins (users, roles, configuration), and auditors (read-only oversight).

*(Inferred from README, public home copy, and `docs/PERMISSIONS.md`; not separately confirmed in an interview round.)*

## Product Purpose

Japan Circular Trading (JCT) runs a single Next.js product with two surfaces that share one Supabase backend:

1. A **public export / marketing site** so overseas buyers can browse real inventory (cars, machinery, parts), source-market pages, and verify invoice/quotation/agent authenticity.
2. An internal **ERP** so the company can run CRM, inventory, auctions, sales documents, finance, shipping, payroll/commission, and admin — with role-based access.

Success means staff can complete commercial export operations (quote → reserve → invoice → payment → ship) with correct documents and permissions, while buyers can find genuine stock and verify official documents without fabricating claims.

*(Purpose and dual-surface model confirmed by `README.md` and `docs/CURRENT_STATE.md`.)*

## Positioning

Not a generic inventory brochure: JCT couples a **live export catalog** (category-filtered stock, source markets, verification QR/token flows) with an **operations ERP** for auction sourcing, commercial documents (proforma/commercial/purchase, auction invoices, quotations), bank letterhead, and shipment workflows — all against one org database and permission model.

*(Mechanism inferred from README route map and finance/shipping docs; “meaningfully different” claim left modest — open if marketing wants a sharper competitor contrast.)*

## Operating Context

- **Company:** Japan Circular Trading Co., Ltd.; Nagoya, Aichi, Japan; export/import of used cars, trucks, and related goods (`lib/jct-official.ts`, public home footer).
- **Public workflows:** Home search and featured/just-listed stock; catalog detail; contact/WhatsApp; document verify (`/verify/*`, `/verify-agent`); blog/about.
- **ERP workflows:** Auth at `/login`; AppShell sidebar modules; fullscreen create/edit dialogs; print/PDF/Excel/DOCX for trade documents; bulk vehicle import (sheet + photos ZIP); auction houses as suppliers; attachments on payments/expenses (`record-attachments`, 20 MB).
- **Infra ritual:** Local `npm run dev`; production on Vercel project **jct16**; Supabase project **`omlejtzwodudghqqgaiz`**; Capacitor Android shell loads the live ERP web URL at `/login` (wrapper only — design language remains web).
- **Docs of record:** `docs/*.md` (architecture, business rules, database, permissions, finance, shipping, vehicle lifecycle, UI standards).

## Capabilities and Constraints

**Confirmed capabilities**

- Public: cars / machinery / parts catalogs; source-country landings; invoice, quotation, and sales-agent TOTP verification.
- ERP: CRM, vehicles (+ bulk import/undo batches), auctions/purchases, sales/quotations, invoices & auction invoices, payments & expenses (+ attachments), shipments & documents, users/payroll, vehicle commission (PKR), configuration (lists + auction houses), reports/tasks/audit/offices baseline, permissions UI with role defaults and per-user grant/deny.
- Stock categories: `car` | `machinery` | `parts`; freight modes RORO/container; FOB / payment / shipping commercial workflow columns (migrations through **033+** expected on prod).
- Official trade document print uses conservative A4 letterhead; company name/logo/hanko prefer `company_settings`, with public fallbacks under `/images/`.

**Confirmed constraints**

- Auth required for ERP; unauthenticated users redirect to `/login`.
- Data access enforced by Supabase RLS; UI gated by `use-permissions` / `get_my_permissions()`.
- ERP chrome uses neutral **ERP** wordmark only — no company logos in shell/login (`docs/UI_STANDARDS.md`).
- Print layouts (`OfficialTradeDocument` / invoice print roots) must not be casually restyled.
- Automated test suite not started; Next 14/15, Playwright, Sentry, WhatsApp alerts, admin SMS MFA deferred.
- Do not invent testimonials, pricing tables, licensing claims, or customer names beyond what content/DB provide.

**Open / undecided**

- Whether marketing positioning should name specific competitor categories beyond “export trading ERP + public catalog.”
- Any product-specific accessibility standard beyond the patterns already in UI standards (omit hard WCAG claim until confirmed).
- Long-term host: Vercel primary; Netlify config optional/possible retirement.

## Brand Commitments

- **Legal / trading name:** Japan Circular Trading Co., Ltd. (README); public site domain `www.japancirculartrading.com`; short product/repo label **JCT**.
- **Public logo:** `/brand/jct-logo.webp` via `BrandLogo` (mark-only default in public chrome).
- **Letterhead / seal fallbacks:** `/images/company-logo.png`, `/images/company-hanko.png` (and related JCT image assets under `public/images/`); prefer DB `company_settings` when set. Code intentionally avoids hard-coding a brand wordmark string in letterhead helpers (`legalName`/`shortName` empty in `JCT_OFFICIAL`).
- **Official contact & registration facts** in `JCT_OFFICIAL` (Nagoya address, phones, email, corporate number, Aichi license, Rakuten Bank wire block) — preserve as product/legal truth for documents; do not invent alternate bank or license data.
- **Tagline (official block):** `EXPORT / IMPORT TRADE / USED CARS / TRUCKS`.
- **Voice (observed, not a design brief):** factual export-trade English — yard/auction sourcing, inspection support, RORO and container shipping, FOB pricing, document authenticity.
- **ERP vs public identity split is binding:** public navy/vermilion marketing shell vs ERP “Liquid Glass” charcoal/brand-red operate chrome; do not collapse them without an explicit rebrand request.

*(Visual recipes belong in DESIGN.md later — not expanded here.)*

## Evidence on Hand

- Repo docs: `README.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_STATUS.md`, `docs/PERMISSIONS.md`, `docs/UI_STANDARDS.md`, finance/shipping/vehicle lifecycle docs.
- Brand assets: `public/brand/jct-logo.webp`, `public/images/*` logos/hanko/hero export-lot photos, maker brand marks under `public/brands/`, destination flags under `public/flags/`.
- Official company constants: `lib/jct-official.ts`.
- Live inventory and commercial records live in Supabase (not checked into git); public pages read catalog via app data layers.
- **Do not fabricate:** customer testimonials, press, win rates, invented stock, or unverified destination claims.

## Product Principles

1. **One truth, two doors** — Public catalog and ERP operate on the same stock and commercial records; never imply a separate “demo” inventory.
2. **Documents are the product** — Invoices, quotations, and verification must stay authentic, printable, and legally conservative.
3. **Role-shaped work** — Navigation and actions reflect real job roles; deny overrides and RLS beat convenience.
4. **Buyer trust without theater** — Show real units, shipping modes, and verify-able documents; do not invent social proof.
5. **Respect surface modes** — Marketing expression belongs on the public site; ERP prioritizes operable density and permission clarity.

## Accessibility & Inclusion

Product-specific mandated standard not confirmed in interview. Existing engineering expectations to preserve: visible form labels, skip link to main content, dialog `aria-modal`, ~44×44px fullscreen close / coarse-pointer targets, and `prefers-reduced-motion` on ERP chrome (`docs/UI_STANDARDS.md`).
