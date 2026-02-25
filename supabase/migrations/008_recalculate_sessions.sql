-- Script to recalculate and sync session data
-- This fixes any inconsistencies in session totals

-- Function to recalculate session totals
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

-- Recalculate all sessions for all users
DO $$
DECLARE
    session_record RECORD;
BEGIN
    FOR session_record IN 
        SELECT id FROM sessions
    LOOP
        PERFORM recalculate_session_totals(session_record.id);
    END LOOP;
END $$;

-- Create trigger to auto-recalculate on transaction changes
CREATE OR REPLACE FUNCTION trigger_recalculate_session()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.type = 'BUY' AND OLD.session_id IS NOT NULL THEN
            PERFORM recalculate_session_totals(OLD.session_id);
        END IF;
        RETURN OLD;
    ELSIF TG_OP IN ('INSERT', 'UPDATE') THEN
        IF NEW.type = 'BUY' AND NEW.session_id IS NOT NULL THEN
            PERFORM recalculate_session_totals(NEW.session_id);
        END IF;
        IF TG_OP = 'UPDATE' AND OLD.session_id IS NOT NULL AND OLD.session_id != NEW.session_id THEN
            PERFORM recalculate_session_totals(OLD.session_id);
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS recalculate_session_on_transaction_change ON transactions;

-- Create new trigger
CREATE TRIGGER recalculate_session_on_transaction_change
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW
EXECUTE FUNCTION trigger_recalculate_session();

-- Also trigger on session_sales changes
CREATE OR REPLACE FUNCTION trigger_recalculate_session_from_sales()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM recalculate_session_totals(OLD.session_id);
        RETURN OLD;
    ELSE
        PERFORM recalculate_session_totals(NEW.session_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS recalculate_session_on_sales_change ON session_sales;

CREATE TRIGGER recalculate_session_on_sales_change
AFTER INSERT OR UPDATE OR DELETE ON session_sales
FOR EACH ROW
EXECUTE FUNCTION trigger_recalculate_session_from_sales();
