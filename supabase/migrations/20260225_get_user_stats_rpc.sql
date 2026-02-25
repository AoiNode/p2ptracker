
-- Function to get financial summary for a user
-- This runs on DB server, avoiding fetching thousands of rows to client
CREATE OR REPLACE FUNCTION get_user_stats(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_total_profit NUMERIC;
    v_total_sales_volume NUMERIC;
    v_total_buy_volume NUMERIC;
    v_active_capital NUMERIC;
    v_sales_count INTEGER;
BEGIN
    -- Calculate Total Realized Profit & Sales Volume from session_sales
    SELECT 
        COALESCE(SUM(ss.profit_idr), 0), 
        COALESCE(SUM(ss.proceeds_idr), 0),
        COUNT(ss.id)
    INTO v_total_profit, v_total_sales_volume, v_sales_count
    FROM session_sales ss
    JOIN sessions s ON ss.session_id = s.id
    WHERE s.user_id = target_user_id;

    -- Calculate Total Buy Volume and Active Capital from sessions
    SELECT 
        COALESCE(SUM(total_invest_idr), 0),
        COALESCE(SUM(remaining_usdt * avg_cost), 0)
    INTO v_total_buy_volume, v_active_capital
    FROM sessions
    WHERE user_id = target_user_id;

    RETURN jsonb_build_object(
        'total_profit', v_total_profit,
        'total_sales_volume', v_total_sales_volume,
        'sales_count', v_sales_count,
        'total_buy_volume', v_total_buy_volume,
        'active_capital', v_active_capital
    );
END;
$$ LANGUAGE plpgsql;
