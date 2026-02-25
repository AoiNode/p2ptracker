-- Recalculate remaining_usdt for all sessions based on session_sales
-- This ensures that the remaining amount is exactly total - sold
UPDATE sessions s
SET remaining_usdt = s.total_usdt - COALESCE((
    SELECT SUM(ss.sold_usdt)
    FROM session_sales ss
    WHERE ss.session_id = s.id
), 0);

-- Update status: close if remaining is negligible (less than 0.0001 USDT)
UPDATE sessions
SET status = CASE 
    WHEN remaining_usdt <= 0.0001 THEN 'closed' 
    ELSE 'active' 
END;
