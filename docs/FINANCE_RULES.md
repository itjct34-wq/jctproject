# Finance Rules

## Invoices

- **Header totals**: `subtotal`, `tax`, `total`, plus optional **`freight_total`**, **`insurance_total`**, **`other_charges`**, **`discount_total`**; print grand total recomputes from these in `CommercialInvoiceTemplate`.
- **Payment status** tracked on invoice (`payment_status`, e.g. unpaid/paid variants per schema).
- **Trade terms**: `incoterms` (default FOB), **`shipment_type`** (RORO vs Container), **`container_mode`**, ports, vessel/BL fields for shipping block on print.
- **Bank details**: Primary block is static from **`JCT_OFFICIAL.bank`** in the invoice print table; optional **`bank_details`** on row may override in forms where wired.
- **Payment terms** string stored on invoice for print.
- **Sales agent** name can appear on print (`sales_agent` / migration 018 field).
- **Auction invoices**: Same data model; UI filters workspace to auction deposit workflow; deposit shown as amount not ratio.

## Invoice line items

- Table columns on print: description (with decoded chassis/stock/make/model/colour/year/engine/transmission), quantity, unit price, line total, deposit ratio where applicable.
- Vehicle link optional via **`vehicle_id`** on `invoice_items`.

## Payments (T/T)

- Recorded by **admin, manager, accounts** only (UI + RLS insert/update).
- **Customer** required for tagging; **`sales_agent_id`** on `payments` is set automatically from `COALESCE(customers.assigned_to, customers.created_by)` (trigger, migration **`025`**).
- Optional links: **`invoice_id`**, **`sale_id`**, **`vehicle_id`** (allocate to customer’s reserved vehicle).
- When **`vehicle_id`** is set and status is `received` or `reconciled`, **`vehicles.payment_status`** recomputes to `partial_paid` or `paid` vs `listed_price`.
- **Attachments** supported via `record_attachments` (receipts, TT copies).
- **Sales agent / freelancer**: read-only list of payments where they are the tagged sales agent or own the customer; can open TT documents. No Actions menu (create/edit/allocate/deallocate/delete) — UI + RLS migration **043**; role defaults lack `payments.create` / `edit` / `allocate`.

## Expenses

- Accounts module; attachments same pattern as payments.

## Quotations

- Feeds sales workflow; converting to invoice/reservation may use helpers such as **`create-reservation-invoice`** where invoked from sales UI.
- Verification token for public **`/verify-quotation/[code]`**.

## Currencies

- Invoice/quotation **`currency`** field; supported list driven by **`system_config.currencies`** for new documents (ISO 4217 three-letter codes in config UI).

## Export

- Invoice list export and single-document **Excel/DOCX** from invoices workspace; PDF via browser print helper.

## Payroll

- Table **`user_payroll`**: one row per user (`salary_amount`, `salary_currency` default **PKR**). Edited on Users → Payroll by **admin** or **manager**. Sales/freelancer cannot write salaries (RLS). Not a full HR product (no tax slips).

## Vehicle commission

- **`vehicles.commission_pkr`**: staff-entered PKR for the selling agent. Optional 10% of USD profit helper only if `system_config.pkr_per_usd` exists; the app does not invent an FX rate.
- **`commission_status`**: `none` until the vehicle is **paid** or **delivered**; then **due** if amount &gt; 0; **paid** when admin/manager/accounts mark it. Paid status is sticky.

## FX

- No automatic FX ledger in app; amounts are stored in document currency. Multi-currency reporting is not derived in code beyond stored values. Commission stays in PKR unless a configured `pkr_per_usd` helper is used to suggest an amount.

## Allocations

- Payment-to-invoice linkage via **`invoice_id`** on payment rows.
- Payment-to-vehicle linkage via **`payment_allocations`** (one row per payment+vehicle; partial amounts may sum to ≤ remit). Legacy **`payments.vehicle_id`** is synced to the first allocation line.
- **Multi-vehicle**: Remittances → Actions → Allocate / Edit allocation; **Add More** for additional stock lines. Remaining = remit − Σ(allocate_amount); status `allocated` when remaining ≈ 0.
- **Per-vehicle deallocate**: Remittances → Actions → Deallocate… (Remove one stock line, or Deallocate all); stock card remittance popover **Remove**; vehicle View info → Remittances → Deallocate. Deleting one allocation row leaves other vehicles intact; triggers recompute remittance remaining and that vehicle’s `payment_status`.
- Mutate/allocate requires admin/manager/accounts (or Grant of `payments.create` / `edit` / `allocate`); sales are view-only.
- Full double-entry ledger is not implemented as a separate journal table in current schema.
