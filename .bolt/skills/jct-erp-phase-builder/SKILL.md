---
name: jct-erp-phase-builder
description: Build and extend the Japan Circular Trading ERP one complete business phase at a time. Use whenever the user asks to continue, resume, finish remaining phases, or add an ERP module. Choose the next dependency-aware phase, implement its database, security, types, UI, and verification together, and never leave a placeholder screen or disconnected workflow.
---

# JCT ERP Phase Builder

This project is a Supabase-backed Next.js ERP for Japan Circular Trading, a used-vehicle importing and exporting company. Work in small, complete phases. A phase is finished only when a user can open the module, create or update real records, see useful empty/loading/error states, and the production build passes.

## Current project baseline

Already complete:

- RBAC foundation with email/password sign-in, profiles, roles, permissions, teams, notifications, tasks, audit logs, and company settings.
- Company branding using the JCT logo, phone number, and email address.
- Customer CRM with customers, contacts, vehicle requirements, and communication history.
- Vehicle Inventory with chassis tracking, pricing, stock ageing, duplicate chassis protection, status changes, and status history.

The database migrations are already applied. Existing business modules that still need implementation are Suppliers, Auctions, Purchases, Sales, Quotations, Invoices, Payments, Expenses, Shipments, Documents, and Reports.

## Phase order

Use this dependency order unless the user explicitly chooses another module:

1. Suppliers
2. Auctions and auction lots
3. Purchases
4. Sales and quotations
5. Invoices
6. Payments and expenses
7. Shipments and export documents
8. Reports and cross-module dashboards
9. Final hardening, permissions, audit coverage, and data export

Customers and vehicles are the foundations for most later records. Do not implement invoices, payments, or shipments as isolated screens; connect them to the existing customer and vehicle IDs.

## Required workflow

1. Inspect the placeholder page, navigation, existing types, nearby working pages, and current database posture before editing.
2. Pick one cohesive phase. Do not scatter partial work across several modules.
3. Design the database first. Use `apply_migration` for every new table, index, function, constraint, or RLS policy. Never rely on a local SQL file alone.
4. Include a detailed migration summary, safe re-run behavior, foreign keys, useful indexes, and RLS on every new table.
5. Add four separate policies per table for select, insert, update, and delete. Scope policies to authenticated users and use `auth.uid()` plus existing RBAC helpers. Never use `FOR ALL` or a permissive public policy for ERP data.
6. Add TypeScript interfaces before building the screen.
7. Replace the placeholder with a complete workflow: list, search/filter, create or edit, detail view, status changes where relevant, and visible empty/loading/error states.
8. Use Supabase for durable records. Check every database response and show a visible error instead of binding undefined data into the UI.
9. Keep actions aligned with roles. Auditors can read; operational users can manage operational records; financial and administrative actions must remain restricted.
10. Run type checking and the production build. If a build fails, fix the cause before reporting completion. Filesystem `EAGAIN` errors can be retried sequentially, but code errors must be fixed.

## Design expectations

Keep the established neutral, professional ERP style: readable contrast, restrained blue/green accents, 8px spacing, responsive layouts, compact tables, clear status badges, and detail drawers for secondary information. Use Lucide icons already installed. Avoid purple or violet styling and avoid adding dependencies unless necessary.

Prefer one polished workflow over many shallow screens. For example, a good Supplier phase includes supplier creation, contacts, payment terms, country, status, notes, purchase history placeholder links, and search/filter—not only a table with no create action.

## Data and security rules

- Use `maybeSingle()` when zero or one row is expected.
- Default owner fields to `auth.uid()` when appropriate.
- Use `raw_app_meta_data` or database roles for authorization; never use user-editable metadata.
- Keep privileged mutations server-enforced. Do not expose service-role keys in browser code.
- Preserve user data. Never drop tables, columns, or records to make a migration pass.
- Add status history for operational state machines such as vehicles, purchases, sales, invoices, and shipments.
- Treat duplicate identifiers as database constraints, not only client-side checks.

## Completion checklist

Before saying a phase is complete, confirm:

- The database migration was applied successfully.
- Every new table has RLS and separate CRUD policies.
- The screen is no longer a construction placeholder.
- The main create/read/update path is connected to Supabase.
- Search, filters, empty state, loading state, and error state exist.
- Types compile and the production build succeeds.
- The closing response states what is complete and names the next recommended phase.

## Remaining work estimate

After Customer CRM and Vehicle Inventory, approximately 11 business phases remain: Suppliers, Auctions, Purchases, Sales, Quotations, Invoices, Payments, Expenses, Shipments, Documents, and Reports. A final hardening pass remains after those modules for cross-module workflows, permissions, audit completeness, exports, and regression checks. Treat each numbered module as one focused delivery rather than attempting all remaining work in one change.
