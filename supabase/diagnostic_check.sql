-- Diagnostic Script to find data inconsistencies
-- Run this in Supabase SQL Editor

-- 1. Check for SELL transactions that are NOT recorded in session_sales
-- These are "Ghost Sales" that don't reduce session balances
SELECT 
    t.id as tx_id,
    t.tx_time,
    t.amount_usdt,
    t.total_idr,
    t.price_idr,
    t.session_id as tx_session_id
FROM transactions t
LEFT JOIN session_sales ss ON t.id = ss.tx_id
WHERE t.type = 'SELL' 
AND ss.id IS NULL;

-- 2. Check for active sessions that might be fully sold based on existing sales
-- Compare stored remaining_usdt vs calculated remaining
SELECT 
    s.id,
    s.created_at,
    s.total_usdt,
    s.remaining_usdt as stored_remaining,
    (s.total_usdt - COALESCE((SELECT SUM(sold_usdt) FROM session_sales WHERE session_id = s.id), 0)) as calculated_remaining,
    s.status
FROM sessions s
WHERE s.status = 'active'
AND ABS(s.remaining_usdt - (s.total_usdt - COALESCE((SELECT SUM(sold_usdt) FROM session_sales WHERE session_id = s.id), 0))) > 0.01;

-- 3. Check for Total Profit Discrepancy (Dashboard usually sums session_sales.profit_idr)
SELECT 
    TO_CHAR(created_at, 'YYYY-MM') as month,
    SUM(profit_idr) as total_profit
FROM session_sales
GROUP BY 1
ORDER BY 1 DESC;

-- 4. Check total SELL amount vs Total Session Sales amount
SELECT 
    (SELECT SUM(amount_usdt) FROM transactions WHERE type = 'SELL') as total_sell_tx_usdt,
    (SELECT SUM(sold_usdt) FROM session_sales) as total_session_sales_usdt;
