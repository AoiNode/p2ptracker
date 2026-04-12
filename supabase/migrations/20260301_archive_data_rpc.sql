-- RPC Function to archive and delete closed transactions/sales
-- Using SECURITY DEFINER to bypass RLS restrictions during cleanup
CREATE OR REPLACE FUNCTION archive_closed_data_v2(target_user_id UUID)
RETURNS JSONB 
SECURITY DEFINER -- This is the key to bypass RLS
SET search_path = public
AS $$
DECLARE
    v_deleted_txs INTEGER := 0;
    v_deleted_sales INTEGER := 0;
    v_deleted_sessions INTEGER := 0;
BEGIN
    -- STEP 1: Delete session_sales for CLOSED sessions
    -- Only for sessions that belong to the user AND are closed
    DELETE FROM session_sales
    WHERE session_id IN (
        SELECT id FROM sessions 
        WHERE user_id = target_user_id 
        AND status = 'closed'
    );
    GET DIAGNOSTICS v_deleted_sales = ROW_COUNT;

    -- STEP 2: Delete Transactions
    -- We delete ALL SELL transactions (they are already in Excel)
    -- We delete BUY transactions that are linked to CLOSED sessions
    -- We EXPLICITLY PROTECT BUY transactions linked to ACTIVE sessions
    DELETE FROM transactions
    WHERE user_id = target_user_id
    AND (
        type = 'SELL'
        OR (type = 'BUY' AND (
            session_id IS NULL -- Orphans
            OR session_id IN (SELECT id FROM sessions WHERE user_id = target_user_id AND status = 'closed')
        ))
    )
    -- FINAL PROTECTION: Never delete a transaction if its session is still active
    AND (
        session_id IS NULL 
        OR session_id NOT IN (SELECT id FROM sessions WHERE user_id = target_user_id AND remaining_usdt > 0.00000001)
    );
    GET DIAGNOSTICS v_deleted_txs = ROW_COUNT;

    -- STEP 3: Delete CLOSED sessions
    DELETE FROM sessions
    WHERE user_id = target_user_id 
    AND status = 'closed'
    AND remaining_usdt <= 0.00000001; -- Safety check
    GET DIAGNOSTICS v_deleted_sessions = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_transactions', v_deleted_txs,
        'deleted_sales', v_deleted_sales,
        'deleted_sessions', v_deleted_sessions,
        'message', 'Cleanup completed with RLS bypass'
    );
END;
$$ LANGUAGE plpgsql;