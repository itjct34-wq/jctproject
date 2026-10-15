# UI Standards

## Visual tone

- **ERP**: Navy primary (`#0F2744` / `--primary`), warm gold accent (`--gold`), tinted page background (not dead white), rounded cards with soft navy shadow. Sidebar active item is solid navy; page titles use a gold underline. Tokens live in `app/globals.css`; `gold` is a Tailwind color.
- **Public site**: JCT brand tokens (`--jct-navy`, `--jct-vermilion`, etc.) on home and catalog; `HomeShell` / `PublicShell` wrappers.
- **Print**: Do not restyle `invoice-print-root` / `OfficialTradeDocument` — A4 conservative navy/red tables stay as-is.
- Official logo from **`JCT_OFFICIAL.logo`** on ERP loading state and print documents.

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
- Search and filter bars at top of module pages.
- Badge styling for status enums (consistent pastel border/text classes per module).
- Vehicle stock list tints the **entire row** (not only badges): available emerald, unpaid reserved amber, partial paid orange, paid blue, booked sky, shipped cyan, delivered slate (`vehicleListRowClass`). Text stays dark on those tints. Commission **due** adds a fuchsia corner and Due badge; **Commission paid** is a green label.

## Print

- Print dialogs add **`print:hidden`** on chrome; content uses **`OfficialTradeDocument`** with fixed typography (~8–12px) for A4.
- Invoice print toggles: QR, bank notice page; **`printDocumentPdf`** triggers browser print-to-PDF.
- Notes on invoice: small footer text, **`line-clamp-2`** on screen/print CSS.

## Permissions UX

- Sidebar items filtered by **`canView(module)`** and optional **`requiredRoles`**.
- Configuration page shows partial UI for auction-house managers vs full grid for super admin.

## Accessibility

- Dialog `aria-modal` on mobile nav; loading states use `role="status"`.
- Form labels via Radix **Label**; prefer visible labels over placeholder-only fields on ERP forms.

## State handling

- List pages: local `useState` + Supabase reload callbacks; no global Redux.
- Auth loading gate in **AppShell** before rendering ERP children.
