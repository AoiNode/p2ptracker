import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllPages, deriveSaleSource } from '../src/lib/dataScale.ts';

test('fetchAllPages loads every row beyond the 1000-row PostgREST cap', async () => {
  const rows = Array.from({ length: 2505 }, (_, id) => ({ id }));
  const calls = [];
  const result = await fetchAllPages(async (from, to) => {
    calls.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  }, 1000);
  assert.equal(result.length, 2505);
  assert.deepEqual(calls, [[0,999],[1000,1999],[2000,2999]]);
});

test('fetchAllPages propagates page errors rather than returning partial financial data', async () => {
  await assert.rejects(
    fetchAllPages(async (from) => from === 0 ? { data: Array(1000).fill({}), error: null } : { data: null, error: new Error('page failed') }, 1000),
    /page failed/
  );
});

test('deriveSaleSource uses persisted cost when session is absent from client state', () => {
  assert.deepEqual(
    deriveSaleSource({ sold_usdt: 100, cost_idr: 1_750_000, profit_idr: 23_000 }, null),
    { avgCost: 17_500, sessionDate: '-', profit: 23_000, cost: 1_750_000, usdt: 100 }
  );
});

test('deriveSaleSource prefers joined session metadata', () => {
  assert.equal(deriveSaleSource({ sold_usdt: 10, cost_idr: 100_000, profit_idr: 5_000 }, { avg_cost: 11_000, created_at: '2026-01-01' }).avgCost, 11_000);
});
