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

CREATE OR REPLACE FUNCTION monthly_close_reset_v1(target_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_snapshot JSONB;
    v_active_count INTEGER := 0;
    v_finalized_months INTEGER := 0;
    v_deleted_sales INTEGER := 0;
    v_deleted_txs INTEGER := 0;
    v_deleted_sessions INTEGER := 0;
    v_restored_sessions INTEGER := 0;
    r JSONB;
    v_created_at TIMESTAMPTZ;
    v_price_idr NUMERIC;
    v_avg_cost NUMERIC;
    v_remaining_usdt NUMERIC;
BEGIN
    PERFORM refresh_all_open_monthly_profit_summaries(target_user_id);
    v_finalized_months := finalize_monthly_profit_summaries(target_user_id);

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'created_at', created_at,
                'price_idr', price_idr,
                'avg_cost', avg_cost,
                'remaining_usdt', remaining_usdt
            )
            ORDER BY created_at ASC
        ),
        '[]'::jsonb
    )
    INTO v_snapshot
    FROM sessions
    WHERE user_id = target_user_id
      AND remaining_usdt > 0.00000001;

    v_active_count := jsonb_array_length(v_snapshot);

    DELETE FROM session_sales
    WHERE session_id IN (
        SELECT id FROM sessions WHERE user_id = target_user_id
    );
    GET DIAGNOSTICS v_deleted_sales = ROW_COUNT;

    DELETE FROM transactions
    WHERE user_id = target_user_id;
    GET DIAGNOSTICS v_deleted_txs = ROW_COUNT;

    DELETE FROM sessions
    WHERE user_id = target_user_id;
    GET DIAGNOSTICS v_deleted_sessions = ROW_COUNT;

    FOR r IN SELECT * FROM jsonb_array_elements(v_snapshot)
    LOOP
        v_created_at := (r->>'created_at')::timestamptz;
        v_price_idr := (r->>'price_idr')::numeric;
        v_avg_cost := NULLIF((r->>'avg_cost')::numeric, 0);
        IF v_avg_cost IS NULL THEN
            v_avg_cost := v_price_idr;
        END IF;
        v_remaining_usdt := (r->>'remaining_usdt')::numeric;

        IF v_remaining_usdt IS NULL OR v_remaining_usdt <= 0.00000001 THEN
            CONTINUE;
        END IF;

        INSERT INTO sessions (
            user_id,
            created_at,
            price_idr,
            total_invest_idr,
            total_usdt,
            avg_cost,
            remaining_usdt,
            realized_profit_idr,
            status
        ) VALUES (
            target_user_id,
            v_created_at,
            v_price_idr,
            v_avg_cost * v_remaining_usdt,
            v_remaining_usdt,
            v_avg_cost,
            v_remaining_usdt,
            0,
            'active'
        );

        v_restored_sessions := v_restored_sessions + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'active_count', v_active_count,
        'active_snapshot', v_snapshot,
        'deleted_sales', v_deleted_sales,
        'deleted_transactions', v_deleted_txs,
        'deleted_sessions', v_deleted_sessions,
        'restored_sessions', v_restored_sessions,
        'finalized_months', v_finalized_months
    );
END;
$$ LANGUAGE plpgsql;
