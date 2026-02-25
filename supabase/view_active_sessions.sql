-- View active sessions (sessions with remaining USDT)
SELECT 
    id,
    created_at,
    total_usdt,
    remaining_usdt,
    avg_cost,
    status,
    (total_usdt - remaining_usdt) as sold_usdt
FROM sessions
WHERE status = 'active' OR remaining_usdt > 0.0001
ORDER BY created_at DESC;
