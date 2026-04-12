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
    -- Using a batch to avoid locking, with direct join for speed
    DELETE FROM session_sales
    WHERE id IN (
        SELECT ss.id 
        FROM session_sales ss
        JOIN sessions s ON s.id = ss.session_id
        WHERE s.user_id = target_user_id 
        AND s.status = 'closed'
        LIMIT 10000
    )
    RETURNING count(*) INTO v_deleted_sales;

    -- 2. Delete Transactions
    -- Delete all SELL transactions (already archived in Excel)
    -- AND BUY transactions that are closed or orphaned
    DELETE FROM transactions
    WHERE id IN (
        SELECT t.id 
        FROM transactions t
        WHERE t.user_id = target_user_id
        AND (
            t.type = 'SELL'
            OR (t.type = 'BUY' AND (
                t.session_id IS NULL 
                OR EXISTS (SELECT 1 FROM sessions s WHERE s.id = t.session_id AND s.status = 'closed')
            ))
        )
        LIMIT 10000
    )
    RETURNING count(*) INTO v_deleted_txs;

    -- 3. Delete CLOSED sessions
    DELETE FROM sessions
    WHERE id IN (
        SELECT id FROM sessions 
        WHERE user_id = target_user_id 
        AND status = 'closed'
        LIMIT 10000
    )
    RETURNING count(*) INTO v_deleted_sessions;

    -- 4. Final safety check: Delete any SELL transactions that might have been missed
    -- (e.g. if they weren't linked to a session for some reason)
    WITH deleted_extra AS (
        DELETE FROM transactions 
        WHERE user_id = target_user_id AND type = 'SELL'
        RETURNING 1
    )
    SELECT v_deleted_txs + count(*) INTO v_deleted_txs FROM deleted_extra;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_transactions', v_deleted_txs,
        'deleted_sales', v_deleted_sales,
        'deleted_sessions', v_deleted_sessions
    );
END;
$$ LANGUAGE plpgsql;