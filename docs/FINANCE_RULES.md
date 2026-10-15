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

## Payments

- Recorded against customers and optionally linked to **`invoice_id`**.
- Status transitions managed in `/payments` UI.
- **Attachments** supported via `record_attachments` (receipts, TT copies).

## Expenses

- Accounts module; attachments same pattern as payments.

## Quotations

- Feeds sales workflow; converting to invoice/reservation may use helpers such as **`create-reservation-invoice`** where invoked from sales UI.
- Verification token for public **`/verify-quotation/[code]`**.

## Currencies

- Invoice/quotation **`currency`** field; supported list driven by **`system_config.currencies`** for new documents (ISO 4217 three-letter codes in config UI).

## Export

- Invoice list export and single-document **Excel/DOCX** from invoices workspace; PDF via browser print helper.

## FX

- No automatic FX ledger in app; amounts are stored in document currency. Multi-currency reporting is not derived in code beyond stored values.

## Allocations

- Payment-to-invoice linkage is via **`invoice_id`** on payment rows; full double-entry ledger is not implemented as a separate journal table in current schema.
