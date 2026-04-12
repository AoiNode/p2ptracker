-- RPC Function to archive and delete closed transactions/sales
-- This keeps only active sessions and their history
CREATE OR REPLACE FUNCTION archive_closed_data(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_deleted_txs INTEGER := 0;
    v_deleted_sales INTEGER := 0;
    v_deleted_sessions INTEGER := 0;
BEGIN
    -- 1. Delete session_sales for CLOSED sessions that are NOT linked to any active sessions
    -- This is safe because we already have the summary in the session table
    DELETE FROM session_sales
    WHERE session_id IN (
        SELECT id FROM sessions 
        WHERE user_id = target_user_id 
        AND status = 'closed'
    )
    RETURNING count(*) INTO v_deleted_sales;

    -- 2. Delete CLOSED sessions
    -- We can delete them because their total profit is already reflected in the stats
    -- and they no longer have USDT to sell.
    DELETE FROM sessions
    WHERE user_id = target_user_id 
    AND status = 'closed'
    RETURNING count(*) INTO v_deleted_sessions;

    -- 3. Delete transactions that are NOT linked to any remaining sessions
    -- This includes all past SELL transactions and CLOSED BUY transactions
    DELETE FROM transactions
    WHERE user_id = target_user_id
    AND id NOT IN (
        SELECT session_id FROM transactions WHERE session_id IS NOT NULL
        UNION
        SELECT id FROM transactions WHERE type = 'BUY' AND id IN (SELECT id FROM sessions WHERE status = 'active')
    )
    -- Also ensure we don't delete BUY transactions linked to active sessions
    AND (session_id IS NULL OR session_id NOT IN (SELECT id FROM sessions WHERE status = 'active'))
    RETURNING count(*) INTO v_deleted_txs;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_transactions', v_deleted_txs,
        'deleted_sales', v_deleted_sales,
        'deleted_sessions', v_deleted_sessions
    );
END;
$$ LANGUAGE plpgsql;