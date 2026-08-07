-- Server-side dashboard totals, computed directly from base tables (sessions + session_sales).
--
-- WHY THIS EXISTS:
-- The dashboard/statistik pages historically computed Total Profit, ROI, monthly &
-- today profit on the CLIENT by summing the full sessions / session_sales arrays.
-- That forced the client to download every row and silently under-counted whenever a
-- fetch window clipped old rows. This function moves the aggregation to Postgres so the
-- client only receives final numbers (scales to any data size, cannot "lose" rows).
--
-- TIMEZONE (critical):
-- All date columns are timestamptz (stored UTC). The app is used in WIB (Asia/Jakarta).
-- "Hari ini" / "bulan ini" MUST be bucketed on WIB wall-clock boundaries, otherwise
-- transactions between 00:00-07:00 WIB land in the wrong day/month (this app has a
-- documented history of exactly that bug). We compute WIB day/month boundaries and
-- convert them back to timestamptz for comparison against created_at.
--
-- PARITY:
-- The math mirrors computeSessionDashboard() in the client 1:1 so numbers are identical:
--   total_realized_profit = SUM(sessions.realized_profit_idr)
--   total_invested        = SUM(sessions.total_invest_idr)
--   remaining_usdt        = SUM(sessions.remaining_usdt)
--   monthly_profit        = SUM(session_sales.profit_idr) within current WIB month
--   today_profit          = SUM(session_sales.profit_idr) within current WIB day
--   roi                   = total_realized_profit / total_invested * 100

CREATE OR REPLACE FUNCTION get_dashboard_totals(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tz             TEXT := 'Asia/Jakarta';
    v_now_local      TIMESTAMP;      -- wall-clock time in WIB
    v_start_of_day   TIMESTAMPTZ;
    v_end_of_day     TIMESTAMPTZ;
    v_start_of_month TIMESTAMPTZ;
    v_end_of_month   TIMESTAMPTZ;
    v_total_invested NUMERIC;
    v_total_realized NUMERIC;
    v_remaining_usdt NUMERIC;
    v_monthly_profit NUMERIC;
    v_today_profit   NUMERIC;
    v_roi            NUMERIC;
BEGIN
    -- Build WIB boundaries, then convert back to timestamptz (UTC instants).
    v_now_local      := now() AT TIME ZONE v_tz;
    v_start_of_day   := date_trunc('day',   v_now_local) AT TIME ZONE v_tz;
    v_end_of_day     := v_start_of_day + interval '1 day';
    v_start_of_month := date_trunc('month', v_now_local) AT TIME ZONE v_tz;
    v_end_of_month   := v_start_of_month + interval '1 month';

    -- Session-level totals (all-time; not timezone sensitive).
    SELECT
        COALESCE(SUM(total_invest_idr), 0),
        COALESCE(SUM(realized_profit_idr), 0),
        COALESCE(SUM(remaining_usdt), 0)
    INTO v_total_invested, v_total_realized, v_remaining_usdt
    FROM sessions
    WHERE user_id = target_user_id;

    -- Profit this WIB month.
    SELECT COALESCE(SUM(ss.profit_idr), 0)
    INTO v_monthly_profit
    FROM session_sales ss
    JOIN sessions s ON s.id = ss.session_id
    WHERE s.user_id = target_user_id
      AND ss.created_at >= v_start_of_month
      AND ss.created_at <  v_end_of_month;

    -- Profit today (WIB).
    SELECT COALESCE(SUM(ss.profit_idr), 0)
    INTO v_today_profit
    FROM session_sales ss
    JOIN sessions s ON s.id = ss.session_id
    WHERE s.user_id = target_user_id
      AND ss.created_at >= v_start_of_day
      AND ss.created_at <  v_end_of_day;

    IF v_total_invested > 0 THEN
        v_roi := (v_total_realized / v_total_invested) * 100;
    ELSE
        v_roi := 0;
    END IF;

    RETURN jsonb_build_object(
        'total_invested',        v_total_invested,
        'total_realized_profit', v_total_realized,
        'remaining_usdt',        v_remaining_usdt,
        'monthly_profit',        v_monthly_profit,
        'today_profit',          v_today_profit,
        'roi',                   v_roi
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_totals(UUID) TO authenticated, anon;
