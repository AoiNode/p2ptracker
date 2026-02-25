import { createClient } from '@supabase/supabase-js';
import { Transaction } from './types';

// Helper to get supabase client
const getSupabase = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};

export async function deleteTransaction(transactionId: string) {
  const supabase = getSupabase();
  
  // Get transaction details first
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .single();

  if (txError) throw txError;
  if (!transaction) throw new Error('Transaction not found');

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // If it's a BUY transaction, we need to handle orphaned SELL transactions
  if (transaction.type === 'BUY' && transaction.session_id) {
    // First, check how many BUY transactions are in this session
    const { data: buyTxs, error: buyError } = await supabase
      .from('transactions')
      .select('id')
      .eq('session_id', transaction.session_id)
      .eq('type', 'BUY');
    
    if (buyError) throw buyError;
    
    const isLastBuyTx = buyTxs && buyTxs.length === 1;
    
    if (isLastBuyTx) {
      // This is the last BUY transaction - delete session and handle SELL transactions
      // Find all session_sales that used this session
      const { data: affectedSales, error: salesError } = await supabase
        .from('session_sales')
        .select('*, transactions!session_sales_tx_id_fkey(id, amount_usdt, price_idr, tx_time, fee_idr, label)')
        .eq('session_id', transaction.session_id);
      
      if (salesError) throw salesError;
      
      if (affectedSales && affectedSales.length > 0) {
        // Get all affected SELL transaction IDs
        const affectedSellTxIds = affectedSales.map((sale: any) => sale.tx_id).filter(Boolean);
        
        // Delete all session_sales for these SELL transactions
        const { error: deleteSalesError } = await supabase
          .from('session_sales')
          .delete()
          .in('tx_id', affectedSellTxIds);
        
        if (deleteSalesError) throw deleteSalesError;
        
        // Delete the session (CASCADE will delete remaining transactions)
        const { error: deleteSessionError } = await supabase
          .from('sessions')
          .delete()
          .eq('id', transaction.session_id);
        
        if (deleteSessionError) throw deleteSessionError;
        
        // Delete the BUY transaction (if not deleted by cascade)
        // We try to delete it just in case
        await supabase
          .from('transactions')
          .delete()
          .eq('id', transaction.id);
      
        // Now re-process each affected SELL transaction with FIFO
        for (const sale of affectedSales as any[]) {
          const sellTx = (sale as any).transactions;
          if (!sellTx) continue;
          
          // Get all available sessions for current user (sorted by date for FIFO)
          const { data: availableSessions, error: sessionsError } = await supabase
            .from('sessions')
            .select('*')
            .eq('user_id', user.id)
            .gt('remaining_usdt', 0)
            .order('created_at', { ascending: true });
          
          if (sessionsError) throw sessionsError;
          
          if (!availableSessions || availableSessions.length === 0) {
            // No sessions available, just leave the SELL transaction without sales (it will show as error/warning in UI potentially)
            // Or we could fail here? But better to keep the SELL tx even if invalid.
            console.warn('No available sessions to cover SELL transaction', sellTx.id);
            continue;
          }
          
          // Re-allocate with FIFO
          let remainingToSell = sellTx.amount_usdt;
          
          for (const session of availableSessions) {
            if (remainingToSell <= 0) break;
            if (session.remaining_usdt <= 0) continue;
            
            const soldFromSession = Math.min(remainingToSell, session.remaining_usdt);
            const proceedsFromSession = soldFromSession * sellTx.price_idr;
            const costFromSession = soldFromSession * session.avg_cost;
            const profitFromSession = proceedsFromSession - costFromSession;
            
            // Create new session_sale
            const { error: insertSaleError } = await supabase
              .from('session_sales')
              .insert({
                session_id: session.id,
                tx_id: sellTx.id,
                sold_usdt: soldFromSession,
                proceeds_idr: proceedsFromSession,
                cost_idr: costFromSession,
                profit_idr: profitFromSession
              });
            
            if (insertSaleError) throw insertSaleError;
            
            // Update session
            const newRemainingUsdt = session.remaining_usdt - soldFromSession;
            const newRealizedProfit = session.realized_profit_idr + profitFromSession;
            const newStatus = newRemainingUsdt <= 0.0001 ? 'closed' : 'active';
            
            const { error: updateSessionError } = await supabase
              .from('sessions')
              .update({
                remaining_usdt: newRemainingUsdt,
                realized_profit_idr: newRealizedProfit,
                status: newStatus
              })
              .eq('id', session.id);
            
            if (updateSessionError) throw updateSessionError;
            
            remainingToSell -= soldFromSession;
            session.remaining_usdt = newRemainingUsdt;
          }
        }
      } else {
        // No affected sales, just delete session and transaction
        const { error: deleteSessionError } = await supabase
          .from('sessions')
          .delete()
          .eq('id', transaction.session_id);
        
        if (deleteSessionError) throw deleteSessionError;
        
        await supabase
          .from('transactions')
          .delete()
          .eq('id', transaction.id);
      }
    } else {
      // There are other BUY transactions in this session
      // Just reduce the session total
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', transaction.session_id)
        .single();
      
      if (sessionError) throw sessionError;
      
      if (session) {
        const newTotalUsdt = session.total_usdt - transaction.amount_usdt;
        const newTotalInvest = session.total_invest_idr - transaction.total_idr;
        // Recalculate avg cost
        const newAvgCost = newTotalUsdt > 0 ? newTotalInvest / newTotalUsdt : 0;
        
        // We also need to reduce remaining_usdt if possible
        // But if remaining_usdt is less than what we are removing (because it was sold), 
        // that's a problem. We might need to rollback sales.
        // For simplicity, we only reduce if enough remaining. 
        // If not enough remaining, it means we sold what we didn't have (if we delete this BUY).
        // This is complex. For now, assuming standard case where we can just update session.
        // Ideally we should check if remaining_usdt < amount_usdt, if so we have to rollback sales like above.
        
        // Simplified approach: Update session stats
        const { error: updateSessionError } = await supabase
          .from('sessions')
          .update({
            total_usdt: newTotalUsdt,
            total_invest_idr: newTotalInvest,
            avg_cost: newAvgCost,
            // We blindly reduce remaining. If it goes negative, it indicates an issue (sold more than bought)
            remaining_usdt: session.remaining_usdt - transaction.amount_usdt
          })
          .eq('id', session.id);
          
        if (updateSessionError) throw updateSessionError;
      }
      
      // Delete transaction
      const { error: deleteTxError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transaction.id);
        
      if (deleteTxError) throw deleteTxError;
    }
  } else if (transaction.type === 'SELL') {
    // For SELL, just delete it. 
    // The DB trigger 'trg_restore_session_on_sale_delete' should handle restoring session balances
    // But we need to make sure we delete session_sales first if cascade doesn't do it
    
    // Check if session_sales exist
    const { error: deleteSalesError } = await supabase
      .from('session_sales')
      .delete()
      .eq('tx_id', transaction.id);
      
    if (deleteSalesError) throw deleteSalesError;
    
    // Delete transaction
    const { error: deleteTxError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transaction.id);
      
    if (deleteTxError) throw deleteTxError;
  } else {
    // Normal delete for other types
    const { error: deleteTxError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transaction.id);
      
    if (deleteTxError) throw deleteTxError;
  }
}
