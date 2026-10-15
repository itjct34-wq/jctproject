# Vehicle Lifecycle

## Status enum

`vehicles.status` must be one of:

| Status | Meaning |
|--------|---------|
| `in_stock` | Available in yard/stock |
| `reserved` | Committed to buyer; still shown on public site |
| `sold` | Sold; hidden from public |
| `in_transit` | Shipping; hidden from public |
| `exported` | Completed export; hidden from public |
| `on_hold` | Blocked from sale; hidden from public |
| `archived` | Retired record; hidden from public |

Defined in migration `003_vehicle_inventory.sql` and `lib/types/database.ts`.

## Public visibility

- Anon and public queries filter **`in_stock`** and **`reserved`** only (`lib/public/vehicles.ts`, RLS on `vehicle_images`).
- Home page “arrivals” slice uses **`in_stock`** subset (`lib/public/home-data.ts`).

## History

- **`vehicle_status_history`** stores operational history rows; insert policies limited to operations roles; select for inventory-access roles.

## Stock identity

- **Chassis** is primary identity for cars/trucks; **stock_number** and **part_sku** support parts and yard numbering.
- Bulk import rejects duplicate chassis within a batch and validates transmission/fuel/status mappings (`lib/vehicles/import-spreadsheet.ts`).

## Categories

- **`stock_category`**: routes public UX — `/inventory` (car), `/machinery`, `/parts` — without separate tables.

## Images

- **`vehicle_images.sort_order`** and **`is_primary`** control gallery order.
- Upload path: manual ERP or bulk ZIP import → **`vehicle-images`** storage.

## Transitions

- Status changes are performed in ERP vehicles UI; no centralized state machine service — validators enforce allowed enum strings on import.

## Recovery

- Incorrect status: operations users with edit rights update row and optionally log history note.
- Wrong public exposure: set status outside `in_stock`/`reserved` or archive.
