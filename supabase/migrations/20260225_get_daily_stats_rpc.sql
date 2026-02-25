
-- Function to get daily statistics for a user (buy, sell, profit)
-- This aggregates data on the server side for better performance
CREATE OR REPLACE FUNCTION get_daily_stats(target_user_id UUID, target_year INTEGER)
RETURNS TABLE (
    tx_date DATE,
    buy_amount NUMERIC,
    sell_amount NUMERIC,
    profit_amount NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH daily_buys AS (
        SELECT 
            DATE(tx_time) as d,
            SUM(total_idr) as amount
        FROM transactions
        WHERE user_id = target_user_id 
        AND type = 'BUY'
        AND EXTRACT(YEAR FROM tx_time) = target_year
        GROUP BY DATE(tx_time)
    ),
    daily_sells AS (
        SELECT 
            DATE(tx_time) as d,
            SUM(total_idr) as amount
        FROM transactions
        WHERE user_id = target_user_id 
        AND type = 'SELL'
        AND EXTRACT(YEAR FROM tx_time) = target_year
        GROUP BY DATE(tx_time)
    ),
    daily_profits AS (
        SELECT 
            DATE(ss.created_at) as d,
            SUM(ss.profit_idr) as amount
        FROM session_sales ss
        JOIN sessions s ON ss.session_id = s.id
        WHERE s.user_id = target_user_id
        AND EXTRACT(YEAR FROM ss.created_at) = target_year
        GROUP BY DATE(ss.created_at)
    ),
    all_dates AS (
        SELECT d FROM daily_buys
        UNION
        SELECT d FROM daily_sells
        UNION
        SELECT d FROM daily_profits
    )
    SELECT 
        ad.d as tx_date,
        COALESCE(db.amount, 0) as buy_amount,
        COALESCE(ds.amount, 0) as sell_amount,
        COALESCE(dp.amount, 0) as profit_amount
    FROM all_dates ad
    LEFT JOIN daily_buys db ON ad.d = db.d
    LEFT JOIN daily_sells ds ON ad.d = ds.d
    LEFT JOIN daily_profits dp ON ad.d = dp.d
    ORDER BY ad.d ASC;
END;
$$ LANGUAGE plpgsql;
