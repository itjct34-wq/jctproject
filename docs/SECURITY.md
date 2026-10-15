# Security

## Authentication

- **ERP users**: Supabase Auth email/password (`signInWithPassword` in `lib/auth-provider.tsx`).
- **Sessions**: Persisted in browser via Supabase client plus `jct-sb-access-token` cookie; `middleware.ts` redirects unauthenticated ERP routes to `/login`. `AppShell` is a second client-side check.
- **User provisioning**: Admins create users through `POST /api/admin/invite-user` with a **minimum 8-character password**; email is auto-confirmed server-side. Password updates use `POST /api/admin/update-user` (optional password field). Plaintext passwords must never be logged or stored outside Auth.

## Authorization

- **Postgres RLS** is enabled on operational tables (from migration 001 onward).
- **Sales own-records** (migrations **029**, **031**): selling roles see customers by **`assigned_to`** (legacy: unassigned rows they created). Quotes, invoices, and sales follow that customer owner via `sales_owns_customer` / `selling_owns_deal`, not invoice `created_by`. Elevated staff see all.
- **`has_role` / `has_permission` / `is_admin_user`** are revoked from `anon` and granted to **`authenticated`** only (migrations 009 hardening).
- **Super admin** can manage roles and permissions tables; ordinary users cannot self-assign roles.

## Secrets and environment

| Variable | Exposure |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (browser) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (browser); must respect RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — API routes, admin user creation |
| `AGENT_TOTP_SECRET` | **Server only** — fallback for agent HMAC codes |

Do not commit `.env.local` or paste live JWTs into documentation. Build-time placeholders in `lib/supabase/env.ts` exist only so `next build` can prerender without real env.

## Storage

| Bucket | Access |
|--------|--------|
| `vehicle-images` | Public read for catalog photos; uploads from authenticated ERP flows / photo ZIP API; ZIP batch undo removes objects via inventory staff API |
| `record-attachments` | Private; signed URLs for download (`components/shared/record-attachments.tsx`, 20 MB max per file) |

## Public surface

- Public pages use the **anon** key and RLS-limited selects.
- Invoice, quotation, and agent verification use **tokenized URLs** and dedicated API handlers (`/api/public/verify-invoice`, verify quotation flow, `/api/public/verify-agent`) rather than exposing full finance tables to anon.
- Public inquiry submission: `/api/public/inquiries` with rate/config controls (migrations 014–015).

## Logging and audit

- **`audit_logs`** table exists for administrative review (`/audit` module).
- Client toasts surface Supabase errors; avoid displaying raw SQL or keys to end users.

## Hardening checklist for changes

- New tables must enable RLS and define policies before production use.
- New API routes that bypass RLS must use service role only on the server and validate caller identity.
- Never grant `anon` write access to business tables unless explicitly required and reviewed.
