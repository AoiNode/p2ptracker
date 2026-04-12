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
    -- STEP 1: Delete all SELL transactions for this user
    -- (This will automatically delete related session_sales due to ON DELETE CASCADE)
    DELETE FROM transactions
    WHERE user_id = target_user_id AND type = 'SELL';
    GET DIAGNOSTICS v_deleted_txs = ROW_COUNT;

    -- STEP 2: Delete CLOSED sessions
    -- (This will automatically delete related BUY transactions due to ON DELETE CASCADE)
    -- We delete sessions that are explicitly 'closed' OR have no USDT left
    DELETE FROM sessions
    WHERE user_id = target_user_id 
    AND (status = 'closed' OR remaining_usdt <= 0.00000001);
    GET DIAGNOSTICS v_deleted_sessions = ROW_COUNT;

    -- STEP 3: Delete Orphaned BUY transactions
    -- (Transactions that aren't linked to any session)
    WITH deleted_orphans AS (
        DELETE FROM transactions
        WHERE user_id = target_user_id 
        AND type = 'BUY' 
        AND session_id IS NULL
        RETURNING 1
    )
    SELECT v_deleted_txs + count(*) INTO v_deleted_txs FROM deleted_orphans;

    -- Note: v_deleted_sales is now implicitly handled by cascade, 
    -- but we return a success status.
    v_deleted_sales := 0; 

    RETURN jsonb_build_object(
        'success', true,
        'deleted_transactions', v_deleted_txs,
        'deleted_sessions', v_deleted_sessions,
        'message', 'Agresive cleanup completed. Closed sessions and all SELL history removed.'
    );
END;
$$ LANGUAGE plpgsql;