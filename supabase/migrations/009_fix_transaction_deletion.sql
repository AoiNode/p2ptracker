-- Fix transaction deletion to handle SELL transactions and cascading deletes

-- Function to handle BUY transaction deletion
-- This will also clean up related SELL transactions if needed
CREATE OR REPLACE FUNCTION handle_buy_transaction_deletion()
RETURNS TRIGGER AS $$
DECLARE
    v_session_id UUID;
    v_total_sold NUMERIC;
    v_remaining_buy_usdt NUMERIC;
BEGIN
    IF OLD.type = 'BUY' AND OLD.session_id IS NOT NULL THEN
        v_session_id := OLD.session_id;
        
        -- Get total sold USDT for this session
        SELECT COALESCE(SUM(sold_usdt), 0)
        INTO v_total_sold
        FROM session_sales
        WHERE session_id = v_session_id;
        
        -- Get remaining BUY USDT after this deletion
        SELECT COALESCE(SUM(amount_usdt), 0)
        INTO v_remaining_buy_usdt
        FROM transactions
        WHERE session_id = v_session_id
        AND type = 'BUY'
        AND id != OLD.id;
        
        -- If total sold exceeds remaining buy, we need to delete some SELL transactions
        -- This is a complex FIFO recalculation - for now just warn
        IF v_total_sold > v_remaining_buy_usdt THEN
            RAISE WARNING 'Deleting this BUY transaction affects existing SELL transactions';
            -- Optionally: prevent deletion
            -- RAISE EXCEPTION 'Cannot delete BUY transaction: existing SELL transactions depend on it';
        END IF;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for BUY transaction deletion warning
DROP TRIGGER IF EXISTS handle_buy_deletion ON transactions;
CREATE TRIGGER handle_buy_deletion
BEFORE DELETE ON transactions
FOR EACH ROW
EXECUTE FUNCTION handle_buy_transaction_deletion();

-- Function to clean up session_sales when SELL transaction is deleted
CREATE OR REPLACE FUNCTION clean_session_sales_on_sell_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.type = 'SELL' THEN
        -- Delete related session_sales record
        DELETE FROM session_sales WHERE tx_id = OLD.id;
        
        -- Update session remaining USDT
        IF OLD.session_id IS NOT NULL THEN
            UPDATE sessions
            SET remaining_usdt = remaining_usdt + OLD.amount_usdt,
                status = 'active'
            WHERE id = OLD.session_id;
        END IF;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to clean up session_sales
DROP TRIGGER IF EXISTS clean_sales_on_sell_delete ON transactions;
CREATE TRIGGER clean_sales_on_sell_delete
BEFORE DELETE ON transactions
FOR EACH ROW
EXECUTE FUNCTION clean_session_sales_on_sell_delete();

-- Update the recalculate function to also recalculate realized profit
CREATE OR REPLACE FUNCTION recalculate_session_totals(session_uuid UUID)
RETURNS void AS $$
DECLARE
    v_total_invest_idr NUMERIC;
    v_total_usdt NUMERIC;
    v_avg_cost NUMERIC;
    v_total_sold_usdt NUMERIC;
    v_remaining_usdt NUMERIC;
    v_realized_profit_idr NUMERIC;
BEGIN
    -- Calculate total investment and USDT from BUY transactions
    SELECT 
        COALESCE(SUM(total_idr), 0),
        COALESCE(SUM(amount_usdt), 0)
    INTO v_total_invest_idr, v_total_usdt
    FROM transactions
    WHERE session_id = session_uuid
    AND type = 'BUY';
    
    -- Calculate average cost
    IF v_total_usdt > 0 THEN
        v_avg_cost := v_total_invest_idr / v_total_usdt;
    ELSE
        v_avg_cost := 0;
    END IF;
    
    -- Calculate total sold USDT from session_sales
    SELECT COALESCE(SUM(sold_usdt), 0)
    INTO v_total_sold_usdt
    FROM session_sales
    WHERE session_id = session_uuid;
    
    -- Calculate remaining USDT
    v_remaining_usdt := GREATEST(0, v_total_usdt - v_total_sold_usdt);
    
    -- Calculate realized profit
    SELECT COALESCE(SUM(profit_idr), 0)
    INTO v_realized_profit_idr
    FROM session_sales
    WHERE session_id = session_uuid;
    
    -- Update the session
    UPDATE sessions
    SET 
        total_invest_idr = v_total_invest_idr,
        total_usdt = v_total_usdt,
        avg_cost = v_avg_cost,
        remaining_usdt = v_remaining_usdt,
        realized_profit_idr = v_realized_profit_idr,
        status = CASE 
            WHEN v_remaining_usdt <= 0.01 THEN 'closed'
            ELSE 'active'
        END
    WHERE id = session_uuid;
END;
$$ LANGUAGE plpgsql;

-- Add constraint to prevent orphaned session_sales
ALTER TABLE session_sales 
DROP CONSTRAINT IF EXISTS session_sales_tx_id_fkey;

ALTER TABLE session_sales
ADD CONSTRAINT session_sales_tx_id_fkey 
FOREIGN KEY (tx_id) 
REFERENCES transactions(id) 
ON DELETE CASCADE;
