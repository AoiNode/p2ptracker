
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Helper types
interface Session {
  id: string;
  created_at: string;
  total_invest_idr: number;
  total_usdt: number;
  avg_cost: number;
  remaining_usdt: number;
  realized_profit_idr: number;
  status: 'active' | 'closed';
  user_id: string;
}

interface Transaction {
  id: string;
  tx_time: string;
  type: 'BUY' | 'SELL';
  price_idr: number;
  amount_usdt: number;
  total_idr: number;
  fee_idr: number;
  session_id?: string;
  user_id: string;
}

interface SessionSale {
  session_id: string;
  tx_id: string;
  sold_usdt: number;
  proceeds_idr: number;
  cost_idr: number;
  profit_idr: number;
  created_at: string;
}

function round2(n: number): number { 
  return Math.round(n * 100) / 100;
}

function round8(n: number): number { 
  return Math.round(n * 1e8) / 1e8;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Get user from auth header or body (assuming called by logged in user)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    console.log(`Starting rebuild for user ${userId}`);

    // 2. Get all sessions for this user
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (sessionsError) throw sessionsError;
    let sessions: Session[] = sessionsData || [];

    // 3. Get all SELL transactions for this user
    const { data: sellTxs, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'SELL')
      .order('tx_time', { ascending: true });

    if (txError) throw txError;

    // 4. Delete existing session_sales for this user's sessions
    // Note: This might trigger 'restore_session_on_sale_delete' but we will override session values anyway
    const sessionIds = sessions.map(s => s.id);
    if (sessionIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('session_sales')
        .delete()
        .in('session_id', sessionIds);
      
      if (deleteError) throw deleteError;
    }

    // 5. Reset sessions to initial state
    // We need to fetch fresh data if trigger modified them, OR just force overwrite
    // Force overwrite is safer here because we know the truth (total_usdt)
    sessions = sessions.map(s => ({
      ...s,
      remaining_usdt: s.total_usdt,
      realized_profit_idr: 0,
      status: 'active'
    }));

    // 6. Replay SELL transactions (FIFO)
    const newSessionSales: SessionSale[] = [];
    const processedTxs: string[] = [];
    const skippedTxs: string[] = [];

    for (const tx of (sellTxs || [])) {
      let remainingToSell = tx.amount_usdt;
      
      // Calculate fee per unit (if any)
      const feePerUsdt = tx.amount_usdt > 0 ? (tx.fee_idr || 0) / tx.amount_usdt : 0;

      // Find eligible sessions (FIFO: created before tx_time and has remaining USDT)
      // Note: We use the in-memory 'sessions' array which is being updated in this loop
      const eligibleSessions = sessions
        .filter(s => 
          new Date(s.created_at) <= new Date(tx.tx_time) && 
          s.remaining_usdt > 0.000001 // floating point tolerance
        );

      if (eligibleSessions.length === 0) {
        console.warn(`No eligible session for SELL tx ${tx.id} (${tx.amount_usdt} USDT)`);
        skippedTxs.push(tx.id);
        continue;
      }

      for (const session of eligibleSessions) {
        if (remainingToSell <= 0.000001) break;

        const usdtFromThisSession = Math.min(remainingToSell, session.remaining_usdt);
        
        // Calculate proportional fee
        const proportionalFee = round2(usdtFromThisSession * feePerUsdt);
        
        // Calculate profit
        const proceeds = round2(usdtFromThisSession * tx.price_idr);
        const cost = round2(usdtFromThisSession * session.avg_cost);
        const profit = round2(proceeds - cost - proportionalFee);

        // Create sale record
        newSessionSales.push({
          session_id: session.id,
          tx_id: tx.id,
          sold_usdt: usdtFromThisSession,
          proceeds_idr: proceeds,
          cost_idr: cost,
          profit_idr: profit,
          created_at: tx.tx_time
        });

        // Update session in memory
        session.remaining_usdt = round8(session.remaining_usdt - usdtFromThisSession);
        session.realized_profit_idr = round2(session.realized_profit_idr + profit);
        
        if (session.remaining_usdt <= 0.000001) {
          session.remaining_usdt = 0;
          session.status = 'closed';
        }

        remainingToSell -= usdtFromThisSession;
      }

      if (remainingToSell > 0.000001) {
        console.warn(`SELL tx ${tx.id} partially unmatched. Remaining: ${remainingToSell}`);
      }
      
      processedTxs.push(tx.id);
    }

    // 7. Bulk Insert new session_sales
    if (newSessionSales.length > 0) {
      const { error: insertError } = await supabase
        .from('session_sales')
        .insert(newSessionSales);
      
      if (insertError) throw insertError;
    }

    // 8. Bulk Update sessions
    // Supabase doesn't support bulk update with different values easily in one query
    // So we loop. Since this is a repair script, performance is secondary to correctness.
    let updatedCount = 0;
    for (const session of sessions) {
      const { error: updateError } = await supabase
        .from('sessions')
        .update({
          remaining_usdt: session.remaining_usdt,
          realized_profit_idr: session.realized_profit_idr,
          status: session.status
        })
        .eq('id', session.id);
      
      if (updateError) {
        console.error(`Failed to update session ${session.id}`, updateError);
      } else {
        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Rebuild complete. Processed ${processedTxs.length} SELL txs. Created ${newSessionSales.length} sales records. Updated ${updatedCount} sessions.`,
      stats: {
        totalSessions: sessions.length,
        totalSellTxs: sellTxs?.length || 0,
        processedTxs: processedTxs.length,
        skippedTxs: skippedTxs.length,
        newSalesRecords: newSessionSales.length
      }
    });

  } catch (error: any) {
    console.error('Rebuild failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
