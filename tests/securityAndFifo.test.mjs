import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../supabase/migrations/20260825_atomic_secure_transactions.sql', import.meta.url);

test('secure migration revokes public access and guards dashboard ownership', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION get_dashboard_totals\(UUID\) FROM PUBLIC, anon;/i);
  assert.match(sql, /target_user_id IS DISTINCT FROM auth\.uid\(\)/i);
});

test('atomic SELL only consumes BUY sessions existing at sell time', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /created_at <= p_tx_time/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /FOR UPDATE/i);
});

test('atomic financial RPCs are service-role only', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /REVOKE ALL ON FUNCTION process_buy_transaction_v2[\s\S]*FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION process_buy_transaction_v2[\s\S]*TO service_role/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION process_sell_transaction_v2[\s\S]*FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION process_sell_transaction\([\s\S]*FROM PUBLIC, anon, authenticated/i);
});

test('SELL API treats an RPC success:false payload as a failed request', async () => {
  const route = await readFile(new URL('../src/app/api/transactions/sell/route.ts', import.meta.url), 'utf8');
  assert.match(route, /data\?\.success === false/);
  assert.match(route, /status:\s*400/);
});

test('PWA config excludes API, Supabase, and non-GET requests from runtime cache', async () => {
  const config = await readFile(new URL('../next.config.js', import.meta.url), 'utf8');
  assert.match(config, /request\.method !== ['"]GET['"]/);
  assert.match(config, /url\.pathname\.startsWith\(['"]\/api\/['"]\)/);
  assert.match(config, /hostname\.includes\(['"]supabase['"]\)/);
});
