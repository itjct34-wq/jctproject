# Japan Circular Trading (JCT) — ERP & public export site

Monorepo for **Japan Circular Trading Co., Ltd.**: an internal ERP for export operations and a public marketing/inventory site for overseas buyers. Both share one **Next.js 13** app and one **Supabase** Postgres project.

| Layer | Detail |
|--------|--------|
| App | Next.js App Router (`app/`), React 18, TypeScript, Tailwind, Radix/shadcn UI |
| Database & auth | Supabase project `omlejtzwodudghqqgaiz` |
| Hosting | Vercel project **jct16** (primary); `netlify.toml` exists for alternate builds |
| Active branch | `feat/vehicle-commercial-workflow` |

## What each surface does

**Public site (no login)** — Used cars, machinery, and parts listings; destination-country guides; contact and blog; document verification for customers.

| Route | Purpose |
|--------|---------|
| `/` | Home: search, featured stock, source markets, trust content |
| `/inventory`, `/inventory/[id]` | Cars (`stock_category = car`) |
| `/machinery`, `/machinery/[id]` | Machinery stock |
| `/parts`, `/parts/[id]` | Parts / SKU stock |
| `/source/[slug]` | Source-country landing pages (e.g. Japan, UAE) |
| `/verify/[code]` | Invoice authenticity (QR / verification token) |
| `/verify-quotation/[code]` | Quotation authenticity |
| `/verify-agent` | Sales agent TOTP verification |
| `/about`, `/contact`, `/blog` | Marketing |

**ERP (login required)** — CRM, inventory, auctions, finance, shipping, admin. Unauthenticated users are redirected to `/login`. Navigation and module access are role-based (see [docs/PERMISSIONS.md](docs/PERMISSIONS.md)).

Notable ERP areas:

- **Invoices** — Proforma/commercial/purchase; print/PDF/Excel/DOCX; `NO.` document prefix; line-item and banking tables; optional QR and bank-notice page; invoice **Notes** print on the layout.
- **Auction invoices** — Same workspace as invoices, deposit-amount variant (`/auction-invoices`).
- **Quotations** — Print layout aligned with commercial invoices.
- **Vehicles** — Bulk CSV/Excel import plus optional photos ZIP (folder names match chassis, stock number, or part SKU).
- **Stock categories** — `car` \| `machinery` \| `parts` on `vehicles` (public routes filter by category).
- **Configuration** — Global lists (currencies, incoterms, etc.) for super admins; **auction houses** directory for ops (`suppliers` with `supplier_type = auction_house`, view `auction_houses`).
- **Users** — Admins create users with a chosen password (min 8 chars) via server API; optional password reset on profile edit.
- **Payments, expenses, documents** — `record-attachments` storage (20 MB cap) on payment and other records.
- **Forms** — Large create/edit flows use fullscreen `DialogContent` dialogs.

Official company copy, bank block, and print helpers live in `lib/jct-official.ts`.

## Documentation map

Source-of-truth docs live under `docs/`:

| Doc | Topic |
|-----|--------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Modules, routes, dependencies |
| [BUSINESS_RULES.md](docs/BUSINESS_RULES.md) | Entities and invariants |
| [DATABASE.md](docs/DATABASE.md) | Schema, RLS, migrations (incl. 019–023) |
| [PERMISSIONS.md](docs/PERMISSIONS.md) | Roles and UI enforcement |
| [SECURITY.md](docs/SECURITY.md) | Auth, secrets, public vs authenticated data |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Vercel, Supabase, env vars |
| [FINANCE_RULES.md](docs/FINANCE_RULES.md) | Invoices, payments, deposits |
| [SHIPPING_RULES.md](docs/SHIPPING_RULES.md) | Shipments and export documents |
| [VEHICLE_LIFECYCLE.md](docs/VEHICLE_LIFECYCLE.md) | Statuses and public visibility |
| [UI_STANDARDS.md](docs/UI_STANDARDS.md) | ERP and public UI patterns |
| [TESTING.md](docs/TESTING.md) | Quality gates (no automated suite yet) |
| [IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) | Feature completion snapshot |
| [CURRENT_STATE.md](docs/CURRENT_STATE.md) | Repo, infra, DB checkpoint |

## Run locally

1. **Node.js 18+** and npm.
2. Copy **`.env.example`** to `.env.local` and fill real values (never commit `.env.local`). Server-only routes also need `SUPABASE_SERVICE_ROLE_KEY` and `AGENT_TOTP_SECRET`.

3. Install and start:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` (public) or sign in for ERP routes under `/dashboard`, etc.

4. **Typecheck / lint**: `npm run typecheck`, `npm run lint`.

## Database migrations

Hosted project `omlejtzwodudghqqgaiz` is expected through **029**, plus **030** (TOTP secret, reservation expiry, status sync). See [docs/DATABASE.md](docs/DATABASE.md) and [docs/MIGRATIONS.md](docs/MIGRATIONS.md). Do not rename historical duplicate 009/013/014 files.

## Scripts

| Command | Action |
|---------|--------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint (Next.js config) |
