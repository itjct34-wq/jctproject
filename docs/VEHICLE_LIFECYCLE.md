# Vehicle Lifecycle

## Two tracks (do not mix)

ERP uses **orthogonal** payment and shipping tracks on `vehicles` (migration **`025_vehicle_payment_shipping_rls.sql`**). Legacy **`vehicles.status`** remains for public listing and history; it is **synced** from the two tracks when `payment_status` or `shipping_status` changes (except `on_hold` / `archived` overrides).

### Payment track — `payment_status`

| Value | Meaning |
|--------|---------|
| `available` | Open for reservation / sale |
| `reserved` | Committed to a customer (`customer_id`, `reserved_by`) |
| `partial_paid` | T/T allocated; total received &lt; listed price |
| `paid` | T/T allocated; received total ≥ listed price (when listed price set) |

### Shipping track — `shipping_status`

| Value | Meaning |
|--------|---------|
| `not_booked` | No export booking yet |
| `booked` | Booking / documentation in progress |
| `shipped` | On vessel / in transit |
| `delivered` | Delivered to buyer destination |

Shipping detail fields on the vehicle row: `shipping_port_of_loading`, `shipping_port_of_discharge`, `shipping_vessel_name`, `shipping_bl_number`, `shipping_line`, `shipping_etd`, `shipping_eta`, `shipping_notes`.

`freight_mode` (`roro` \| `container`, nullable) is the RORO vs container flag on stock (migration **032**). It is independent of booking ports/vessel. Sales may set it on reserve.

### Commission — `commission_pkr` / `commission_status`

Recorded on reserve or stock edit as a **PKR amount** for the selling agent (`reserved_by`). Status is `none` \| `due` \| `paid` (migration **033**).

- **Due** when `payment_status = paid` **or** `shipping_status = delivered` (either), and `commission_pkr` &gt; 0. Trigger `vehicles_apply_commission_status`.
- **Paid** only when **admin, manager, or accounts** mark it (`Mark commission paid` on the vehicle row/detail or Status section). Selling roles cannot mark others’ (or their own) commission paid.
- List row: second meta line shows commission PKR plus Due / **Commission paid** (green). A fuchsia corner marks commission still due.

## Legacy status enum — `vehicles.status`

Still required for public filters and existing reports:

| Status | Typical source |
|--------|----------------|
| `in_stock` | `payment_status = available` |
| `reserved` | `payment_status` in (`reserved`, `partial_paid`) |
| `sold` | `payment_status = paid`, shipping not yet in transit |
| `in_transit` | `paid` + `shipping_status = shipped` |
| `exported` | `paid` + `shipping_status = delivered` |
| `on_hold` | Manual ops block (not auto-overwritten by sync trigger) |
| `archived` | Retired record |

Defined originally in migration `003_vehicle_inventory.sql`; sync trigger in **`025`**.

## Public visibility

- Anon and public queries filter **`in_stock`** and **`reserved`** only (`lib/public/vehicles.ts`, RLS on `vehicle_images`).
- Home page “arrivals” slice uses **`in_stock`** subset (`lib/public/home-data.ts`).

## Reservation

- **Sales agent / freelancer**: may update a vehicle from **`available` → `reserved`**, set `customer_id`, `reserved_by`, `reserved_until`, `sold_price`, `incoterm`, `freight_mode` (vehicles UI **Reserve** or sales reservation flow). RLS + trigger block edits to specs, bid/FOB, or shipping booking fields.
- **Operations / manager / admin**: full stock edit; shipping dialog and courier uploads.

## Courier documents

- Stored as **`record_attachments`** with `entity_type = 'vehicles'` (private **`record-attachments`** bucket).
- **Upload**: admin, operations, manager.
- **View / download**: anyone who can view the vehicle (including sales on their customer’s units).

## History

- **`vehicle_status_history`** stores operational history rows; insert for staff and selling roles on reserve (`025`); select for inventory-access roles.

## Stock identity

- **Chassis** is primary identity for cars/trucks; **stock_number** and **part_sku** support parts and yard numbering.
- Bulk import rejects duplicate chassis within a batch and validates transmission/fuel/status mappings (`lib/vehicles/import-spreadsheet.ts`).

## Categories

- **`stock_category`**: routes public UX — `/inventory` (car), `/machinery`, `/parts` — without separate tables.

## Images

- **`vehicle_images.sort_order`** and **`is_primary`** control gallery order.
- Upload path: manual ERP or bulk ZIP import → **`vehicle-images`** storage.

## UI helpers

- Labels, badges, and list-row tints: `lib/vehicle-lifecycle.ts` (`vehicleListRowClass`, `soldProfitUsd`)
- Stock list rows (Cars/Machinery/Parts): full-row color by payment then shipping; FOB kept; second line shows agent, customer, invoice code, sold, term, RORO/Container, profit, commission PKR + Due/Paid.
- Stock page: payment/shipping badges, **Edit stock**, **Shipping**, **Reserve**, courier attachments.

## Recovery

- Incorrect payment/shipping track: staff with edit rights update columns; legacy `status` follows on next track change.
- Wrong public exposure: set payment track to non-public combination or `on_hold` / `archived`.
