# Permissions

## Model

Two layers operate together:

1. **Database (canonical for data access)** — RLS policies on Postgres tables use `auth.uid()`, `is_admin_user()`, `has_role(text)`, and `has_permission(module, action)` seeded in migration `001_rbac_core.sql`.
2. **UI (navigation and buttons)** — `hooks/use-permissions.ts` maps **roles** to module **view / write / delete / approve / export** without calling `has_permission` on every click. Super admin bypasses all UI checks.

Permissions in the database are stored as **`module.action`** pairs (e.g. `invoices.create`, `payments.confirm`).

## Roles (seeded)

| Role | Intent |
|------|--------|
| `super_admin` | Full config, roles, global configuration |
| `admin` | Broad ERP management |
| `operations` | Yard, auctions, shipments, documents |
| `manager` | Approvals, team oversight, invoices |
| `sales_agent` | Customers, quotations, assigned sales |
| `freelancer` | Limited customer/task access |
| `accounts` | Payments, expenses, invoice finance actions |
| `auditor` | Read-only across authorized modules |

Users hold roles via **`user_roles`** (active flag). Self-assignment of roles is blocked by trigger.

## UI module map

`PermissionModule` in `lib/types` drives sidebar visibility via `lib/nav.tsx` and `canView(module)`.

| Module | Typical viewers | Typical writers |
|--------|-----------------|-----------------|
| `dashboard` | Most roles | — |
| `customers` | Sales, ops, accounts, auditor | admin, operations, manager, sales_agent |
| `vehicles` | Inventory readers (incl. sales_agent, freelancer read-only) | admin, operations, manager |
| `auctions` | ops, manager, auditor | admin, operations, manager |
| `invoices` | sales, accounts, auditor | admin, manager, sales_agent, freelancer, accounts |
| `payments` | finance, sales (read), freelancer (read), auditor | admin, manager, accounts |
| `settings` | admin, auditor | admin only (UI); super_admin for global config page |

**Auction houses** configuration: super admin or anyone with `auctions.create` (`/configuration`, `AuctionHousesPanel`).

## Admin-only server actions

| Endpoint | Requirement |
|----------|-------------|
| `POST /api/admin/invite-user` | Admin auth + service role; sets initial password |
| `POST /api/admin/update-user` | Admin auth; optional password update |

These are not gated by RLS alone; they use **`requireAdmin`** (`lib/admin-auth.ts`).

## Sales agent navigation

Users with **`sales_agent`** and no elevated staff role (`admin`, `operations`, `manager`, `accounts`, `super_admin`) get a **sales-focused sidebar** via `getNavGroupsForRoles()` in `lib/nav.tsx`. Administration, Operations, Export & Shipping, and auction purchase links are hidden. Direct URLs to admin pages may still exist; RLS remains the data gate.

## Sales agent & freelancer data rules

| Action | sales_agent | freelancer |
|--------|-------------|------------|
| View stock / invoices | Yes | Yes (invoices after migration `024`) |
| Reserve **available** stock for own customers | Yes (RLS `025`) | Yes (RLS `025`) |
| Record T/T / payments | **No** (UI + RLS) | **No** |
| View T/T for own customers | Yes (RLS `025` via `sales_agent_id` / customer owner) | Yes |
| Download vehicle courier docs | Yes (view-only upload) | Yes |
| Create invoices / quotations | Yes | Yes (quotations; invoices create via RLS `024`) |
| Edit invoices (UI + RLS) | Yes (UI); RLS update still manager/accounts/admin | Create only; no invoice update in RLS |
| Delete invoices or vehicles | No (UI + RLS: admin only) | No |
| Add / import vehicles | No (UI + RLS: operations/manager/admin) | No |
| Edit stock specs / pricing | No | No |
| Edit shipping on vehicles | No | No |

Migration **`024_sales_freelancer_stock_invoice_guard.sql`** reaffirms vehicle insert/delete and invoice delete policies and extends invoice read/create for selling roles.

Migration **`025_vehicle_payment_shipping_rls.sql`** adds payment/shipping tracks, payment allocation, sales-scoped payment SELECT, vehicle reservation UPDATE for selling roles, and **`record_attachments`** entity type **`vehicles`**.

## Customer ownership

New customers created in CRM set **`customers.assigned_to`** and **`created_by`** to the creating user (`customers` page). Payments inherit **`payments.sales_agent_id`** from `COALESCE(customers.assigned_to, customers.created_by)` when a customer is tagged on the T/T.

## Staff (admin / operations / manager / accounts)

| Action | admin | operations | manager | accounts |
|--------|-------|------------|---------|----------|
| Record & edit T/T | Yes | No | Yes | Yes |
| Allocate payment to reserved vehicle | Yes | No | Yes | Yes |
| Edit stock | Yes | Yes | Yes | No |
| Edit vehicle shipping + upload courier docs | Yes | Yes | Yes | No |

## Enforcement rule

UI hiding a button does **not** grant safety if RLS allows the operation. When adding features, update **both** RLS policies and `use-permissions` maps if the action is role-sensitive.
