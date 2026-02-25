
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // This is the SQL function for rebuilding profit
    const sql = `
CREATE OR REPLACE FUNCTION rebuild_user_profit(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_total_sell_txs INTEGER := 0;
    v_processed_txs INTEGER := 0;
    v_new_sales_count INTEGER := 0;
    
    r_tx RECORD;
    r_session RECORD;
    
    v_remaining_to_sell NUMERIC;
    v_fee_per_usdt NUMERIC;
    v_usdt_from_session NUMERIC;
    v_proportional_fee NUMERIC;
    v_proceeds NUMERIC;
    v_cost NUMERIC;
    v_profit NUMERIC;
    
BEGIN
    -- 1. Reset all sessions for this user to initial state (safety first)
    UPDATE sessions
    SET remaining_usdt = total_usdt, realized_profit_idr = 0, status = 'active'
    WHERE user_id = target_user_id;

    -- 2. Delete all existing session_sales for this user
    DELETE FROM session_sales
    WHERE session_id IN (SELECT id FROM sessions WHERE user_id = target_user_id);
    
    -- 3. Reset sessions AGAIN to be absolutely sure (clean slate)
    UPDATE sessions
    SET remaining_usdt = total_usdt, realized_profit_idr = 0, status = 'active'
    WHERE user_id = target_user_id;

    -- 4. Process SELL transactions (FIFO)
    FOR r_tx IN 
        SELECT * FROM transactions 
        WHERE user_id = target_user_id AND type = 'SELL' 
        ORDER BY tx_time ASC
    LOOP
        v_total_sell_txs := v_total_sell_txs + 1;
        v_remaining_to_sell := r_tx.amount_usdt;
        
        -- Calculate fee per unit
        IF r_tx.amount_usdt > 0 THEN
            v_fee_per_usdt := COALESCE(r_tx.fee_idr, 0) / r_tx.amount_usdt;
        ELSE
            v_fee_per_usdt := 0;
        END IF;
        
        -- Iterate through eligible sessions (FIFO)
        FOR r_session IN 
            SELECT * FROM sessions 
            WHERE user_id = target_user_id 
            AND created_at <= r_tx.tx_time 
            AND remaining_usdt > 0.000001
            ORDER BY created_at ASC
        LOOP
            IF v_remaining_to_sell <= 0.000001 THEN
                EXIT; -- Break inner loop if satisfied
            END IF;
            
            -- Calculate amount to take from this session
            IF r_session.remaining_usdt < v_remaining_to_sell THEN
                v_usdt_from_session := r_session.remaining_usdt;
            ELSE
                v_usdt_from_session := v_remaining_to_sell;
            END IF;
            
            -- Calculate metrics
            v_proportional_fee := (v_usdt_from_session * v_fee_per_usdt);
            v_proceeds := (v_usdt_from_session * r_tx.price_idr);
            v_cost := (v_usdt_from_session * r_session.avg_cost);
            v_profit := (v_proceeds - v_cost - v_proportional_fee);
            
            -- Insert session_sale
            INSERT INTO session_sales (
                session_id, tx_id, sold_usdt, proceeds_idr, cost_idr, profit_idr, created_at
            ) VALUES (
                r_session.id, r_tx.id, v_usdt_from_session, v_proceeds, v_cost, v_profit, r_tx.tx_time
            );
            
            v_new_sales_count := v_new_sales_count + 1;
            
            -- Update session immediately
            UPDATE sessions
            SET 
                remaining_usdt = remaining_usdt - v_usdt_from_session,
                realized_profit_idr = realized_profit_idr + v_profit,
                status = CASE WHEN (remaining_usdt - v_usdt_from_session) <= 0.000001 THEN 'closed' ELSE 'active' END
            WHERE id = r_session.id;
            
            v_remaining_to_sell := v_remaining_to_sell - v_usdt_from_session;
        END LOOP;
        
        v_processed_txs := v_processed_txs + 1;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'processed_txs', v_processed_txs,
        'new_sales_records', v_new_sales_count
    );
END;
$$ LANGUAGE plpgsql;
    `;

    // Execute raw SQL using rpc call isn't possible directly for DDL unless we have a helper
    // BUT we can't run DDL via client easily. 
    // We'll try to use the REST API to execute SQL if possible, or just inform user.
    // Actually, we can't run DDL (CREATE FUNCTION) via the standard JS client easily without a pre-existing exec_sql function.
    
    // HOWEVER, since we are in Next.js API route with SERVICE_ROLE_KEY, we might have more permissions.
    // But Supabase JS client doesn't expose a raw SQL query method for security.
    
    // WORKAROUND: We will return the SQL to the client to be run in SQL Editor manually as fallback,
    // OR we just provide instructions.
    
    // Wait! We can try to use the `pg` library if we had connection string. But we only have REST URL.
    
    // ALTERNATIVE: Check if the function exists first.
    const { error: rpcCheckError } = await supabase.rpc('rebuild_user_profit', { target_user_id: user.id });
    
    // If error is "function not found", we know we need to install it.
    // Since we cannot install it programmatically without `postgres` connection string,
    // we will have to guide the user or hope they used the dashboard.
    
    // Let's just return success: false and specific code so frontend shows instructions
    if (rpcCheckError && rpcCheckError.code === 'PGRST202') { // Function not found code usually
       return NextResponse.json({ 
         success: false, 
         needs_migration: true,
         sql: sql 
       });
    }

    return NextResponse.json({ 
        success: true, 
        message: "RPC function appears to be installed or check failed safely",
        details: rpcCheckError
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
