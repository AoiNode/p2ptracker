
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
      console.error('Rebuild failed: Missing Authorization header');
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      console.error('Rebuild failed: Auth error', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    console.log(`Starting rebuild for user ${userId}`);

    // OPTIMIZATION: Try to use RPC function if available (runs entirely on DB)
    try {
      console.log('Attempting to use RPC rebuild_user_profit...');
      const { data: rpcData, error: rpcError } = await supabase.rpc('rebuild_user_profit', {
        target_user_id: userId
      });

      if (!rpcError) {
        console.log('RPC rebuild successful:', rpcData);
        return NextResponse.json({
          success: true,
          message: 'Rebuild complete (via RPC)',
          stats: {
            processedTxs: rpcData.processed_txs || 0,
            newSalesRecords: rpcData.new_sales_records || 0,
            method: 'rpc'
          }
        });
      } else {
        console.warn('RPC function not found or failed, falling back to JS implementation:', rpcError.message);
      }
    } catch (e) {
      console.warn('RPC attempt failed:', e);
    }

    // FALLBACK: JS Implementation (Optimized with Batching)
    console.log('Starting JS fallback rebuild...');

    // 2. Get all sessions for this user
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (sessionsError) {
      console.error('Rebuild failed: Error fetching sessions', sessionsError);
      throw sessionsError;
    }
    let sessions: Session[] = sessionsData || [];
    console.log(`Fetched ${sessions.length} sessions`);

    // 3. Get all SELL transactions for this user
    const { data: sellTxs, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'SELL')
      .order('tx_time', { ascending: true });

    if (txError) {
      console.error('Rebuild failed: Error fetching transactions', txError);
      throw txError;
    }
    console.log(`Fetched ${sellTxs?.length} SELL transactions`);

    // 4. Delete existing session_sales for this user's sessions
    // Note: This might trigger 'restore_session_on_sale_delete' but we will override session values anyway
    const sessionIds = sessions.map(s => s.id);
    if (sessionIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('session_sales')
        .delete()
        .in('session_id', sessionIds);
      
      if (deleteError) {
        console.error('Rebuild failed: Error deleting old sales', deleteError);
        throw deleteError;
      }
    }
    console.log('Cleared existing session_sales');

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
      console.log(`Inserting ${newSessionSales.length} sales records...`);
      const { error: insertError } = await supabase
        .from('session_sales')
        .insert(newSessionSales);
      
      if (insertError) {
        console.error('Rebuild failed: Error inserting sales', insertError);
        throw insertError;
      }
    }

    // 8. Bulk Update sessions
    // Attempt upsert first, if fails fallback to loop update
    if (sessions.length > 0) {
      console.log(`Updating ${sessions.length} sessions...`);
      try {
        const { error: updateError } = await supabase
          .from('sessions')
          .upsert(
            sessions.map(s => ({
              id: s.id,
              remaining_usdt: s.remaining_usdt,
              realized_profit_idr: s.realized_profit_idr,
              status: s.status,
              user_id: s.user_id,
              total_invest_idr: s.total_invest_idr,
              total_usdt: s.total_usdt,
              avg_cost: s.avg_cost,
              created_at: s.created_at
            }))
          );
        
        if (updateError) throw updateError;
        console.log('Session bulk update successful');
      } catch (upsertError) {
        console.warn('Bulk upsert failed, falling back to sequential update:', upsertError);
        
        // Fallback: Sequential update
        let updatedCount = 0;
        for (const session of sessions) {
          const { error: seqError } = await supabase
            .from('sessions')
            .update({
              remaining_usdt: session.remaining_usdt,
              realized_profit_idr: session.realized_profit_idr,
              status: session.status
            })
            .eq('id', session.id);
            
          if (seqError) {
             console.error(`Failed to update session ${session.id}`, seqError);
          } else {
             updatedCount++;
          }
        }
        console.log(`Sequential update finished. Updated ${updatedCount}/${sessions.length} sessions.`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Rebuild complete. Processed ${processedTxs.length} SELL txs. Created ${newSessionSales.length} sales records. Updated ${sessions.length} sessions.`,
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
