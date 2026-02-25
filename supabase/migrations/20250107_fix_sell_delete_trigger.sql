-- Fix for SELL transaction deletion: Restore session balances automatically via trigger
-- This handles both single-session and multi-session (Smart Sell) deletions correctly.

-- 1. Create the function to restore session balance when a sale is deleted
CREATE OR REPLACE FUNCTION restore_session_on_sale_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the session linked to this sale
    UPDATE sessions
    SET 
        -- Add back the sold USDT to remaining
        remaining_usdt = remaining_usdt + OLD.sold_usdt,
        -- Subtract the realized profit (since we are cancelling the sale)
        realized_profit_idr = realized_profit_idr - OLD.profit_idr,
        -- Set status to active since we have funds again
        status = 'active'
    WHERE id = OLD.session_id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the trigger on session_sales table
-- It fires AFTER DELETE so we have access to OLD values
DROP TRIGGER IF EXISTS trg_restore_session_on_sale_delete ON session_sales;

CREATE TRIGGER trg_restore_session_on_sale_delete
AFTER DELETE ON session_sales
FOR EACH ROW
EXECUTE FUNCTION restore_session_on_sale_delete();

-- 3. Cleanup conflicting/broken legacy triggers/functions if they exist
-- These were likely from migration 009 or manual edits
DROP TRIGGER IF EXISTS clean_sales_on_sell_delete ON transactions;
DROP FUNCTION IF EXISTS clean_session_sales_on_sell_delete();
