# UI Standards

## Visual tone

- **ERP (Liquid Glass)**: Neutral charcoal primary (`--primary`), refined brand red (`--brand`), soft atmospheric shell gradient (`--shell-glow`), glass panels (`glass-panel` / `shadow-glass`). Sidebar active item uses brand tint + left bar; page titles use a short brand underline. Tokens live in `app/globals.css`. Legacy `--gold` aliases `--brand` for older `gold` utilities.
- **Public site**: Marketing brand tokens (`--jct-navy`, `--jct-vermilion`, etc.) on home and catalog; `HomeShell` / `PublicShell` wrappers (unchanged by ERP redesign).
- **Print**: Do not restyle `invoice-print-root` / `OfficialTradeDocument` — A4 conservative navy/red tables stay as-is.
- ERP chrome uses neutral **ERP** wordmark only (no company logos in shell/login).

## Layout

- ERP: collapsible **sidebar** (`components/layout/sidebar.tsx`), **top bar**, skip link to `#main-content`.
- Mobile: drawer navigation with overlay; closes on route change and Escape.
- Public: responsive catalog grids; vehicle cards on home — **do not revert unrelated vehicle-card styling** when changing other pages.

## Forms and dialogs

- Large ERP create/edit flows use **`<DialogContent fullscreen>`** (vehicles, customers, invoices workspace form, shipments, quotations, suppliers, tasks, bulk import).
- Destructive actions use **`ConfirmDialog`** where implemented.
- Feedback: **sonner** toasts for save/load errors.

## Tables and lists

- Master-detail pattern: list in **Card** + **Sheet** or side panel for selected row (invoices, payments, documents).
- Search and filter bars use **`.erp-filter-panel`** / **`.erp-filter-bar`** (shared chrome in `globals.css`).
- Stat tiles use **`.erp-stat-card`** / **`.erp-stat-label`** / **`.erp-stat-value`** (gold left accent).
- Empty / zero-results lists use **`ErpEmptyState`** (`components/shared/erp-empty-state.tsx`).
- Badge styling for status enums (consistent pastel border/text classes per module).
- Vehicle stock list uses a soft row tint plus a **thick left accent** (`vehicleListRowClass`) and a text **payment status pill** (not color alone). Commission **due** adds a fuchsia inset ring; **Commission paid** is a green label.

## Print

- Print dialogs add **`print:hidden`** on chrome; content uses **`OfficialTradeDocument`** with fixed typography (~8–12px) for A4.
- Invoice print toggles: QR, bank notice page; **`printDocumentPdf`** triggers browser print-to-PDF.
- Notes on invoice: small footer text, **`line-clamp-2`** on screen/print CSS.

## Permissions UX

- Sidebar items filtered by **`canView(module)`** and optional **`requiredRoles`**.
- Configuration page shows partial UI for auction-house managers vs full grid for super admin.

## Accessibility

- Dialog `aria-modal` on mobile nav; loading states use `role="status"`.
- Form labels via Radix **Label** (`requiredMark` for required *); prefer visible labels over placeholder-only fields on ERP forms.
- Fullscreen dialog close control is at least ~44×44px; coarse-pointer ERP controls bump toward 44px via `globals.css`.
- Prefer `prefers-reduced-motion` (ERP + workforms respect it).

## State handling

- List pages: local `useState` + Supabase reload callbacks; no global Redux.
- Auth loading gate in **AppShell** before rendering ERP children.
