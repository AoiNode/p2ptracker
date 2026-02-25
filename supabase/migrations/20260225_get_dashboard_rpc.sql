
-- Function to get monthly stats for the dashboard (Home)
CREATE OR REPLACE FUNCTION get_monthly_stats(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_monthly_profit NUMERIC;
    v_today_profit NUMERIC;
    v_total_invested NUMERIC;
    v_total_remaining_usdt NUMERIC;
    v_roi NUMERIC;
    v_start_of_month TIMESTAMP;
    v_start_of_day TIMESTAMP;
    v_end_of_day TIMESTAMP;
BEGIN
    v_start_of_month := date_trunc('month', now());
    v_start_of_day := date_trunc('day', now());
    v_end_of_day := v_start_of_day + interval '1 day';

    -- 1. Monthly Profit (Realized)
    SELECT COALESCE(SUM(ss.profit_idr), 0)
    INTO v_monthly_profit
    FROM session_sales ss
    JOIN sessions s ON ss.session_id = s.id
    WHERE s.user_id = target_user_id
    AND ss.created_at >= v_start_of_month;

    -- 2. Today's Profit
    SELECT COALESCE(SUM(ss.profit_idr), 0)
    INTO v_today_profit
    FROM session_sales ss
    JOIN sessions s ON ss.session_id = s.id
    WHERE s.user_id = target_user_id
    AND ss.created_at >= v_start_of_day
    AND ss.created_at < v_end_of_day;

    -- 3. Total Invested (Capital in IDR) & Remaining USDT
    SELECT 
        COALESCE(SUM(total_invest_idr), 0),
        COALESCE(SUM(remaining_usdt), 0)
    INTO v_total_invested, v_total_remaining_usdt
    FROM sessions
    WHERE user_id = target_user_id;

    -- 4. Calculate ROI (Simple: Monthly Profit / Total Invested * 100)
    -- Or maybe Total Profit / Total Invested? Let's use Monthly Profit for Dashboard context
    -- But usually ROI is based on capital. Let's use Total Profit All Time / Total Invested
    -- Actually, dashboard usually shows Monthly ROI.
    IF v_total_invested > 0 THEN
        v_roi := (v_monthly_profit / v_total_invested) * 100;
    ELSE
        v_roi := 0;
    END IF;

    RETURN jsonb_build_object(
        'monthly_profit', v_monthly_profit,
        'today_profit', v_today_profit,
        'total_invested', v_total_invested,
        'remaining_usdt', v_total_remaining_usdt,
        'roi', v_roi
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get recent activities with profit details (Server-side Join)
-- This avoids fetching thousands of session_sales to client just to show "Profit: +Rp 50.000"

-- Drop first because return type changed
DROP FUNCTION IF EXISTS get_recent_activities(uuid, integer);

CREATE OR REPLACE FUNCTION get_recent_activities(target_user_id UUID, limit_count INTEGER DEFAULT 100)
RETURNS TABLE (
    id UUID,
    created_at TIMESTAMPTZ,
    tx_time TIMESTAMPTZ,
    type TEXT,
    price_idr NUMERIC,
    amount_usdt NUMERIC,
    total_idr NUMERIC,
    fee_idr NUMERIC,
    session_id UUID,
    label TEXT,
    profit_idr NUMERIC,
    status TEXT,
    session_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.created_at,
        t.tx_time,
        t.type,
        t.price_idr,
        t.amount_usdt,
        t.total_idr,
        t.fee_idr,
        t.session_id,
        t.label,
        -- Calculate profit for SELL transactions
        CASE 
            WHEN t.type = 'SELL' THEN (
                SELECT COALESCE(SUM(ss.profit_idr), 0)
                FROM session_sales ss
                WHERE ss.tx_id = t.id
            )
            ELSE 0
        END as profit_idr,
        -- Get status for BUY transactions (from session)
        CASE 
            WHEN t.type = 'BUY' THEN (
                SELECT s.status 
                FROM sessions s 
                WHERE s.id = t.session_id
            )
            ELSE 'completed'
        END as status,
        -- Count how many sessions involved in SELL
        CASE
            WHEN t.type = 'SELL' THEN (
                SELECT COUNT(DISTINCT ss.session_id)
                FROM session_sales ss
                WHERE ss.tx_id = t.id
            )
            ELSE 0
        END as session_count
    FROM transactions t
    WHERE t.user_id = target_user_id
    ORDER BY t.tx_time DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
