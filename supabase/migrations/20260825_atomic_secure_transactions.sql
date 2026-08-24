-- Security and consistency hardening for financial writes.
-- API routes authenticate the bearer token, then call these functions with the
-- service-role client. Each function executes in one PostgreSQL transaction.

CREATE OR REPLACE FUNCTION process_buy_transaction_v2(
  p_user_id UUID,
  p_price NUMERIC,
  p_amount_usdt NUMERIC,
  p_total_idr NUMERIC,
  p_tx_time TIMESTAMPTZ,
  p_label TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_tx_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_price <= 0 OR p_amount_usdt <= 0 OR p_total_idr <= 0 OR p_tx_time IS NULL THEN
    RAISE EXCEPTION 'invalid BUY parameters';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  INSERT INTO sessions (
    user_id, created_at, price_idr, total_invest_idr, total_usdt,
    avg_cost, remaining_usdt, realized_profit_idr, status
  ) VALUES (
    p_user_id, p_tx_time, p_price, p_total_idr, p_amount_usdt,
    p_total_idr / p_amount_usdt, p_amount_usdt, 0, 'active'
  ) RETURNING id INTO v_session_id;

  INSERT INTO transactions (
    user_id, tx_time, type, price_idr, amount_usdt, total_idr,
    fee_idr, session_id, label
  ) VALUES (
    p_user_id, p_tx_time, 'BUY', p_price, p_amount_usdt, p_total_idr,
    0, v_session_id, COALESCE(NULLIF(p_label, ''), 'Binance')
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object('success', true, 'tx_id', v_tx_id, 'session_id', v_session_id);
END;
$$;

REVOKE ALL ON FUNCTION process_buy_transaction_v2(UUID, NUMERIC, NUMERIC, NUMERIC, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_buy_transaction_v2(UUID, NUMERIC, NUMERIC, NUMERIC, TIMESTAMPTZ, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION process_sell_transaction_v2(
  p_user_id UUID,
  p_price NUMERIC,
  p_sold_usdt NUMERIC,
  p_tx_time TIMESTAMPTZ,
  p_label TEXT,
  p_fee_idr NUMERIC DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining NUMERIC := p_sold_usdt;
  v_available NUMERIC;
  v_row RECORD;
  v_chunk NUMERIC;
  v_cost NUMERIC;
  v_proceeds NUMERIC;
  v_chunk_fee NUMERIC;
  v_fee_remaining NUMERIC := COALESCE(p_fee_idr, 0);
  v_profit NUMERIC;
  v_total_profit NUMERIC := 0;
  v_tx_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_price <= 0 OR p_sold_usdt <= 0 OR p_tx_time IS NULL OR COALESCE(p_fee_idr, 0) < 0 THEN
    RAISE EXCEPTION 'invalid SELL parameters';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  SELECT COALESCE(SUM(remaining_usdt), 0)
  INTO v_available
  FROM sessions
  WHERE user_id = p_user_id
    AND remaining_usdt > 0.00000001
    AND created_at <= p_tx_time;

  IF v_available + 0.00000001 < p_sold_usdt THEN
    RAISE EXCEPTION 'USDT tidak cukup pada waktu transaksi. Tersedia: %', round(v_available, 4);
  END IF;

  INSERT INTO transactions (
    user_id, tx_time, type, price_idr, amount_usdt, total_idr,
    fee_idr, label
  ) VALUES (
    p_user_id, p_tx_time, 'SELL', p_price, p_sold_usdt,
    (p_sold_usdt * p_price) - COALESCE(p_fee_idr, 0),
    COALESCE(p_fee_idr, 0), COALESCE(NULLIF(p_label, ''), 'Binance')
  ) RETURNING id INTO v_tx_id;

  FOR v_row IN
    SELECT id, avg_cost, remaining_usdt, realized_profit_idr
    FROM sessions
    WHERE user_id = p_user_id
      AND remaining_usdt > 0.00000001
      AND created_at <= p_tx_time
    ORDER BY created_at ASC, id ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0.00000001;
    v_chunk := LEAST(v_remaining, v_row.remaining_usdt);
    v_cost := round(v_chunk * v_row.avg_cost, 2);
    v_proceeds := round(v_chunk * p_price, 2);

    IF v_remaining - v_chunk <= 0.00000001 THEN
      v_chunk_fee := v_fee_remaining;
    ELSE
      v_chunk_fee := round((v_chunk / p_sold_usdt) * COALESCE(p_fee_idr, 0), 2);
    END IF;

    v_fee_remaining := v_fee_remaining - v_chunk_fee;
    v_profit := v_proceeds - v_cost - v_chunk_fee;
    v_total_profit := v_total_profit + v_profit;

    UPDATE sessions
    SET remaining_usdt = round(remaining_usdt - v_chunk, 8),
        realized_profit_idr = realized_profit_idr + v_profit,
        status = CASE WHEN round(remaining_usdt - v_chunk, 8) <= 0.00000001 THEN 'closed' ELSE 'active' END
    WHERE id = v_row.id;

    INSERT INTO session_sales (
      session_id, tx_id, sold_usdt, proceeds_idr, cost_idr,
      profit_idr, created_at
    ) VALUES (
      v_row.id, v_tx_id, v_chunk, v_proceeds, v_cost,
      v_profit, p_tx_time
    );

    v_remaining := round(v_remaining - v_chunk, 8);
  END LOOP;

  IF v_remaining > 0.00000001 THEN
    RAISE EXCEPTION 'FIFO allocation incomplete: % USDT', v_remaining;
  END IF;

  RETURN jsonb_build_object('success', true, 'tx_id', v_tx_id, 'total_profit', v_total_profit);
END;
$$;

REVOKE ALL ON FUNCTION process_sell_transaction_v2(UUID, NUMERIC, NUMERIC, TIMESTAMPTZ, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_sell_transaction_v2(UUID, NUMERIC, NUMERIC, TIMESTAMPTZ, TEXT, NUMERIC) TO service_role;

-- Legacy RPCs remain only as a temporary server-side fallback during rollout.
-- Prevent direct browser calls from bypassing the v2 historical FIFO rules.
DO $$
BEGIN
  IF to_regprocedure('public.process_buy_transaction(uuid,numeric,numeric,numeric,timestamptz,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.process_buy_transaction(UUID, NUMERIC, NUMERIC, NUMERIC, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.process_buy_transaction(UUID, NUMERIC, NUMERIC, NUMERIC, TIMESTAMPTZ, TEXT) TO service_role';
  END IF;
  IF to_regprocedure('public.process_sell_transaction(uuid,numeric,numeric,timestamptz,text,numeric)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.process_sell_transaction(UUID, NUMERIC, NUMERIC, TIMESTAMPTZ, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.process_sell_transaction(UUID, NUMERIC, NUMERIC, TIMESTAMPTZ, TEXT, NUMERIC) TO service_role';
  END IF;
END;
$$;

-- Dashboard aggregate is called directly by authenticated clients. Enforce that
-- callers can only request their own totals; anonymous execution is forbidden.
CREATE OR REPLACE FUNCTION assert_dashboard_owner(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF target_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
END;
$$;

-- Replace dashboard function with an ownership-checked implementation.
CREATE OR REPLACE FUNCTION get_dashboard_totals(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz TEXT := 'Asia/Jakarta';
  v_now_local TIMESTAMP;
  v_day TIMESTAMPTZ;
  v_month TIMESTAMPTZ;
  v_total NUMERIC;
  v_profit NUMERIC;
  v_remaining NUMERIC;
  v_monthly NUMERIC;
  v_today NUMERIC;
BEGIN
  PERFORM assert_dashboard_owner(target_user_id);
  v_now_local := now() AT TIME ZONE v_tz;
  v_day := date_trunc('day', v_now_local) AT TIME ZONE v_tz;
  v_month := date_trunc('month', v_now_local) AT TIME ZONE v_tz;

  SELECT COALESCE(SUM(total_invest_idr),0), COALESCE(SUM(realized_profit_idr),0), COALESCE(SUM(remaining_usdt),0)
  INTO v_total, v_profit, v_remaining FROM sessions WHERE user_id = target_user_id;

  SELECT COALESCE(SUM(ss.profit_idr),0) INTO v_monthly
  FROM session_sales ss JOIN sessions s ON s.id = ss.session_id
  WHERE s.user_id = target_user_id AND ss.created_at >= v_month AND ss.created_at < v_month + interval '1 month';

  SELECT COALESCE(SUM(ss.profit_idr),0) INTO v_today
  FROM session_sales ss JOIN sessions s ON s.id = ss.session_id
  WHERE s.user_id = target_user_id AND ss.created_at >= v_day AND ss.created_at < v_day + interval '1 day';

  RETURN jsonb_build_object(
    'total_invested', v_total,
    'total_realized_profit', v_profit,
    'remaining_usdt', v_remaining,
    'monthly_profit', v_monthly,
    'today_profit', v_today,
    'roi', CASE WHEN v_total > 0 THEN (v_profit / v_total) * 100 ELSE 0 END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION get_dashboard_totals(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_dashboard_totals(UUID) TO authenticated, service_role;

-- Destructive maintenance procedures are only invoked by authenticated API routes
-- through a service-role client. Remove direct browser access entirely.
DO $$
BEGIN
  IF to_regprocedure('public.archive_closed_data_v2(uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.archive_closed_data_v2(UUID) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.archive_closed_data_v2(UUID) TO service_role';
  END IF;
  IF to_regprocedure('public.monthly_close_reset_v1(uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.monthly_close_reset_v1(UUID) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.monthly_close_reset_v1(UUID) TO service_role';
  END IF;
END;
$$;
