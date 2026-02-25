-- Restore specific session to full capacity and change date to Jan 5
BEGIN;

-- 1. Remove any sales records associated with this session
-- This is necessary to make "remaining_usdt = total_usdt" valid and consistent
DELETE FROM session_sales
WHERE session_id = 'cfcdb1c0-43c2-442b-9788-728c5166f1e3';

-- 2. Update the session details
UPDATE sessions
SET 
    remaining_usdt = total_usdt, -- Reset to full
    status = 'active',           -- Set to active
    created_at = '2026-01-05 10:00:00+00' -- Change date to Jan 5, 2026
WHERE id = 'cfcdb1c0-43c2-442b-9788-728c5166f1e3';

-- 3. Update the associated BUY transaction date to match
-- This keeps the data consistent (transaction date matches session date)
UPDATE transactions
SET tx_time = '2026-01-05 10:00:00+00'
WHERE session_id = 'cfcdb1c0-43c2-442b-9788-728c5166f1e3' 
AND type = 'BUY';

COMMIT;
