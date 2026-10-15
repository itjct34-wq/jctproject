# Business Rules

## Company identity

Official trade documents and the public site use constants in **`lib/jct-official.ts`**: legal name, Nagoya address, director, license text, and **Rakuten Bank** beneficiary/intermediary SWIFT block. Print layouts must not duplicate conflicting bank data elsewhere.

## Document numbers

- Stored codes (`invoice_code`, `quotation_code`, etc.) are persisted **as entered**.
- **Print and PDF** display uses **`formatDocumentNo`**: prefix **`NO.`** to the exact stored value without stripping hyphens or normalizing the body (leading `NO.` in storage is deduplicated once for display).

## Invoices

- Types include proforma, commercial, and purchase (ERP UI); auction deposit invoices reuse the commercial template with **`variant = auction_deposit`** and deposit amount mode.
- Line items encode vehicle fields via **`describeInvoiceVehicle`** / **`[JCTV]`** metadata in `description`; **`decodeInvoiceVehicle`** recovers fields for print tables.
- **Notes** (`invoices.notes`) render on the printed invoice footer when non-empty (`OfficialTradeDocument`).
- Optional **verification token** powers public **`/verify/[code]`** and QR on print.
- Print options: QR on/off, optional **bank notice** second page (`PaymentInformationNotice`); default guidance is single A4 page with bank notice off.
- **Deposit ratios** on lines may be 30 / 70 / 100 percent or derived from discount vs unit price (`DEPOSIT_RATIOS`, `normalizeDepositRatio`).

## Quotations

- Print layout matches commercial invoice styling (`OfficialTradeDocument`, kind `quotation`).
- Public verification route: **`/verify-quotation/[code]`**.

## Vehicles and stock

- **`stock_category`** must be `car`, `machinery`, or `parts`; default `car` preserves legacy `/inventory` behavior.
- **Public listing** requires status **`in_stock`** or **`reserved`**.
- **Bulk import**: spreadsheet row drives upsert; **`stock_category`** / **`category`** column optional (defaults car). Chassis uniqueness enforced in import logic; parts may use part number / stock / chassis per validation on vehicles page.
- **Photo ZIP**: one folder per unit; folder name matches normalized **chassis**, **stock_number**, or **part_sku**; images uploaded to **`vehicle-images`** and linked in **`vehicle_images`**.

## Auction houses

- Auction houses are **`suppliers`** rows with **`supplier_type = auction_house`**.
- ERP reads directory via view **`auction_houses`** and **`fetchAuctionHouses`**; listings reference **`supplier_id`**.

## Customers and agents

- Customers may be individual or company; CRM supports contacts, requirements, communications.
- **Agent verification** uses TOTP-backed public check (`/verify-agent`, server helpers in `lib/server/agent-totp.ts`).

## Configuration

- **`system_config`** keys (`currencies`, `freight_destinations`, `incoterms`, `shipment_types`) are lists edited only by **super_admin**; changing lists does not rewrite historical invoices or inquiries.

## Attachments

- Payments, expenses, documents (and other record types using `record_attachments`) store files in **`record-attachments`** bucket; max **20 MB** per file.

## Concurrency

- Vehicle status changes should append **`vehicle_status_history`** when implemented in workflows; inventory edits are last-write-wins at row level unless extended with locking.
