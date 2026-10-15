# Shipping Rules

## Shipments

- ERP module at **`/shipments`**: vessel name, voyage, booking date, ETD, ETA, status, and related fields (see `shipments` table from migration 007).
- Create/edit uses **fullscreen** dialog forms.
- Access: view for operations/manager/auditor roles; write for admin/operations/manager (UI map in `use-permissions.ts`).

## Export documents

- **`/documents`**: export paperwork types (BL, export certificate, etc.) linked optionally to **`shipment_id`**.
- Attachments via **`record_attachments`** pattern where enabled on detail sheets.

## Invoice/shipment alignment

- Invoices carry **`shipment_type`**, **`container_mode`**, **`port_of_loading`** (default Nagoya, Japan), **`port_of_discharge`**, **`vessel_name`**, **`bl_number`** for print alignment with shipping reality; they do not auto-create shipment rows.

## Public inquiries

- **`freight_destinations`** in `system_config` feeds public inquiry destination country options (`/api/public/config`, contact flows).

## Events

- Shipment status history is not modeled as append-only events separate from the shipment row in current migrations; updates overwrite shipment fields.

## Documents vs inventory

- Vehicles in **`in_transit`** or **`exported`** status are hidden from public catalog queries even if still in ERP lists.
