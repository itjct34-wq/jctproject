# User Manual — Permissions

Plain-language guide for admins who assign access in the JCT ERP.

## Where to open it

1. Sign in as an **Admin** or **Super Admin**.
2. In the sidebar under **Administration**, open **Permissions** (`/permissions`).
3. Use **Users & Teams** (`/users`) to invite people and set office/shift; use **Permissions** to control what they can do.

## Two layers of access

| Layer | What it means |
|-------|----------------|
| **Role** | A package of permissions (Sales Agent, Accounts, Manager, etc.). Most people only need a role. |
| **User override** | Extra **Grant** or **Deny** for one person on top of their role. |

**Order of checks (deny wins):**

1. If this user has a **Deny** for that action → blocked.
2. Else if this user has a **Grant** → allowed.
3. Else if any of their **roles** includes it → allowed.
4. Else → blocked.

UI buttons and navigation follow the same rules. Database RLS also uses `has_permission(module, action)`.

## How to assign a role

1. Open **Permissions** → **User permissions**.
2. Select the person in the left list.
3. Tick the role(s) under **Roles**.
4. They keep that access until you change it.

You can also manage roles from **Users & Teams**. Do not give **Super Admin** unless you intend full system control.

## How to grant or deny one permission

1. Open **Permissions** → **User permissions**.
2. Select the user.
3. Find the action (grouped by Sales & CRM, Inventory, Finance, Administration).
4. Use the dropdown:
   - **Role default** — follow their role (no override).
   - **Grant** — allow even if the role does not include it.
   - **Deny** — block even if the role includes it.

Example: a sales agent who must allocate remittances → Grant `payments.allocate` (and usually `payments.create` / `payments.edit`).

Example: a manager who must not edit courier → Deny `vehicles.edit_courier`.

## How to change defaults for a whole role

1. Open **Permissions** → **Role defaults**.
2. Pick the role.
3. Tick or untick permissions.

This affects **everyone** with that role (unless they have a personal Deny/Grant). Prefer user overrides for one-off exceptions.

## Sales vs admin defaults

### Sales Agent / Freelancer (typical)

Allowed:

- View stock, customers, invoices (as scoped by ownership rules)
- Reserve stock for their customers
- Create quotations / invoices (per role seed)

Not allowed by default:

- Add / edit / allocate remittances (`payments.create`, `payments.edit`, `payments.allocate`)
- Set bid requester, edit courier, edit shipping
- Bulk upload (`vehicles.import`)
- Accounts & Expenses (`expenses.view`)

### Accounts / Manager / Admin

Allowed (among other ERP rights):

- Remittance add / edit / allocate
- Accounts & Expenses
- Manager/Admin/Operations: stock edit, bid requester, courier, shipping, bulk upload (Accounts normally **view** stock only)

### Operations

- Stock create/edit, shipping, courier, bid requester, bulk upload, expenses
- Remittance **view** only (no mutate) unless you Grant payments permissions

## Permission keys (reference)

| Key | Meaning |
|-----|---------|
| `customers.view` / `create` / `edit` | Customer CRM |
| `sales.view` / `create` | Reservations & quotations |
| `invoices.view` / `create` / `edit` | Invoices |
| `vehicles.view` | See stock lists |
| `vehicles.create` / `edit` / `delete` | Maintain stock records |
| `vehicles.import` | Bulk upload |
| `vehicles.reserve` | Reserve available stock |
| `vehicles.assign` | Assign stock to an agent |
| `vehicles.set_bid_requester` | Set bid requester |
| `vehicles.edit_courier` | Edit courier tracking |
| `vehicles.edit_shipping` | Edit shipping stage |
| `payments.view` | See remittances / T/T |
| `payments.create` / `edit` | Add / edit remittances |
| `payments.allocate` | Allocate / deallocate to stock |
| `payments.confirm` | Confirm payments |
| `expenses.view` | Accounts & Expenses nav and list |
| `expenses.create` / `edit` / `approve` | Expense / payroll actions |
| `users.view` / `edit` / `assign_roles` | User administration |
| `settings.view` | System config pages |
| `audit.view` | Audit logs |
| `auctions.view` / `create` | Auction module |

Full technical model: [PERMISSIONS.md](./PERMISSIONS.md).

## Tips

- After changing your **own** permissions, refresh the page (or sign out/in) so the sidebar updates.
- Hiding a button is not enough for security — RLS enforces `has_permission` in the database.
- Prefer the smallest grant that unblocks the job (e.g. Grant `payments.allocate` instead of promoting someone to Admin).
