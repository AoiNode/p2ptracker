"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSessionStore } from "@/stores/useSessionStore";
import PageWrapper from "@/components/PageWrapper";
import EditTransactionModal from "@/components/EditTransactionModal";
import { formatIDR } from "@/lib/utils";
import { Session, Transaction, SessionSale, ExchangeLabel } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import dayjs from "dayjs";

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  
  const sessions = useSessionStore(s => s.sessions);
  const transactions = useSessionStore(s => s.transactions);
  const sessionSales = useSessionStore(s => s.sessionSales);
  const fetchAllSessions = useSessionStore(s => s.fetchAllSessions);
  
  const [session, setSession] = useState<Session | null>(null);
  const [sessionTxs, setSessionTxs] = useState<Transaction[]>([]);
  const [sales, setSales] = useState<SessionSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTransactionId, setDeleteTransactionId] = useState<string | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchAllSessions();
  }, [fetchAllSessions]);

  useEffect(() => {
    const foundSession = sessions.find((s: Session) => s.id === sessionId);
    if (foundSession) {
      setSession(foundSession);
      
      // Get all transactions for this session
      const newSessionTxs = transactions.filter((t: Transaction) => t.session_id === sessionId)
        .sort((a: Transaction, b: Transaction) => new Date(b.tx_time).getTime() - new Date(a.tx_time).getTime());
      setSessionTxs(newSessionTxs);
      
      const sessionSalesData = sessionSales.filter((s: SessionSale) => s.session_id === sessionId);
      setSales(sessionSalesData);
    }
    
    // Stop loading if we have data or if we've attempted to load
    if (sessions.length > 0) {
      setLoading(false);
    }
  }, [sessionId, sessions, transactions, sessionSales]);

  const handleDeleteSession = async () => {
    if (!session) return;
    
    try {
      // Get all session_sales to find related SELL transactions
      const { data: salesData } = await supabase
        .from('session_sales')
        .select('tx_id')
        .eq('session_id', session.id);
      
      // Delete SELL transactions first (not covered by CASCADE)
      // Delete SELL transactions related to this session
      const sellTxIds = salesData?.map((s: any) => s.tx_id) || [];
      if (sellTxIds.length > 0) {
        const { error: sellTxError } = await supabase
          .from('transactions')
          .delete()
          .in('id', sellTxIds);
        
        if (sellTxError) console.error('Error deleting sell transactions:', sellTxError);
      }
      
      // Delete the session itself (this will CASCADE delete BUY transaction and session_sales)
      const { error: deleteError } = await supabase
        .from('sessions')
        .delete()
        .eq('id', session.id);
        
      if (deleteError) throw deleteError;
      
      // Redirect to sessions page after successful deletion
      await fetchAllSessions();
      router.push('/sessions');
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Gagal menghapus sesi');
    } finally {
      setDeleteConfirm(false);
    }
  };
  
  const handleDeleteTransaction = async (txId: string) => {
    if (isDeleting) return; // Prevent double click
    setIsDeleting(true);
    
    try {
      // Get the transaction to be deleted
      const txToDelete = sessionTxs.find((t: Transaction) => t.id === txId) || 
                        transactions.find((t: Transaction) => t.id === txId);
      if (!txToDelete) throw new Error('Transaction not found');
      
      // If it's a SELL transaction, delete the related session_sale first
      if (txToDelete.type === 'SELL') {
        const { error: saleDeleteError } = await supabase
          .from('session_sales')
          .delete()
          .eq('tx_id', txId);
          
        if (saleDeleteError) throw saleDeleteError;
      }
      
      // Delete transaction
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', txId);
        
      if (error) throw error;
      
      // If it's a BUY transaction, need to recalculate FIFO for SELL transactions
      if (txToDelete.type === 'BUY' && session) {
        // Fetch ALL BUY transactions for this session from database (excluding the one being deleted)
        const { data: allBuyTxs, error: fetchBuyError } = await supabase
          .from('transactions')
          .select('*')
          .eq('session_id', session.id)
          .eq('type', 'BUY')
          .neq('id', txId); // Exclude the transaction being deleted
        
        if (fetchBuyError) throw fetchBuyError;
        
        const otherBuyTxs = allBuyTxs || [];
        
        if (otherBuyTxs.length === 0) {
          // This is the last BUY transaction, delete all related SELL transactions
          const { data: relatedSales } = await supabase
            .from('session_sales')
            .select('tx_id')
            .eq('session_id', session.id);
          
          if (relatedSales && relatedSales.length > 0) {
            // Get unique SELL transaction IDs
            const sellTxIds = [...new Set(relatedSales.map((s: any) => s.tx_id))];
            
            // Delete all SELL transactions
            for (const sellTxId of sellTxIds) {
              const { error: deleteSellError } = await supabase
                .from('transactions')
                .delete()
                .eq('id', sellTxId);
                
              if (deleteSellError) console.error('Error deleting related SELL:', deleteSellError);
            }
            
            // Delete all session_sales records
            const { error: deleteSalesError } = await supabase
              .from('session_sales')
              .delete()
              .eq('session_id', session.id);
              
            if (deleteSalesError) console.error('Error deleting session_sales:', deleteSalesError);
          }
        } else {
          // Not the last BUY - need to recalculate FIFO for existing SELLs
          const newTotalBuyUsdt = otherBuyTxs.reduce((sum: number, t: Transaction) => sum + t.amount_usdt, 0);
          
          // Get all SELL transactions for this session
          const { data: relatedSales } = await supabase
            .from('session_sales')
            .select('*')
            .eq('session_id', session.id)
            .order('created_at', { ascending: true });
          
          if (relatedSales && relatedSales.length > 0) {
            const totalSold = relatedSales.reduce((sum: number, s: any) => sum + s.sold_usdt, 0);
            
            if (totalSold > newTotalBuyUsdt) {
              // Need to adjust or delete SELL transactions
              let remainingToDelete = totalSold - newTotalBuyUsdt;
              
              // Delete SELL transactions from newest to oldest until we have enough USDT
              const salesToDelete = [...relatedSales].reverse();
              
              for (const sale of salesToDelete) {
                if (remainingToDelete <= 0) break;
                
                if (sale.sold_usdt <= remainingToDelete) {
                  // Delete this entire SELL transaction
                  await supabase.from('transactions').delete().eq('id', sale.tx_id);
                  await supabase.from('session_sales').delete().eq('id', sale.id);
                  remainingToDelete -= sale.sold_usdt;
                } else {
                  // Partially adjust this SELL transaction
                  const newSoldUsdt = sale.sold_usdt - remainingToDelete;
                  const newProceeds = newSoldUsdt * (sale.proceeds_idr / sale.sold_usdt);
                  const newCost = newSoldUsdt * (sale.cost_idr / sale.sold_usdt);
                  const newProfit = newProceeds - newCost;
                  
                  // Update session_sale
                  await supabase.from('session_sales').update({
                    sold_usdt: newSoldUsdt,
                    proceeds_idr: newProceeds,
                    cost_idr: newCost,
                    profit_idr: newProfit
                  }).eq('id', sale.id);
                  
                  // Update transaction
                  await supabase.from('transactions').update({
                    amount_usdt: newSoldUsdt,
                    total_idr: newProceeds
                  }).eq('id', sale.tx_id);
                  
                  remainingToDelete = 0;
                }
              }
              
              alert(`FIFO Adjusted: Transaksi penjualan telah disesuaikan karena total USDT pembelian berkurang dari ${session.total_usdt.toFixed(2)} menjadi ${newTotalBuyUsdt.toFixed(2)} USDT`);
            }
          }
        }
        // Get ALL BUY transactions for this session from database (excluding deleted one)
        const { data: remainingTxs, error: fetchError } = await supabase
          .from('transactions')
          .select('*')
          .eq('session_id', session.id)
          .eq('type', 'BUY')
          .order('tx_time', { ascending: true });
          
        if (fetchError) throw fetchError;
        
        // Recalculate session totals from scratch
        const newTotalInvest = remainingTxs?.reduce((sum: number, t: any) => sum + t.total_idr, 0) || 0;
        const newTotalUsdt = remainingTxs?.reduce((sum: number, t: any) => sum + t.amount_usdt, 0) || 0;
        const newAvgCost = newTotalUsdt > 0 ? newTotalInvest / newTotalUsdt : 0;
        
        // Get total sold USDT from session_sales
        const { data: salesData } = await supabase
          .from('session_sales')
          .select('sold_usdt')
          .eq('session_id', session.id);
          
        const totalSoldUsdt = salesData?.reduce((sum: number, s: any) => sum + s.sold_usdt, 0) || 0;
        const newRemainingUsdt = Math.max(0, newTotalUsdt - totalSoldUsdt);
        
        // Update session in database
        const { data: updatedSession, error: updateError } = await supabase
          .from('sessions')
          .update({
            total_invest_idr: newTotalInvest,
            total_usdt: newTotalUsdt,
            avg_cost: newAvgCost,
            remaining_usdt: newRemainingUsdt,
            status: newRemainingUsdt <= 0.01 ? 'closed' : 'active'
          })
          .eq('id', session.id)
          .select()
          .single();
          
        if (updateError) throw updateError;
        
        // Update local state immediately with the updated session
        if (updatedSession) {
          setSession(updatedSession);
        }
      } else if (txToDelete.type === 'SELL' && session) {
        // For SELL transaction, the DB trigger will handle session restoration
        // We just need to refresh the local state
        const { data: updatedSession, error: fetchError } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', session.id)
          .single();
          
        if (fetchError) throw fetchError;
        
        if (updatedSession) {
          setSession(updatedSession);
        }
      }
      
      // Refresh all data from store
      await fetchAllSessions();
      
      // Update transactions list
      const { transactions: freshTxs, sessionSales: freshSales } = useSessionStore.getState();
      const updatedTxs = freshTxs.filter((t: Transaction) => t.session_id === sessionId)
        .sort((a: Transaction, b: Transaction) => new Date(b.tx_time).getTime() - new Date(a.tx_time).getTime());
      setSessionTxs(updatedTxs);
      
      const updatedSales = freshSales.filter((s: SessionSale) => s.session_id === sessionId);
      setSales(updatedSales);
      
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Gagal menghapus transaksi. Detail: ' + (error as any).message);
    } finally {
      setIsDeleting(false);
      setDeleteTransactionId(null);
      setTransactionToDelete(null);
    }
  };

  const handleEditTransaction = async (txId: string, price: number, amount: number, fee: number, feeType: 'percent' | 'value', txTime: Date, label?: ExchangeLabel) => {
    try {
      // Calculate total based on transaction type
      const tx = sessionTxs.find((t: Transaction) => t.id === txId) || transactions.find((t: Transaction) => t.id === txId);
      if (!tx) throw new Error('Transaction not found');
      
      // Calculate fee and total based on exchange and transaction type
      const baseTotal = amount * price;
      const feeAmount = feeType === 'percent' ? (baseTotal * fee / 100) : fee;
      
      let total;
      // Tokocrypto BUY: Special calculation - IDR +0.075%
      // All others: Standard fee deduction
      if (tx.type === 'BUY' && label === 'Tokocrypto') {
        const idrIncrease = baseTotal * 0.075 / 100; // 0.075% increase
        total = baseTotal + idrIncrease; // Store total paid
        // Note: USDT will be reduced by 0.0222% in the store
      } else {
        total = baseTotal - feeAmount; // Fee deducted from what you receive
      }
        
      // For SELL, update session_sales if it exists
      if (tx.type === 'SELL') {
        const sale = sessionSales.find((s: SessionSale) => s.tx_id === txId);
        if (sale && sale.session_id) {
          const session = sessions.find((s: Session) => s.id === sale.session_id);
          if (session) {
            const costPerUsdt = session.avg_cost;
            const cost = amount * costPerUsdt;
            // For SELL, fee is always subtracted from proceeds
            const proceeds = amount * price - feeAmount;
            const profit = proceeds - cost;
            
            await supabase
              .from('session_sales')
              .update({
                sold_usdt: amount,
                proceeds_idr: proceeds,
                cost_idr: cost,
                profit_idr: profit
              })
              .eq('tx_id', txId);
          }
        }
      }
      
      // Update transaction
      const { error } = await supabase
        .from('transactions')
        .update({
          price_idr: price,
          amount_usdt: amount,
          total_idr: total,
          tx_time: txTime.toISOString(),
          label: label || 'Binance'
        })
        .eq('id', txId);
      
      if (error) throw error;
      
      // Update session totals if it's a BUY transaction
      if (tx.type === 'BUY' && session) {
        const otherBuyTxs = sessionTxs.filter((t: Transaction) => t.type === 'BUY' && t.id !== txId);
        const newTotalInvest = otherBuyTxs.reduce((sum: number, t: Transaction) => sum + t.total_idr, 0) + total;
        const newTotalUsdt = otherBuyTxs.reduce((sum: number, t: Transaction) => sum + t.amount_usdt, 0) + amount;
        const newAvgPrice = newTotalUsdt > 0 ? newTotalInvest / newTotalUsdt : 0;
        
        await supabase
          .from('sessions')
          .update({
            total_invest_idr: newTotalInvest,
            total_usdt: newTotalUsdt,
            avg_cost: newAvgPrice,
            remaining_usdt: session.remaining_usdt + (amount - (tx.amount_usdt || 0))
          })
          .eq('id', session.id);
      }
      
      // Refresh
      await fetchAllSessions();
      const txs = transactions.filter((t: Transaction) => t.session_id === sessionId);
      setSessionTxs(txs);
      setIsModalOpen(false);
      setEditingTx(null);
    } catch (error) {
      console.error('Error editing transaction:', error);
      alert('Gagal mengedit transaksi');
    }
  };

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-gray-500 dark:text-gray-400 font-medium">Memuat sesi...</div>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex items-center justify-center min-h-screen dark:bg-gray-900">
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-3xl shadow-sm max-w-md w-full mx-4">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔍</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Sesi Tidak Ditemukan</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Sesi yang Anda cari mungkin telah dihapus atau tidak tersedia.</p>
          <Link 
            href="/sessions" 
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors w-full"
          >
            Kembali ke Daftar Sesi
          </Link>
        </div>
      </main>
    );
  }

  const roi = session.total_invest_idr > 0 
    ? (session.realized_profit_idr / session.total_invest_idr) * 100 
    : 0;

  return (
    <PageWrapper>
      <main className="pb-28 px-4 pt-4 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all hover:scale-105"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Detail Sesi</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>#{session.id?.slice(0, 8)}</span>
              <span>•</span>
              <span>{new Date(session.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditMode(!editMode)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                editMode 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {editMode ? 'Selesai' : 'Edit'}
            </button>
            <button
              onClick={() => setDeleteConfirm(true)}
              className="px-4 py-2 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
            >
              Hapus
            </button>
          </div>
        </div>

        {/* Session Summary Card */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${session.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                session.status === 'active' 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {session.status === 'active' ? 'Sesi Aktif' : 'Sesi Selesai'}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Investasi</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{formatIDR(session.total_invest_idr)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total USDT</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{session.total_usdt.toFixed(2)} USDT</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Rata-rata Beli</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{formatIDR(session.avg_cost)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">USDT Tersisa</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{session.remaining_usdt.toFixed(2)} USDT</div>
            </div>
            
            <div className="col-span-2 md:col-span-2 pt-4 border-t border-gray-100 dark:border-gray-700 mt-2">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Realized Profit</div>
                  <div className={`text-2xl font-bold ${session.realized_profit_idr >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatIDR(session.realized_profit_idr)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">ROI</div>
                  <div className={`text-xl font-bold ${roi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {roi.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
              Riwayat Transaksi
            </h2>
            <div className="space-y-3">
              {sessionTxs.map(tx => {
                const sale = sales.find(s => s.tx_id === tx.id);
                
                return (
                  <div key={tx.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow group relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-1 h-full ${
                      tx.type === 'BUY' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    
                    <div className="flex justify-between items-start pl-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg uppercase tracking-wider ${
                            tx.type === 'BUY' 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {tx.type}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                            {dayjs(tx.tx_time).format('DD MMM, HH:mm')}
                          </span>
                        </div>
                        
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500 dark:text-gray-400">Harga</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{formatIDR(tx.price_idr)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500 dark:text-gray-400">Jumlah</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{tx.amount_usdt.toFixed(2)} USDT</span>
                          </div>
                          <div className="flex justify-between items-center text-sm pt-1 border-t border-dashed border-gray-200 dark:border-gray-700 mt-1">
                            <span className="text-gray-500 dark:text-gray-400">Total</span>
                            <span className="font-bold text-gray-900 dark:text-white">{formatIDR(tx.total_idr)}</span>
                          </div>
                          {sale && (
                            <div className="flex justify-between items-center text-sm pt-1 border-t border-dashed border-gray-200 dark:border-gray-700 mt-1">
                              <span className="text-gray-500 dark:text-gray-400">Profit</span>
                              <span className={`font-bold ${sale.profit_idr >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {formatIDR(sale.profit_idr)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {editMode && (
                        <div className="flex flex-col gap-2 ml-4">
                          <button
                            onClick={() => {
                              setEditingTx(tx);
                              setIsModalOpen(true);
                            }}
                            className="p-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-xl transition-colors"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => {
                              setTransactionToDelete(tx);
                              setDeleteTransactionId(tx.id!);
                            }}
                            className="p-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl transition-colors"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {sessionTxs.length === 0 && (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Belum ada transaksi</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Sales History */}
          <div>
            {sales.length > 0 && (
              <>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
                  Detail Penjualan
                </h3>
                <div className="space-y-3">
                  {sales.map(sale => {
                    const tx = transactions.find(t => t.id === sale.tx_id) || sessionTxs.find(t => t.id === sale.tx_id);
                    const saleDate = sale.created_at ? new Date(sale.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 
                                     (tx?.tx_time ? new Date(tx.tx_time).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
                    
                    if (!tx) return null;
                    
                    return (
                      <div key={sale.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
                        
                        <div className="flex justify-between items-start pl-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-bold px-2 py-1 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 uppercase tracking-wider">
                                SOLD
                              </span>
                              <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                                {saleDate}
                              </span>
                            </div>
                            
                            <div className="space-y-1.5">
                              {tx && (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-gray-500 dark:text-gray-400">Harga Jual</span>
                                  <span className="font-semibold text-gray-900 dark:text-white">Rp {tx.price_idr.toLocaleString('id-ID')}</span>
                                </div>
                              )}
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500 dark:text-gray-400">Terjual</span>
                                <span className="font-semibold text-gray-900 dark:text-white">{sale.sold_usdt.toFixed(4)} USDT</span>
                              </div>
                              <div className="flex justify-between items-center text-sm pt-1 border-t border-dashed border-gray-200 dark:border-gray-700 mt-1">
                                <span className="text-gray-500 dark:text-gray-400">Profit Bersih</span>
                                <span className={`font-bold ${sale.profit_idr >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {formatIDR(sale.profit_idr)}
                                  <span className="text-xs ml-1 opacity-75">
                                    ({((sale.profit_idr / sale.cost_idr) * 100).toFixed(2)}%)
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-center justify-center px-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">⚠️</span>
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Hapus Sesi?</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm leading-relaxed">
                Ini akan menghapus sesi beserta semua transaksi yang terkait. Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleDeleteSession}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-500/30"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Transaction Confirmation Modal */}
        {deleteTransactionId && transactionToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-center justify-center px-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">🗑️</span>
              </div>
              <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
                Hapus Transaksi {transactionToDelete.type === 'BUY' ? 'Pembelian' : 'Penjualan'}?
              </h3>
              <div className="mb-4 space-y-2 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl">
                <div className="text-sm text-gray-600 dark:text-gray-300 flex justify-between">
                  <span className="font-medium">Amount:</span> 
                  <span>{transactionToDelete.amount_usdt.toFixed(2)} USDT</span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 flex justify-between">
                  <span className="font-medium">Total:</span> 
                  <span>{formatIDR(transactionToDelete.total_idr)}</span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 flex justify-between">
                  <span className="font-medium">Tanggal:</span> 
                  <span>{dayjs(transactionToDelete.tx_time).format('DD MMM, HH:mm')}</span>
                </div>
              </div>
              
              {transactionToDelete.type === 'BUY' && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400 p-3 rounded-xl mb-6 text-sm">
                  {sessionTxs.filter(t => t.type === 'BUY').length === 1 ? (
                    <>
                      ⚠️ <span className="font-semibold">Perhatian:</span> Ini adalah pembelian terakhir. Menghapusnya akan otomatis menghapus semua penjualan terkait.
                    </>
                  ) : (
                    <>
                      ⚠️ Peringatan: Menghapus transaksi pembelian mungkin mempengaruhi transaksi penjualan yang sudah ada.
                    </>
                  )}
                </div>
              )}
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    if (!isDeleting) {
                      setDeleteTransactionId(null);
                      setTransactionToDelete(null);
                    }
                  }}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={async () => {
                    if (!isDeleting) {
                      await handleDeleteTransaction(deleteTransactionId);
                    }
                  }}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-500/30 disabled:opacity-50"
                >
                  {isDeleting ? 'Menghapus...' : 'Hapus'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Transaction Modal */}
        <EditTransactionModal
          transaction={editingTx}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTx(null);
          }}
          onSave={handleEditTransaction}
        />
      </div>
      </main>
    </PageWrapper>
  );
}
