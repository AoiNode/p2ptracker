-- Secure Transaction Processing RPCs
-- These functions handle transactions atomically to prevent race conditions and data corruption
-- They replace the client-side read-modify-write logic with server-side logic using locking.

-- BUY Transaction RPC
CREATE OR REPLACE FUNCTION process_buy_transaction(
  p_user_id UUID,
  p_price NUMERIC,
  p_amount_usdt NUMERIC,
  p_total_idr NUMERIC,
  p_tx_time TIMESTAMPTZ,
  p_label TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_session_id UUID;
  v_tx_id UUID;
  v_new_total_usdt NUMERIC;
  v_new_total_invest NUMERIC;
BEGIN
  -- Advisory lock for user to serialize transactions
  -- Using a consistent hash of user_id to ensure single-threaded execution per user
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- Check existing session
  SELECT id INTO v_session_id
  FROM sessions
  WHERE user_id = p_user_id
    AND price_idr = p_price
    AND remaining_usdt > 0
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_session_id IS NOT NULL THEN
    -- Update existing session
    UPDATE sessions
    SET total_invest_idr = total_invest_idr + p_total_idr,
        total_usdt = total_usdt + p_amount_usdt,
        remaining_usdt = remaining_usdt + p_amount_usdt,
        avg_cost = (total_invest_idr + p_total_idr) / (total_usdt + p_amount_usdt)
    WHERE id = v_session_id;
  ELSE
    -- Insert new session
    INSERT INTO sessions (user_id, price_idr, total_invest_idr, total_usdt, avg_cost, remaining_usdt, created_at, status)
    VALUES (p_user_id, p_price, p_total_idr, p_amount_usdt, p_price, p_amount_usdt, p_tx_time, 'active')
    RETURNING id INTO v_session_id;
  END IF;

  -- Insert Transaction
  INSERT INTO transactions (user_id, tx_time, type, price_idr, amount_usdt, total_idr, fee_idr, session_id, label)
  VALUES (p_user_id, p_tx_time, 'BUY', p_price, p_amount_usdt, p_total_idr, 0, v_session_id, p_label)
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object('success', true, 'tx_id', v_tx_id, 'session_id', v_session_id);
END;
$$;

-- SELL Transaction RPC
CREATE OR REPLACE FUNCTION process_sell_transaction(
  p_user_id UUID,
  p_price NUMERIC,
  p_sold_usdt NUMERIC,
  p_tx_time TIMESTAMPTZ,
  p_label TEXT,
  p_fee_idr NUMERIC DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_remaining_to_sell NUMERIC := p_sold_usdt;
  v_session RECORD;
  v_deduct NUMERIC;
  v_cost_idr NUMERIC;
  v_proceeds_idr NUMERIC;
  v_profit_idr NUMERIC;
  v_total_profit NUMERIC := 0;
  v_tx_id UUID;
  v_total_available NUMERIC;
  v_chunk_fee NUMERIC;
  v_fee_remaining NUMERIC := p_fee_idr;
BEGIN
  -- Advisory lock for user
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- Check total available
  SELECT SUM(remaining_usdt) INTO v_total_available
  FROM sessions
  WHERE user_id = p_user_id AND (status = 'active' OR remaining_usdt > 0);

  IF COALESCE(v_total_available, 0) < p_sold_usdt THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Insert Transaction
  INSERT INTO transactions (user_id, tx_time, type, price_idr, amount_usdt, total_idr, fee_idr, label)
  VALUES (p_user_id, p_tx_time, 'SELL', p_price, p_sold_usdt, (p_sold_usdt * p_price) - p_fee_idr, p_fee_idr, p_label)
  RETURNING id INTO v_tx_id;

  -- FIFO Loop
  FOR v_session IN 
    SELECT * FROM sessions 
    WHERE user_id = p_user_id AND remaining_usdt > 0 
    ORDER BY created_at ASC 
    FOR UPDATE
  LOOP
    IF v_remaining_to_sell <= 0 THEN
      EXIT;
    END IF;

    IF v_session.remaining_usdt >= v_remaining_to_sell THEN
      v_deduct := v_remaining_to_sell;
    ELSE
      v_deduct := v_session.remaining_usdt;
    END IF;

    -- Calculate stats
    v_cost_idr := ROUND(v_deduct * v_session.avg_cost, 2);
    v_proceeds_idr := ROUND(v_deduct * p_price, 2);
    
    -- Calculate fee for this chunk
    IF v_remaining_to_sell - v_deduct <= 0.00000001 THEN
       -- Last chunk takes all remaining fee
       v_chunk_fee := v_fee_remaining;
    ELSE
       v_chunk_fee := ROUND((v_deduct / p_sold_usdt) * p_fee_idr, 2);
    END IF;
    
    v_profit_idr := v_proceeds_idr - v_cost_idr - v_chunk_fee;
    v_fee_remaining := v_fee_remaining - v_chunk_fee;
    v_total_profit := v_total_profit + v_profit_idr;

    -- Update Session
    UPDATE sessions 
    SET remaining_usdt = ROUND(remaining_usdt - v_deduct, 8),
        realized_profit_idr = realized_profit_idr + v_profit_idr,
        status = CASE WHEN ROUND(remaining_usdt - v_deduct, 8) <= 0 THEN 'closed' ELSE 'active' END
    WHERE id = v_session.id;

    -- Insert Sale Record
    INSERT INTO session_sales (session_id, tx_id, sold_usdt, proceeds_idr, cost_idr, profit_idr)
    VALUES (v_session.id, v_tx_id, v_deduct, v_proceeds_idr, v_cost_idr, v_profit_idr);

    v_remaining_to_sell := ROUND(v_remaining_to_sell - v_deduct, 8);
  END LOOP;

  RETURN jsonb_build_object('success', true, 'tx_id', v_tx_id, 'total_profit', v_total_profit);
END;
$$;
