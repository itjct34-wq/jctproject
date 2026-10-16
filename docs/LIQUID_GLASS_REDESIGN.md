# Liquid Glass ERP Redesign

Status: **implemented in working tree — not committed** (verify with `git status`).

## Architecture notes

- Stack: Next.js App Router, Tailwind + CSS variables, Radix UI primitives, Supabase-backed modules.
- ERP chrome is gated by `AppShell` (`components/layout/app-shell.tsx`) with collapsible sidebar + top bar; modules under `app/(app)/*` inherit `.erp-shell` styles.
- Public marketing (`.public-site` / `.jct-home`) and print (`invoice-print-root` / `OfficialTradeDocument`) were intentionally left alone so trade documents and the public catalog keep their existing brand treatment.
- Business rules, RLS, APIs, routing, and live data wiring were not changed.

## Design tokens summary

Defined in `app/globals.css` (`:root` + `.dark`):

| Token | Role |
| --- | --- |
| `--background` / `--foreground` | Page canvas + body text |
| `--primary` | Charcoal (light) / brand red (dark CTAs) |
| `--brand` | Accent for active nav, primary buttons, badges |
| `--gold` | Legacy alias of `--brand` |
| `--success` / `--warning` / `--info` / `--destructive` | Status semantics |
| `--glass-bg`, `--glass-blur`, `--glass-shadow*` | Frosted panels |
| `--shell-glow` | Soft dual-spot atmospheric background |
| `--radius` | ~16px base corner radius |

Tailwind: `brand`, `gold` (alias), `shadow-glass`, `shadow-glass-sm`, `animate-glass-in`. Utilities: `.glass-panel`, `.glass-panel-strong`.

## Modules redesigned vs deferred

### Redesigned (design system + shell inheritance)

Shared shell and primitives apply across all ERP routes:

- Shell: sidebar, top bar, app shell loading, page header, login
- Primitives: card, button, badge, input, textarea, select, table, dialog, sheet, empty state, KPI card, status badge
- ERP chrome classes: filter panels, data tables, stat cards
- Explicit polish: Dashboard (ops + sales), commissions accent, remittance currency symbol, bulk upload accents
- Neutral ERP identity: ERP wordmark; placeholders/agent codes/inquiry mailto no longer use company initials in UI chrome

### Deferred / intentionally unchanged

- Public marketing homepage/catalog brand tokens and copy
- Print/official trade documents (`JCT_OFFICIAL`, hanko, A4 tables)
- Company settings invoice-prefix DB default (data/config, not shell chrome)
- Per-row vehicle lifecycle color coding (ops semantics kept for daily clarity)
- Deep per-page layout rewrites for every list (they inherit glass cards/tables/filters)

## Test results

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | **Pass** (exit 0) |
| `npm run lint` | **Pass** (exit 0; pre-existing warnings only — expenses `useMemo` deps, a few `<img>` hints). No new errors from this redesign. |
| `npm run build` | Not run (time); typecheck + lint green. |
| Commit / push / deploy | **None** — changes left uncommitted on `main`. |

## Remaining issues

- Some module pages still use dense legacy spacing; further visual polish can continue page-by-page without token changes.
- Heavy backdrop-blur on very low-end devices may need a reduced-motion / reduced-transparency preference (prefers-reduced-motion already short-circuits animations).
- Dark mode default remains system/light via `ThemeProvider`; operators can toggle.

## Changed files (primary)

- `app/globals.css`, `tailwind.config.ts`, `app/layout.tsx` (unchanged fonts; tokens drive theme)
- `app/login/page.tsx`, `app/(app)/dashboard/page.tsx`
- `components/layout/*`, `components/ui/{card,button,badge,input,textarea,select,table,dialog,sheet}.tsx`
- `components/dashboard/*`, `components/shared/erp-empty-state.tsx`
- Touch-ups: invoices workspace placeholder, agents code, inquiries mailto, stock bulk upload, commissions, remittance dashboard
- Docs: `docs/UI_STANDARDS.md`, `docs/LIQUID_GLASS_REDESIGN.md`
