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
| `vehicles` | Inventory readers | admin, operations, manager |
| `auctions` | ops, manager, auditor | admin, operations, manager |
| `invoices` | sales, accounts, auditor | admin, manager, sales_agent, accounts |
| `payments` | finance, auditor | admin, manager, accounts |
| `settings` | admin, auditor | admin only (UI); super_admin for global config page |

**Auction houses** configuration: super admin or anyone with `auctions.create` (`/configuration`, `AuctionHousesPanel`).

## Admin-only server actions

| Endpoint | Requirement |
|----------|-------------|
| `POST /api/admin/invite-user` | Admin auth + service role; sets initial password |
| `POST /api/admin/update-user` | Admin auth; optional password update |

These are not gated by RLS alone; they use **`requireAdmin`** (`lib/admin-auth.ts`).

## Enforcement rule

UI hiding a button does **not** grant safety if RLS allows the operation. When adding features, update **both** RLS policies and `use-permissions` maps if the action is role-sensitive.
