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
    -- Using a batch to avoid locking
    DELETE FROM session_sales ss
    WHERE ss.id IN (
        SELECT ss2.id FROM session_sales ss2
        JOIN sessions s ON s.id = ss2.session_id
        WHERE s.user_id = target_user_id 
        AND s.status = 'closed'
        LIMIT 10000 -- Batch size
    )
    RETURNING count(*) INTO v_deleted_sales;

    -- 2. Delete Transactions
    -- Delete all SELL transactions (already archived in Excel)
    -- AND BUY transactions that are closed or orphaned
    DELETE FROM transactions t
    WHERE t.id IN (
        SELECT t2.id FROM transactions t2
        WHERE t2.user_id = target_user_id
        AND (
            t2.type = 'SELL'
            OR (t2.type = 'BUY' AND (
                t2.session_id IS NULL 
                OR EXISTS (SELECT 1 FROM sessions s WHERE s.id = t2.session_id AND s.status = 'closed')
            ))
        )
        LIMIT 10000 -- Batch size
    )
    RETURNING count(*) INTO v_deleted_txs;

    -- 3. Delete CLOSED sessions
    DELETE FROM sessions
    WHERE id IN (
        SELECT id FROM sessions 
        WHERE user_id = target_user_id 
        AND status = 'closed'
        LIMIT 10000 -- Batch size
    )
    RETURNING count(*) INTO v_deleted_sessions;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_transactions', v_deleted_txs,
        'deleted_sales', v_deleted_sales,
        'deleted_sessions', v_deleted_sessions
    );
END;
$$ LANGUAGE plpgsql;