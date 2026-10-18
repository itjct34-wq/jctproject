/**
 * Apply migration 055 via Postgres URL (local/one-off).
 * Requires POSTGRES_URL or POSTGRES_URL_NON_POOLING in env/.env.local.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const url = (
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  ''
).trim();

if (!url) {
  console.error('Missing POSTGRES_URL / POSTGRES_URL_NON_POOLING');
  process.exit(1);
}

const sqlPath = 'supabase/migrations/20261018043000_055_vehicle_procurement_source.sql';
const sql = fs.readFileSync(sqlPath, 'utf8');

async function main() {
  let pg;
  try {
    pg = require('pg');
  } catch {
    console.error('Install pg: npm install pg');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    const check = await client.query(
      `select column_name from information_schema.columns
       where table_schema='public' and table_name='vehicles' and column_name='procurement_source'`
    );
    console.log('ok', check.rowCount === 1 ? 'procurement_source present' : 'column missing after apply');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
