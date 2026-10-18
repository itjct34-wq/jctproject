import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MIGRATION_055_SQL = `
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS procurement_source text NOT NULL DEFAULT 'own_stock',
  ADD COLUMN IF NOT EXISTS dealership_name text,
  ADD COLUMN IF NOT EXISTS once_price numeric(14,2),
  ADD COLUMN IF NOT EXISTS once_price_currency text NOT NULL DEFAULT 'JPY';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vehicles_procurement_source_check'
      AND conrelid = 'public.vehicles'::regclass
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_procurement_source_check
      CHECK (procurement_source IN ('own_stock', 'auction', 'third_party'));
  END IF;
END $$;

UPDATE public.vehicles v
SET procurement_source = 'auction'
WHERE v.procurement_source = 'own_stock'
  AND (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.vehicle_id = v.id AND p.auction_listing_id IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.auction_listings al
      WHERE al.vehicle_id = v.id
    )
  );

CREATE INDEX IF NOT EXISTS vehicles_procurement_source_idx
  ON public.vehicles (procurement_source);

ALTER TABLE public.bulk_import_batches
  DROP CONSTRAINT IF EXISTS bulk_import_batches_kind_check;

ALTER TABLE public.bulk_import_batches
  ADD CONSTRAINT bulk_import_batches_kind_check
  CHECK (kind IN ('car', 'machinery', 'parts', 'auctions', 'photos', 'third_party'));
`;

/**
 * One-shot DDL for migration 055 + optional bootstrap of local import credentials.
 * Auth: Authorization Bearer must match ONESHOT_MIGRATION_TOKEN (temporary Vercel env).
 * Remove the token (and this route) after use.
 */
function authorized(request: NextRequest): boolean {
  const expected = process.env.ONESHOT_MIGRATION_TOKEN?.trim();
  if (!expected) return false;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return Boolean(token) && token === expected;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { bootstrap?: boolean };
  const dbUrl = (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    ''
  ).trim();
  if (!dbUrl) {
    return NextResponse.json({ error: 'POSTGRES_URL not configured' }, { status: 500 });
  }

  // Supabase pooler / intermediate CAs can fail default Node TLS verification in serverless.
  const previousTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const connectionString = dbUrl.replace(/[?&]sslmode=[^&]+/gi, '').replace(/\?&/, '?');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.query(MIGRATION_055_SQL);
    const check = await client.query(
      `select 1 from information_schema.columns
       where table_schema='public' and table_name='vehicles' and column_name='procurement_source'`
    );

    const payload: Record<string, unknown> = {
      ok: true,
      procurement_source: check.rowCount === 1,
    };

    // Temporary bootstrap for local ZIP import (never leave token/route deployed).
    if (body.bootstrap) {
      payload.NEXT_PUBLIC_SUPABASE_URL =
        process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || null;
      payload.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || null;
      payload.POSTGRES_URL_NON_POOLING =
        process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || null;
    }

    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'migration failed' },
      { status: 500 }
    );
  } finally {
    await client.end().catch(() => undefined);
    if (previousTls === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousTls;
  }
}
