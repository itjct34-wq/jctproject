# Permissions

## Model

Three layers operate together:

1. **Database (canonical for data access)** — RLS policies use `auth.uid()`, `is_admin_user()`, `has_role(text)`, and `has_permission(module, action)`.
2. **Role defaults** — `role_permissions` maps each role to `permissions` rows (`module` + `action`).
3. **User overrides** — `user_permissions` (migration **042**) stores per-user `grant` or `deny`. **Deny wins**, then grant, then role defaults. Managed only by admin/super_admin (RLS).

UI navigation and buttons use `hooks/use-permissions.ts`, which prefers the effective set from RPC **`get_my_permissions()`** (loaded in `AuthProvider`). If the RPC is unavailable, the hook falls back to role maps. Super admin bypasses all UI checks.

Permissions are stored as **`module.action`** pairs (e.g. `invoices.create`, `payments.allocate`).

## Admin UI

| Path | Who | Purpose |
|------|-----|---------|
| `/permissions` | Admin / Super Admin | Assign roles, grant/deny user overrides, edit role defaults |
| `/users` | Admin | Invite users, teams, payroll, office/shift |

Plain-language guide: [user-manual-permissions.md](./user-manual-permissions.md).

## Roles (seeded)

| Role | Intent |
|------|--------|
| `super_admin` | Full config, roles, global configuration |
| `admin` | Broad ERP management |
| `operations` | Yard, auctions, shipments, documents, stock ops |
| `manager` | Approvals, remittances, stock ops, expenses |
| `sales_agent` | Customers, quotations, reserve stock |
| `freelancer` | Limited customer/task access + reserve |
| `accounts` | Payments, expenses, invoice finance actions |
| `auditor` | Read-only across authorized modules |

Users hold roles via **`user_roles`** (active flag). Self-assignment of roles is blocked by trigger.

## Fine-grained keys (042+)

| Key | Typical holders |
|-----|-----------------|
| `payments.create` / `edit` / `allocate` | admin, manager, accounts (Remittance Actions; sales keep `payments.view` only — migration **043**) |
| `vehicles.import` | admin, operations, manager |
| `vehicles.reserve` | admin, operations, manager, sales_agent, freelancer |
| `vehicles.assign` | admin, operations, manager |
| `vehicles.set_bid_requester` | admin, operations, manager |
| `vehicles.edit_courier` / `edit_shipping` | admin, operations, manager |
| `expenses.view` | admin, manager, accounts, operations, auditor |

Sales roles do **not** get remittance mutate, bid requester, courier/shipping edit, bulk upload, or expenses by default. Use a user **Grant** for exceptions.

## UI module map

`PermissionModule` in `lib/types` drives sidebar visibility via `lib/nav.tsx` and `canView(module)` / `can(module, action)`.

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

## Sales agent & freelancer navigation

Users with **`sales_agent`** or **`freelancer`** and **no** elevated staff role (`admin`, `operations`, `manager`, `accounts`, `super_admin`) get a **sales-focused sidebar** via `getNavGroupsForRoles()` in `lib/nav.tsx` (`usesSalesFocusedNav()`). Administration, Operations, and auction **purchase** links are hidden. **Bulk upload** and **Accounts & Expenses** also require `vehicles.import` / `expenses.view`. Direct URLs may still exist; RLS remains the data gate.

Elevated staff who also hold `sales_agent` keep the full sidebar and ops dashboard.

## Sales agent & freelancer data rules

| Action | sales_agent | freelancer |
|--------|-------------|------------|
| View stock / invoices | Yes | Yes (invoices after migration `024`) |
| Reserve **available** stock for own customers | Yes (`vehicles.reserve` + RLS `025`) | Yes |
| Record T/T / payments / Actions | **No** (UI + RLS **043**) | **No** |
| View T/T for own customers + open TT | Yes (`payments.view`, RLS `025`) | Yes |
| Set bid requester / edit courier / shipping | **No** | **No** |
| Bulk upload | **No** | **No** |
| Accounts & Expenses | **No** | **No** |
| Create invoices / quotations | Yes | Yes (quotations; invoices create via RLS `024`) |
| Delete vehicles / reservations / invoices | No | No |

## Customer ownership

New customers created in CRM set **`customers.assigned_to`** and **`created_by`** to the creating user. Elevated staff can reassign any customer; a selling role can hand off a customer they currently own. After reassignment, selling-role SELECT follows **`customers.assigned_to`** (migration **`031`**).

## Staff (admin / operations / manager / accounts)

| Action | admin | operations | manager | accounts |
|--------|-------|------------|---------|----------|
| Record & edit T/T | Yes | No* | Yes | Yes |
| Allocate payment to reserved vehicle | Yes | No* | Yes | Yes |
| Edit stock | Yes | Yes | Yes | No |
| Bulk upload | Yes | Yes | Yes | No |
| Edit vehicle shipping + courier | Yes | Yes | Yes | No |
| Set bid requester | Yes | Yes | Yes | No |
| Edit user salaries (`user_payroll`) | Yes | No | Yes | No |
| Mark vehicle commission paid | Yes | No | Yes | Yes |

\*Operations may receive these via a user **Grant**.

## Enforcement rule

UI hiding a button does **not** grant safety if RLS allows the operation. When adding features, update **both** RLS policies (via `has_permission`) and the permission catalog / role seeds if the action is sensitive.
