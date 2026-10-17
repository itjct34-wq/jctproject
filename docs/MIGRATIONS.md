# Migrations

SQL lives in `supabase/migrations/`. Apply **in filename order** on a new database.

## Production (`omlejtzwodudghqqgaiz`)

Migrations **019 through 033** are already intended for this project. **Do not rename or rewrite historical files** that production has applied. A rename would look like a new migration locally and a missing one remotely.

## Duplicate and malformed names (leave as-is)

Several early files were generated twice or with extra `.sql.sql` suffixes. They remain in git so applied history is not rewritten:

| Issue | Examples |
|--------|----------|
| Duplicate **009** | `...009_security_hardening.sql.sql` and `...009_security_hardening_fix.sql.sql` |
| Duplicate **013** | `013_user_office_shift_link.sql`, `013_inquiry_workflow_fields.sql`, `013_inquiry_system_alignment.sql`, `013_record_attachments_quotation_qr.sql` |
| Duplicate **014** | `014_avatars_and_profile_link.sql`, `014_inquiries_config_agent_totp.sql`, `014_customer_contact_uniqueness.sql` |
| Malformed timestamps | `20261010_offices_shifts_avatar.sql`; files ending in `.sql.sql` |

If you need a schema change, add a **new** timestamped file after the highest applied number (041+).

| # | File | Purpose |
|---|------|---------|
| **042** | `20261016240000_042_user_permissions_overrides.sql` | `user_permissions` grant/deny, `has_permission` + `get_my_permissions()`, fine-grained stock/remittance keys, role seed alignment |
| **050** | `20261017040000_050_vehicle_hidden_status.sql` | Soft-hide: `vehicles.status = hidden`; sync trigger treats like on_hold/archived |
| **053** | `20261017070000_053_vehicle_image_role.sql` | `vehicle_images.image_role` (A/F/B ZIP roles); anon RLS hides `auction_sheet` |

## CLI

`supabase/config.toml` documents `project_id = omlejtzwodudghqqgaiz`. Use `supabase link` / SQL editor / MCP `apply_migration` for new DDL — not a mass rename of 009–014.
