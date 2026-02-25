import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(req: NextRequest) {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    // Get all transactions count
    const { data: allTxs, count: allTxCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true });
    
    // Get transactions without user_id
    const { data: txsWithoutUser, count: txsWithoutUserCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .is('user_id', null);
    
    // Get current user's transactions
    let userTxCount = 0;
    if (user) {
      const { count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      userTxCount = count || 0;
    }
    
    // Get all sessions count
    const { data: allSessions, count: allSessionCount } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true });
    
    // Get sessions without user_id
    const { data: sessionsWithoutUser, count: sessionsWithoutUserCount } = await supabase
      .from('sessions')
      .select('*', { count: 'exact' })
      .is('user_id', null);
    
    // Get current user's sessions
    let userSessionCount = 0;
    if (user) {
      const { count } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      userSessionCount = count || 0;
    }

    // Get sample of transactions without user
    let sampleTxsWithoutUser = [];
    if (txsWithoutUser && txsWithoutUser.length > 0) {
      sampleTxsWithoutUser = txsWithoutUser.slice(0, 5).map((tx: any) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount_usdt,
        total: tx.total_idr,
        date: tx.tx_time
      }));
    }

    return NextResponse.json({ 
      diagnostics: {
        currentUser: user ? {
          id: user.id,
          email: user.email
        } : null,
        transactions: {
          total: allTxCount || 0,
          withoutUserId: txsWithoutUserCount || 0,
          currentUser: userTxCount,
          notInCurrentUser: (allTxCount || 0) - userTxCount
        },
        sessions: {
          total: allSessionCount || 0,
          withoutUserId: sessionsWithoutUserCount || 0,
          currentUser: userSessionCount,
          notInCurrentUser: (allSessionCount || 0) - userSessionCount
        },
        sampleTransactionsWithoutUser: sampleTxsWithoutUser,
        recommendation: (txsWithoutUserCount || 0) > 0 
          ? "Ada transaksi tanpa user_id. Klik tombol 🔧 untuk memperbaiki."
          : userTxCount < (allTxCount || 0)
          ? "Ada transaksi dengan user_id berbeda. Mungkin data dari user lain."
          : "Semua transaksi sudah terhubung dengan user Anda."
      }
    });

  } catch (error: any) {
    console.error('Error in diagnostics:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
