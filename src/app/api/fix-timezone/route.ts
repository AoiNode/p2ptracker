import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
  try {
    // Get user_id from request body (sent from client)
    const body = await req.json();
    const { user_id } = body;
    
    if (!user_id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Get transactions that were created after 23:00 (11 PM) but marked as previous day
    // These are likely timezone issues where user created after midnight local time
    const { data: problematicTxs, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user_id)
      .gte('tx_time', '2025-10-19T16:00:00Z') // 23:00 WIB = 16:00 UTC
      .lt('tx_time', '2025-10-20T00:00:00Z'); // Before midnight UTC

    if (fetchError) {
      console.error('Error fetching transactions:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    let fixedCount = 0;
    
    if (problematicTxs && problematicTxs.length > 0) {
      // Fix each transaction by adding 1 day
      for (const tx of problematicTxs) {
        const txDate = new Date(tx.tx_time);
        const hour = txDate.getUTCHours();
        
        // If transaction was after 16:00 UTC (23:00 WIB), it was likely meant for next day
        if (hour >= 16) {
          // Add 1 day to the transaction
          txDate.setDate(txDate.getDate() + 1);
          
          const { error: updateError } = await supabase
            .from('transactions')
            .update({ tx_time: txDate.toISOString() })
            .eq('id', tx.id);

          if (!updateError) {
            fixedCount++;
            console.log(`Fixed transaction ${tx.id}: ${tx.tx_time} -> ${txDate.toISOString()}`);
          } else {
            console.error(`Error updating transaction ${tx.id}:`, updateError);
          }
        }
      }
    }

    // Also check sessions with similar issue
    const { data: problematicSessions, error: sessionFetchError } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user_id)
      .gte('created_at', '2025-10-19T16:00:00Z')
      .lt('created_at', '2025-10-20T00:00:00Z');

    let sessionsFixed = 0;
    
    if (problematicSessions && problematicSessions.length > 0) {
      for (const session of problematicSessions) {
        const sessionDate = new Date(session.created_at);
        const hour = sessionDate.getUTCHours();
        
        if (hour >= 16) {
          sessionDate.setDate(sessionDate.getDate() + 1);
          
          const { error: updateError } = await supabase
            .from('sessions')
            .update({ created_at: sessionDate.toISOString() })
            .eq('id', session.id);

          if (!updateError) {
            sessionsFixed++;
            console.log(`Fixed session ${session.id}`);
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Berhasil memperbaiki ${fixedCount} transaksi dan ${sessionsFixed} sesi dengan timezone issue`,
      transactionsFixed: fixedCount,
      sessionsFixed: sessionsFixed,
      transactionsFound: problematicTxs?.length || 0,
      sessionsFound: problematicSessions?.length || 0,
      details: {
        transactions: problematicTxs?.map((t: any) => ({
          id: t.id,
          old_time: t.tx_time,
          type: t.type,
          amount: t.amount_usdt
        }))
      }
    });

  } catch (error: any) {
    console.error('Error in fix-timezone:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
