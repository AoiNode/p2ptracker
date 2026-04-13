CREATE TABLE IF NOT EXISTS monthly_profit_summaries (
    user_id UUID NOT NULL,
    month_key DATE NOT NULL,
    month_start DATE NOT NULL,
    month_end DATE NOT NULL,
    total_profit_idr NUMERIC NOT NULL DEFAULT 0,
    total_buy_idr NUMERIC NOT NULL DEFAULT 0,
    total_sell_idr NUMERIC NOT NULL DEFAULT 0,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    sell_count INTEGER NOT NULL DEFAULT 0,
    is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
    finalized_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, month_key)
);

CREATE INDEX IF NOT EXISTS idx_monthly_profit_summaries_user_month
ON monthly_profit_summaries(user_id, month_key DESC);

CREATE OR REPLACE FUNCTION refresh_monthly_profit_summary(
    target_user_id UUID,
    target_month DATE,
    force_refresh BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_month_start DATE;
    v_month_end DATE;
    v_is_finalized BOOLEAN := FALSE;
    v_total_profit NUMERIC := 0;
    v_total_buy NUMERIC := 0;
    v_total_sell NUMERIC := 0;
    v_transaction_count INTEGER := 0;
    v_sell_count INTEGER := 0;
BEGIN
    IF target_month IS NULL THEN
        RETURN;
    END IF;

    v_month_start := date_trunc('month', target_month)::date;
    v_month_end := (date_trunc('month', target_month) + interval '1 month - 1 day')::date;

    SELECT is_finalized
    INTO v_is_finalized
    FROM monthly_profit_summaries
    WHERE user_id = target_user_id
      AND month_key = v_month_start;

    IF COALESCE(v_is_finalized, FALSE) = TRUE AND force_refresh = FALSE THEN
        RETURN;
    END IF;

    SELECT
        COALESCE(SUM(ss.profit_idr), 0),
        COUNT(ss.id)
    INTO v_total_profit, v_sell_count
    FROM session_sales ss
    JOIN sessions s ON s.id = ss.session_id
    WHERE s.user_id = target_user_id
      AND ss.created_at >= v_month_start::timestamp
      AND ss.created_at < (v_month_start + interval '1 month')::timestamp;

    SELECT
        COALESCE(SUM(CASE WHEN type = 'BUY' THEN total_idr ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'SELL' THEN total_idr ELSE 0 END), 0),
        COUNT(*)
    INTO v_total_buy, v_total_sell, v_transaction_count
    FROM transactions
    WHERE user_id = target_user_id
      AND tx_time >= v_month_start::timestamp
      AND tx_time < (v_month_start + interval '1 month')::timestamp;

    INSERT INTO monthly_profit_summaries (
        user_id,
        month_key,
        month_start,
        month_end,
        total_profit_idr,
        total_buy_idr,
        total_sell_idr,
        transaction_count,
        sell_count,
        is_finalized,
        finalized_at,
        updated_at
    ) VALUES (
        target_user_id,
        v_month_start,
        v_month_start,
        v_month_end,
        v_total_profit,
        v_total_buy,
        v_total_sell,
        v_transaction_count,
        v_sell_count,
        COALESCE(v_is_finalized, FALSE),
        CASE WHEN COALESCE(v_is_finalized, FALSE) THEN COALESCE((SELECT finalized_at FROM monthly_profit_summaries WHERE user_id = target_user_id AND month_key = v_month_start), now()) ELSE NULL END,
        now()
    )
    ON CONFLICT (user_id, month_key)
    DO UPDATE SET
        month_start = EXCLUDED.month_start,
        month_end = EXCLUDED.month_end,
        total_profit_idr = EXCLUDED.total_profit_idr,
        total_buy_idr = EXCLUDED.total_buy_idr,
        total_sell_idr = EXCLUDED.total_sell_idr,
        transaction_count = EXCLUDED.transaction_count,
        sell_count = EXCLUDED.sell_count,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION refresh_all_open_monthly_profit_summaries(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT DISTINCT month_key
        FROM (
            SELECT date_trunc('month', tx_time)::date AS month_key
            FROM transactions
            WHERE user_id = target_user_id
            UNION
            SELECT date_trunc('month', ss.created_at)::date AS month_key
            FROM session_sales ss
            JOIN sessions s ON s.id = ss.session_id
            WHERE s.user_id = target_user_id
        ) q
    LOOP
        PERFORM refresh_monthly_profit_summary(target_user_id, r.month_key, FALSE);
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION finalize_monthly_profit_summaries(target_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR r IN
        SELECT DISTINCT month_key
        FROM (
            SELECT date_trunc('month', tx_time)::date AS month_key
            FROM transactions
            WHERE user_id = target_user_id
            UNION
            SELECT date_trunc('month', ss.created_at)::date AS month_key
            FROM session_sales ss
            JOIN sessions s ON s.id = ss.session_id
            WHERE s.user_id = target_user_id
        ) q
    LOOP
        PERFORM refresh_monthly_profit_summary(target_user_id, r.month_key, TRUE);

        INSERT INTO monthly_profit_summaries (
            user_id, month_key, month_start, month_end, is_finalized, finalized_at, updated_at
        ) VALUES (
            target_user_id,
            r.month_key,
            r.month_key,
            (date_trunc('month', r.month_key) + interval '1 month - 1 day')::date,
            TRUE,
            now(),
            now()
        )
        ON CONFLICT (user_id, month_key)
        DO UPDATE SET
            is_finalized = TRUE,
            finalized_at = COALESCE(monthly_profit_summaries.finalized_at, now()),
            updated_at = now();

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_refresh_monthly_summary_from_transactions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM refresh_monthly_profit_summary(OLD.user_id, OLD.tx_time::date, FALSE);
        RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' THEN
        PERFORM refresh_monthly_profit_summary(NEW.user_id, NEW.tx_time::date, FALSE);
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        PERFORM refresh_monthly_profit_summary(COALESCE(OLD.user_id, NEW.user_id), OLD.tx_time::date, FALSE);
        PERFORM refresh_monthly_profit_summary(NEW.user_id, NEW.tx_time::date, FALSE);
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_monthly_summary_transactions ON transactions;
CREATE TRIGGER trg_refresh_monthly_summary_transactions
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW
EXECUTE FUNCTION trigger_refresh_monthly_summary_from_transactions();

CREATE OR REPLACE FUNCTION trigger_refresh_monthly_summary_from_sales()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_month_date DATE;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_month_date := OLD.created_at::date;
        SELECT COALESCE(t.user_id, s.user_id)
        INTO v_user_id
        FROM sessions s
        FULL OUTER JOIN transactions t ON t.id = OLD.tx_id
        WHERE s.id = OLD.session_id OR t.id = OLD.tx_id
        LIMIT 1;

        IF v_user_id IS NOT NULL THEN
            PERFORM refresh_monthly_profit_summary(v_user_id, v_month_date, FALSE);
        END IF;
        RETURN OLD;
    END IF;

    v_month_date := NEW.created_at::date;
    SELECT COALESCE(t.user_id, s.user_id)
    INTO v_user_id
    FROM sessions s
    FULL OUTER JOIN transactions t ON t.id = NEW.tx_id
    WHERE s.id = NEW.session_id OR t.id = NEW.tx_id
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        PERFORM refresh_monthly_profit_summary(v_user_id, v_month_date, FALSE);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_monthly_summary_sales ON session_sales;
CREATE TRIGGER trg_refresh_monthly_summary_sales
AFTER INSERT OR UPDATE OR DELETE ON session_sales
FOR EACH ROW
EXECUTE FUNCTION trigger_refresh_monthly_summary_from_sales();

CREATE OR REPLACE FUNCTION get_monthly_profit_history(target_user_id UUID, target_year INTEGER DEFAULT NULL)
RETURNS TABLE (
    month_key DATE,
    month_start DATE,
    month_end DATE,
    total_profit_idr NUMERIC,
    total_buy_idr NUMERIC,
    total_sell_idr NUMERIC,
    transaction_count INTEGER,
    sell_count INTEGER,
    is_finalized BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM refresh_all_open_monthly_profit_summaries(target_user_id);

    RETURN QUERY
    SELECT
        mps.month_key,
        mps.month_start,
        mps.month_end,
        mps.total_profit_idr,
        mps.total_buy_idr,
        mps.total_sell_idr,
        mps.transaction_count,
        mps.sell_count,
        mps.is_finalized
    FROM monthly_profit_summaries mps
    WHERE mps.user_id = target_user_id
      AND (target_year IS NULL OR EXTRACT(YEAR FROM mps.month_key) = target_year)
    ORDER BY mps.month_key ASC;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_stats(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_profit NUMERIC;
    v_total_sales_volume NUMERIC;
    v_total_buy_volume NUMERIC;
    v_active_capital NUMERIC;
    v_sales_count INTEGER;
BEGIN
    PERFORM refresh_all_open_monthly_profit_summaries(target_user_id);

    SELECT
        COALESCE(SUM(total_profit_idr), 0),
        COALESCE(SUM(total_sell_idr), 0),
        COALESCE(SUM(total_buy_idr), 0),
        COALESCE(SUM(sell_count), 0)
    INTO v_total_profit, v_total_sales_volume, v_total_buy_volume, v_sales_count
    FROM monthly_profit_summaries
    WHERE user_id = target_user_id;

    SELECT COALESCE(SUM(remaining_usdt * avg_cost), 0)
    INTO v_active_capital
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
$$;

CREATE OR REPLACE FUNCTION get_monthly_stats(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_monthly_profit NUMERIC;
    v_today_profit NUMERIC;
    v_total_invested NUMERIC;
    v_total_remaining_usdt NUMERIC;
    v_roi NUMERIC;
    v_start_of_month DATE;
    v_start_of_day TIMESTAMP;
    v_end_of_day TIMESTAMP;
BEGIN
    v_start_of_month := date_trunc('month', now())::date;
    v_start_of_day := date_trunc('day', now());
    v_end_of_day := v_start_of_day + interval '1 day';

    PERFORM refresh_monthly_profit_summary(target_user_id, v_start_of_month, FALSE);

    SELECT COALESCE(total_profit_idr, 0)
    INTO v_monthly_profit
    FROM monthly_profit_summaries
    WHERE user_id = target_user_id
      AND month_key = v_start_of_month;

    SELECT COALESCE(SUM(ss.profit_idr), 0)
    INTO v_today_profit
    FROM session_sales ss
    JOIN sessions s ON ss.session_id = s.id
    WHERE s.user_id = target_user_id
      AND ss.created_at >= v_start_of_day
      AND ss.created_at < v_end_of_day;

    SELECT
        COALESCE(SUM(total_invest_idr), 0),
        COALESCE(SUM(remaining_usdt), 0)
    INTO v_total_invested, v_total_remaining_usdt
    FROM sessions
    WHERE user_id = target_user_id;

    IF v_total_invested > 0 THEN
        v_roi := (v_monthly_profit / v_total_invested) * 100;
    ELSE
        v_roi := 0;
    END IF;

    RETURN jsonb_build_object(
        'monthly_profit', COALESCE(v_monthly_profit, 0),
        'today_profit', COALESCE(v_today_profit, 0),
        'total_invested', v_total_invested,
        'remaining_usdt', v_total_remaining_usdt,
        'roi', v_roi
    );
END;
$$;

CREATE OR REPLACE FUNCTION monthly_close_reset_v1(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
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
$$;
