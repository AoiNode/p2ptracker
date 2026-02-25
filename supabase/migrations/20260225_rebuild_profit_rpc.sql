
-- Function to rebuild profit for a specific user
-- This runs entirely on the database server, avoiding Vercel timeouts
CREATE OR REPLACE FUNCTION rebuild_user_profit(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_total_sell_txs INTEGER := 0;
    v_processed_txs INTEGER := 0;
    v_new_sales_count INTEGER := 0;
    
    r_tx RECORD;
    r_session RECORD;
    
    v_remaining_to_sell NUMERIC;
    v_fee_per_usdt NUMERIC;
    v_usdt_from_session NUMERIC;
    v_proportional_fee NUMERIC;
    v_proceeds NUMERIC;
    v_cost NUMERIC;
    v_profit NUMERIC;
    
BEGIN
    -- 1. Disable session_sales triggers temporarily to avoid double counting during delete
    -- Note: We can't easily disable triggers without superuser, so we have to be clever.
    -- The issue is: deleting session_sales triggers 'restore_session_on_sale_delete' 
    -- which adds back amounts to sessions.
    
    -- STRATEGY: 
    -- 1. Delete all session_sales first (this will trigger restoration, adding back sold amounts)
    -- 2. Force reset all sessions to their original state (total_usdt) just to be safe
    
    -- Step 1: Delete all existing session_sales for this user
    DELETE FROM session_sales
    WHERE session_id IN (SELECT id FROM sessions WHERE user_id = target_user_id);
    
    -- Step 2: Reset sessions to initial state (clean slate)
    -- We set remaining_usdt = total_usdt because we just deleted all sales
    -- This overwrites whatever the trigger might have done
    UPDATE sessions
    SET 
        remaining_usdt = total_usdt, 
        realized_profit_idr = 0, 
        status = 'active'
    WHERE user_id = target_user_id;

    -- 4. Process SELL transactions (FIFO)
    FOR r_tx IN 
        SELECT * FROM transactions 
        WHERE user_id = target_user_id AND type = 'SELL' 
        ORDER BY tx_time ASC
    LOOP
        v_total_sell_txs := v_total_sell_txs + 1;
        v_remaining_to_sell := r_tx.amount_usdt;
        
        -- Calculate fee per unit
        IF r_tx.amount_usdt > 0 THEN
            v_fee_per_usdt := COALESCE(r_tx.fee_idr, 0) / r_tx.amount_usdt;
        ELSE
            v_fee_per_usdt := 0;
        END IF;
        
        -- Iterate through eligible sessions (FIFO)
        -- We must select current state directly from table for each iteration
        -- because previous loop iterations might have updated the sessions
        FOR r_session IN 
            SELECT * FROM sessions 
            WHERE user_id = target_user_id 
            AND created_at <= r_tx.tx_time 
            AND remaining_usdt > 0.000001
            ORDER BY created_at ASC
        LOOP
            IF v_remaining_to_sell <= 0.000001 THEN
                EXIT; -- Break inner loop if satisfied
            END IF;
            
            -- Calculate amount to take from this session
            IF r_session.remaining_usdt < v_remaining_to_sell THEN
                v_usdt_from_session := r_session.remaining_usdt;
            ELSE
                v_usdt_from_session := v_remaining_to_sell;
            END IF;
            
            -- Calculate metrics
            v_proportional_fee := (v_usdt_from_session * v_fee_per_usdt);
            v_proceeds := (v_usdt_from_session * r_tx.price_idr);
            v_cost := (v_usdt_from_session * r_session.avg_cost);
            v_profit := (v_proceeds - v_cost - v_proportional_fee);
            
            -- Insert session_sale
            INSERT INTO session_sales (
                session_id, tx_id, sold_usdt, proceeds_idr, cost_idr, profit_idr, created_at
            ) VALUES (
                r_session.id, r_tx.id, v_usdt_from_session, v_proceeds, v_cost, v_profit, r_tx.tx_time
            );
            
            v_new_sales_count := v_new_sales_count + 1;
            
            -- Update session immediately
            UPDATE sessions
            SET 
                remaining_usdt = remaining_usdt - v_usdt_from_session,
                realized_profit_idr = realized_profit_idr + v_profit,
                status = CASE WHEN (remaining_usdt - v_usdt_from_session) <= 0.000001 THEN 'closed' ELSE 'active' END
            WHERE id = r_session.id;
            
            v_remaining_to_sell := v_remaining_to_sell - v_usdt_from_session;
        END LOOP;
        
        v_processed_txs := v_processed_txs + 1;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'processed_txs', v_processed_txs,
        'new_sales_records', v_new_sales_count
    );
END;
$$ LANGUAGE plpgsql;
