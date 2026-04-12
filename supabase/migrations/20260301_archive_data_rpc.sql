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
    -- Using EXISTS for better performance on large datasets
    DELETE FROM session_sales ss
    WHERE EXISTS (
        SELECT 1 FROM sessions s 
        WHERE s.id = ss.session_id 
        AND s.user_id = target_user_id 
        AND s.status = 'closed'
    )
    RETURNING count(*) INTO v_deleted_sales;

    -- 2. Delete Transactions
    -- We delete ALL SELL transactions (archived in Excel)
    -- and BUY transactions linked to CLOSED sessions
    DELETE FROM transactions t
    WHERE t.user_id = target_user_id
    AND (
        t.type = 'SELL'
        OR (t.type = 'BUY' AND (
            t.session_id IS NULL 
            OR EXISTS (SELECT 1 FROM sessions s WHERE s.id = t.session_id AND s.status = 'closed')
        ))
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