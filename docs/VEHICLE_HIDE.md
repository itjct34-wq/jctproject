# Vehicle Hide (soft-hide)

## Why

Staff sometimes need a unit **out of day-to-day stock and reports** without destroying history (chassis, remittances, invoices, status history). Delete is irreversible and blocked for reserved/invoiced stock. Archive already means “retired record.” **Hide** is the soft-hide for “keep the row, stop showing it.”

## Hide vs delete vs archive

| Action | Keeps row | In default stock list | In reports / KPIs | Public catalog | Typical use |
|--------|-----------|------------------------|-------------------|----------------|-------------|
| **Delete** | No | — | — | — | Mistake / empty draft; blocked if reserved or invoiced |
| **Archive** (`status = archived`) | Yes | No (unless filtered) | Usually excluded | No | Long-term retirement after ops done |
| **Hide** (`status = hidden`) | Yes | **No** (unless Status = Hidden) | **Excluded** | No | Soft-hide: not deleted, not in aggregates |

Hide does **not** clear payment, shipping, customer, or remittance data. Payment/shipping tracks stay as-is; the legacy sync trigger treats `hidden` like `on_hold` / `archived` (no auto-overwrite of `status` from those tracks).

## How to hide / unhide

1. Open the vehicle (stock card → View info, or Actions).
2. **Hide** — available to users who can edit stock. Sets `vehicles.status = 'hidden'` and writes `vehicle_status_history`.
3. **Unhide** — **admin** (and manager). Clears `hidden` by setting `status` to the value implied by current payment/shipping (e.g. available → `in_stock`, reserved → `reserved`). Do **not** always set `in_stock` — that would make the sync trigger force `payment_status = available`.

Filter stock list with **Status → Hidden** to find soft-hidden units.

## Schema

- Migration **`050_vehicle_hidden_status`**: extends `vehicles_status_check` with `'hidden'`; updates `sync_vehicle_legacy_status()`.
- App filters: stock list defaults exclude `hidden`; reports exclude `hidden` from vehicle KPIs; public queries already only use `in_stock` / `reserved`.

## Audit

Prefer hide over delete when the chassis may return to market or finance still needs the row. Prefer archive when the unit is permanently retired from the business. Prefer delete only for true duplicates or bad imports with no linked commercial documents.
