-- RPC Function to archive and delete closed transactions/sales
-- This keeps only active sessions and their history
CREATE OR REPLACE FUNCTION archive_closed_data(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_deleted_txs INTEGER := 0;
    v_deleted_sales INTEGER := 0;
    v_deleted_sessions INTEGER := 0;
BEGIN
    -- 1. Delete session_sales for CLOSED sessions
    DELETE FROM session_sales
    WHERE session_id IN (
        SELECT id FROM sessions 
        WHERE user_id = target_user_id 
        AND status = 'closed'
    )
    RETURNING count(*) INTO v_deleted_sales;

    -- 2. Delete Transactions
    -- We delete ALL SELL transactions (they are archived in Excel)
    -- We delete BUY transactions linked to CLOSED sessions
    -- We delete BUY transactions that have no session (orphans)
    DELETE FROM transactions
    WHERE user_id = target_user_id
    AND (
        type = 'SELL'
        OR (type = 'BUY' AND session_id IN (SELECT id FROM sessions WHERE status = 'closed'))
        OR (type = 'BUY' AND session_id IS NULL)
    )
    RETURNING count(*) INTO v_deleted_txs;

    -- 3. Delete CLOSED sessions
    DELETE FROM sessions
    WHERE user_id = target_user_id 
    AND status = 'closed'
    RETURNING count(*) INTO v_deleted_sessions;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_transactions', v_deleted_txs,
        'deleted_sales', v_deleted_sales,
        'deleted_sessions', v_deleted_sessions
    );
END;
$$ LANGUAGE plpgsql;