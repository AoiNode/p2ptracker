"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PageWrapper from "@/components/PageWrapper";
import { useSessionStore } from "@/stores/useSessionStore";
import { formatIDR } from "@/lib/utils";
import { Transaction, Session, SessionSale, ExchangeLabel } from "@/lib/types";
import dayjs from "dayjs";
import { RefreshCw, ChevronRight, Trash2, ListChecks, X, Filter, Calendar, Search } from "lucide-react";
import { Toast, useToast } from "@/components/Toast";
import TransactionDetailPopup from "@/components/TransactionDetailPopup";
import { deleteTransaction } from "@/lib/transactionService";
import { supabase } from "@/lib/supabaseClient";

export default function TransaksiPage() {
  const router = useRouter();
  const storeTxs = useSessionStore(s => s.transactions); // Rename to storeTxs
  const sessions = useSessionStore(s => s.sessions);
  const sessionSales = useSessionStore(s => s.sessionSales);
  const fetchAllSessions = useSessionStore(s => s.fetchAllSessions);
  
  // Local state for enriched transactions
  const [enrichedTxs, setEnrichedTxs] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Use enrichedTxs if available, otherwise fallback to storeTxs
  // We need to merge them because enrichedTxs might be limited (e.g. recent 100)
  // while storeTxs has everything but no profit details.
  // Actually, let's try to fetch ALL enriched txs using the RPC with high limit.
  const txs = enrichedTxs.length > 0 ? enrichedTxs : storeTxs;

  // REMOVE DUPLICATE useEffect and fetchEnrichedTransactions here since I moved them up
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAllSessions();
    await fetchEnrichedTransactions();
    setIsRefreshing(false);
  };
  
  // Filters
  const [selectedFilter, setSelectedFilter] = useState<ExchangeLabel | 'All'>('All');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  
  const [showDetailPopup, setShowDetailPopup] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const { toasts, showToast } = useToast();
  
  // Selection Mode State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [hiddenTxIds, setHiddenTxIds] = useState<Set<string>>(new Set());
  const pendingDeleteRef = useRef<{ ids: string[]; timeoutId: ReturnType<typeof setTimeout> } | null>(null);

  useEffect(() => {
    fetchAllSessions();
    fetchEnrichedTransactions();
  }, []);

  const fetchEnrichedTransactions = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch up to 1000 recent transactions with profit details
      const { data, error } = await supabase.rpc('get_recent_activities', { 
        target_user_id: user.id,
        limit_count: 1000 
      });

      if (!error && data) {
        setEnrichedTxs(data);
      } else {
        console.error("Failed to fetch enriched transactions", error);
        // Show silent error to console, but maybe warn user if it's not a connection issue?
        // Actually, if this fails, we just fallback to storeTxs.
        // But let's log it clearly.
      }
    } catch (err) {
      console.error("Error fetching enriched transactions", err);
    } finally {
      setIsLoading(false);
    }
  };

  const undoPendingDelete = () => {
    const pending = pendingDeleteRef.current;
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    pendingDeleteRef.current = null;
    setHiddenTxIds(prev => {
      const next = new Set(prev);
      for (const id of pending.ids) next.delete(id);
      return next;
    });
    showToast({ message: 'Penghapusan dibatalkan', type: 'info' });
  };

  const scheduleDelete = (ids: string[]) => {
    const validIds = ids.filter(Boolean);
    if (validIds.length === 0) return;

    if (pendingDeleteRef.current) {
      undoPendingDelete();
    }

    setHiddenTxIds(prev => {
      const next = new Set(prev);
      for (const id of validIds) next.add(id);
      return next;
    });

    showToast({
      message: validIds.length === 1 ? 'Transaksi akan dihapus' : `${validIds.length} transaksi akan dihapus`,
      type: 'info',
      duration: 6000,
      actionLabel: 'Undo',
      onAction: undoPendingDelete
    });

    const timeoutId = setTimeout(async () => {
      pendingDeleteRef.current = null;
      let successCount = 0;
      let failCount = 0;
      const failedIds: string[] = [];

      for (const id of validIds) {
        try {
          await deleteTransaction(id);
          successCount++;
          showToast({
            message: `Menghapus ${successCount} dari ${validIds.length} transaksi`,
            type: 'info',
            duration: 1200
          });
        } catch (error) {
          console.error(`Failed to delete transaction ${id}:`, error);
          failCount++;
          failedIds.push(id);
        }
      }

      try {
        await fetchAllSessions();
      } finally {
        setHiddenTxIds(prev => {
          const next = new Set(prev);
          for (const id of validIds) next.delete(id);
          for (const id of failedIds) next.delete(id);
          return next;
        });
      }

      if (failCount === 0) {
        showToast({ message: validIds.length === 1 ? 'Transaksi berhasil dihapus' : `Berhasil menghapus ${successCount} transaksi`, type: 'success' });
      } else {
        showToast({ message: `Berhasil: ${successCount}, Gagal: ${failCount}`, type: 'info' });
      }
    }, 6000);

    pendingDeleteRef.current = { ids: validIds, timeoutId };
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedTxIds(new Set());
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedTxIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTxIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedTxIds.size === 0) return;
    
    if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedTxIds.size} transaksi terpilih? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    setIsDeleting(false);
    scheduleDelete(Array.from(selectedTxIds));
    setIsSelectionMode(false);
    setSelectedTxIds(new Set());
  };

  useEffect(() => { 
    import("dayjs/locale/id").then(() => {
      dayjs.locale('id');
    });
    
    fetchAllSessions();
  }, [fetchAllSessions]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAllSessions();
    }, 30000); 
    return () => clearInterval(interval);
  }, [fetchAllSessions]);
  
  // Filter transactions
  let filteredTxs = selectedFilter === 'All' 
    ? txs 
    : txs.filter(tx => tx.label === selectedFilter);
  
  if (typeFilter !== 'ALL') {
    filteredTxs = filteredTxs.filter(tx => tx.type === typeFilter);
  }

  if (dateFilter) {
    filteredTxs = filteredTxs.filter(tx => dayjs(tx.tx_time).format('YYYY-MM-DD') === dateFilter);
  }

  filteredTxs = filteredTxs.filter(tx => {
    if (!tx.id) return true;
    return !hiddenTxIds.has(tx.id);
  });
  
  // Sort transactions by date (newest first)
  const sortedTxs = [...filteredTxs].sort((a, b) => {
    const dateA = new Date(a.tx_time).getTime();
    const dateB = new Date(b.tx_time).getTime();
    return dateB - dateA;
  });
  
  // Group transactions
  const now = dayjs();
  const today = now.startOf('day');
  const yesterday = now.subtract(1, 'day').startOf('day');
  const tomorrow = now.add(1, 'day').startOf('day');
  
  const isToday = (t: Transaction) => {
    const txDate = dayjs(t.tx_time);
    if (txDate.isSame(today, 'day')) return true;
    if (t.type === 'BUY' && t.session_id) {
      const session = sessions.find(s => s.id === t.session_id);
      if (session && dayjs(session.created_at).isSame(today, 'day')) return true;
    }
    if (t.type === 'SELL' && t.id) {
      const relatedSales = sessionSales.filter(ss => ss.tx_id === t.id);
      if (relatedSales.some(sale => sale.created_at && dayjs(sale.created_at).isSame(today, 'day'))) return true;
    }
    if (t.created_at && dayjs(t.created_at).isSame(today, 'day')) return true;
    return false;
  };
  
  const isYesterday = (t: Transaction) => {
    const txDate = dayjs(t.tx_time);
    return txDate.isSame(yesterday, 'day') && !isToday(t);
  };
  
  const futureTxs = sortedTxs.filter(t => {
    const txDate = dayjs(t.tx_time);
    return txDate.isAfter(tomorrow.endOf('day')) && !isToday(t);
  });
  
  const todayTxs = sortedTxs.filter(isToday);
  const yesterdayTxs = sortedTxs.filter(isYesterday);
  const olderTxs = sortedTxs.filter(t => !isToday(t) && !isYesterday(t) && !futureTxs.includes(t));

  return (
    <PageWrapper>
      <main className="pb-28 px-4 pt-4 dark:bg-gray-900 min-h-screen">
        {toasts.map(toast => (
          <Toast key={toast.id} {...toast} />
        ))}
        
        {/* Header */}
        <div className="mb-6 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md py-3 z-30 -mx-4 px-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Transaksi</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {sortedTxs.length} Riwayat
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2.5 rounded-xl transition-all ${
                showFilters || dateFilter || typeFilter !== 'ALL' || selectedFilter !== 'All'
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' 
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Filter size={20} />
            </button>
            <button
              onClick={toggleSelectionMode}
              className={`p-2.5 rounded-xl transition-all ${
                isSelectionMode 
                  ? 'bg-purple-600 text-white shadow-purple-200 shadow-lg' 
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {isSelectionMode ? <X size={20} /> : <ListChecks size={20} />}
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all disabled:opacity-50"
            >
              <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 animate-in slide-in-from-top-2 fade-in duration-200">
            <div className="space-y-4">
              {/* Type Filter */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">Tipe Transaksi</label>
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl w-full">
                  <button
                    onClick={() => setTypeFilter('ALL')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                      typeFilter === 'ALL'
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => setTypeFilter('BUY')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                      typeFilter === 'BUY'
                        ? 'bg-white dark:bg-gray-600 text-red-600 dark:text-red-400 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    Beli
                  </button>
                  <button
                    onClick={() => setTypeFilter('SELL')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                      typeFilter === 'SELL'
                        ? 'bg-white dark:bg-gray-600 text-green-600 dark:text-green-400 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    Jual
                  </button>
                </div>
              </div>

              {/* Date Filter */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">Tanggal</label>
                <div className="relative">
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-700 border-none rounded-xl text-sm px-4 py-2.5 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                  {dateFilter && (
                    <button 
                      onClick={() => setDateFilter('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Exchange Filter */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">Exchange</label>
                <div className="flex flex-wrap gap-2">
                  {(['All', 'Binance', 'Bybit', 'OKX', 'Bitget', 'Tokocrypto', 'Other'] as (ExchangeLabel | 'All')[]).map(label => (
                    <button
                      key={label}
                      onClick={() => setSelectedFilter(label)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        selectedFilter === label
                          ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300'
                          : 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transaction List */}
        <div className="space-y-6">
          {sortedTxs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-600">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <Search size={24} />
              </div>
              <p className="text-sm">Tidak ada transaksi ditemukan</p>
              {(dateFilter || typeFilter !== 'ALL' || selectedFilter !== 'All') && (
                <button 
                  onClick={() => {
                    setDateFilter('');
                    setTypeFilter('ALL');
                    setSelectedFilter('All');
                  }}
                  className="mt-2 text-purple-600 dark:text-purple-400 text-xs font-medium hover:underline"
                >
                  Reset Filter
                </button>
              )}
            </div>
          ) : (
            <>
              {dateFilter ? (
                // Flat list when filtered by date
                <div className="space-y-3">
                  {sortedTxs.map(t => renderTransaction(t, sessions, sessionSales, router, setSelectedTransaction, setShowDetailPopup, isSelectionMode, selectedTxIds, toggleSelect))}
                </div>
              ) : (
                // Grouped list
                <>
                  {futureTxs.length > 0 && (
                    <section>
                      <h3 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-3 px-1">Masa Depan</h3>
                      <div className="space-y-3">
                        {futureTxs.map(t => renderTransaction(t, sessions, sessionSales, router, setSelectedTransaction, setShowDetailPopup, isSelectionMode, selectedTxIds, toggleSelect))}
                      </div>
                    </section>
                  )}
                  
                  {todayTxs.length > 0 && (
                    <section>
                      <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">Hari Ini</h3>
                      <div className="space-y-3">
                        {todayTxs.map(t => renderTransaction(t, sessions, sessionSales, router, setSelectedTransaction, setShowDetailPopup, isSelectionMode, selectedTxIds, toggleSelect))}
                      </div>
                    </section>
                  )}
                  
                  {yesterdayTxs.length > 0 && (
                    <section>
                      <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">Kemarin</h3>
                      <div className="space-y-3">
                        {yesterdayTxs.map(t => renderTransaction(t, sessions, sessionSales, router, setSelectedTransaction, setShowDetailPopup, isSelectionMode, selectedTxIds, toggleSelect))}
                      </div>
                    </section>
                  )}
                  
                  {olderTxs.length > 0 && (
                    <section>
                      <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">Lebih Lama</h3>
                      <div className="space-y-3">
                        {olderTxs.map(t => renderTransaction(t, sessions, sessionSales, router, setSelectedTransaction, setShowDetailPopup, isSelectionMode, selectedTxIds, toggleSelect))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
      
      {/* Floating Delete Button */}
      {isSelectionMode && selectedTxIds.size > 0 && (
        <div className="fixed bottom-24 left-0 right-0 px-4 z-40 flex justify-center animate-in slide-in-from-bottom-4 fade-in duration-300">
          <button 
            onClick={handleBulkDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full shadow-lg shadow-red-600/30 font-semibold flex items-center gap-2 transition-all transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <RefreshCw className="animate-spin" size={20} />
                Menghapus...
              </>
            ) : (
              <>
                <Trash2 size={20} />
                Hapus {selectedTxIds.size} Transaksi
              </>
            )}
          </button>
        </div>
      )}

      {/* Transaction Detail Popup */}
      <TransactionDetailPopup
        show={showDetailPopup}
        transaction={selectedTransaction}
        onClose={() => {
          setShowDetailPopup(false);
          setSelectedTransaction(null);
        }}
        onDeleteRequest={(tx) => {
          if (!tx.id) return;
          setShowDetailPopup(false);
          setSelectedTransaction(null);
          scheduleDelete([tx.id]);
        }}
        onEdit={async (id, price, amount, fee, feeType, txTime, label) => {
          try {
            const { supabase } = await import('@/lib/supabaseClient');
            
            if (!selectedTransaction) throw new Error('No transaction selected');
            
            const baseTotal = amount * price;
            let total = baseTotal;
            
            if (selectedTransaction.type === 'BUY' && label === 'Tokocrypto') {
              total = baseTotal * 1.00075;
            } else {
              const feeAmount = feeType === 'percent' ? (baseTotal * fee / 100) : fee;
              total = baseTotal - feeAmount;
            }
            
            const feeIdr = fee > 0 ? (feeType === 'percent' ? (baseTotal * fee / 100) : fee) : 0;
            
            if (selectedTransaction.type === 'SELL') {
              const { data: oldSales, error: salesError } = await supabase
                .from('session_sales')
                .select('*')
                .eq('tx_id', id);
              
              if (salesError) throw salesError;
              
              if (oldSales && oldSales.length > 0) {
                const { error: deleteSalesError } = await supabase
                  .from('session_sales')
                  .delete()
                  .eq('tx_id', id);
                
                if (deleteSalesError) throw deleteSalesError;
                
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('User not authenticated');
                
                const { data: availableSessions, error: sessionsError } = await supabase
                  .from('sessions')
                  .select('*')
                  .eq('user_id', user.id)
                  .gt('remaining_usdt', 0)
                  .order('created_at', { ascending: true });
                
                if (sessionsError) throw sessionsError;
                
                if (!availableSessions || availableSessions.length === 0) {
                  throw new Error('Tidak ada sesi tersedia untuk transaksi SELL');
                }
                
                let remainingToSell = amount;
                
                for (const session of availableSessions) {
                  if (remainingToSell <= 0) break;
                  if (session.remaining_usdt <= 0) continue;
                  
                  const soldFromSession = Math.min(remainingToSell, session.remaining_usdt);
                  const proceedsFromSession = soldFromSession * price;
                  const costFromSession = soldFromSession * session.avg_cost;
                  const profitFromSession = proceedsFromSession - costFromSession;
                  
                  const { error: insertSaleError } = await supabase
                    .from('session_sales')
                    .insert({
                      session_id: session.id,
                      tx_id: id,
                      sold_usdt: soldFromSession,
                      proceeds_idr: proceedsFromSession,
                      cost_idr: costFromSession,
                      profit_idr: profitFromSession
                    });
                  
                  if (insertSaleError) throw insertSaleError;
                  
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
                
                if (remainingToSell > 0.0001) {
                  throw new Error(`Tidak cukup USDT di sesi. Kurang: ${remainingToSell.toFixed(4)} USDT`);
                }
              }
            } else if (selectedTransaction.type === 'BUY' && selectedTransaction.session_id) {
              const { data: session, error: sessionError } = await supabase
                .from('sessions')
                .select('*')
                .eq('id', selectedTransaction.session_id)
                .single();
              
              if (sessionError) throw sessionError;
              
              if (session) {
                const oldAmount = selectedTransaction.amount_usdt;
                const oldTotal = selectedTransaction.total_idr;
                const amountDiff = amount - oldAmount;
                const totalDiff = total - oldTotal;
                
                const newTotalUsdt = session.total_usdt + amountDiff;
                const newRemainingUsdt = session.remaining_usdt + amountDiff;
                const newTotalInvest = session.total_invest_idr + totalDiff;
                const newAvgCost = newTotalUsdt > 0 ? newTotalInvest / newTotalUsdt : price;
                
                const { error: updateSessionError } = await supabase
                  .from('sessions')
                  .update({
                    price_idr: price,
                    total_usdt: newTotalUsdt,
                    remaining_usdt: newRemainingUsdt,
                    total_invest_idr: newTotalInvest,
                    avg_cost: newAvgCost
                  })
                  .eq('id', selectedTransaction.session_id);
                
                if (updateSessionError) throw updateSessionError;
              }
            }
            
            const { error } = await supabase
              .from('transactions')
              .update({
                price_idr: price,
                amount_usdt: amount,
                total_idr: total,
                fee_idr: feeIdr,
                tx_time: txTime.toISOString(),
                label: label || 'Binance'
              })
              .eq('id', id);
            
            if (error) throw error;
            
            await fetchAllSessions();
            showToast({ message: 'Transaksi berhasil diupdate', type: 'success' });
          } catch (error) {
            console.error('Error updating transaction:', error);
            showToast({ message: 'Gagal mengupdate transaksi: ' + (error as Error).message, type: 'error' });
          }
        }}
      />
    </PageWrapper>
  );
}

function renderTransaction(
  t: Transaction, 
  sessions: Session[], 
  sessionSales: SessionSale[], 
  router: any,
  setSelectedTransaction: (tx: Transaction) => void,
  setShowDetailPopup: (show: boolean) => void,
  isSelectionMode: boolean,
  selectedTxIds: Set<string>,
  toggleSelect: (id: string) => void
) {
  let salesDetails: any[] = [];
  
  // Date check for potential session mismatch
  const hasDateMismatch = t.session_id && sessions.find(s => s.id === t.session_id) && 
                         dayjs(t.tx_time).format('YYYY-MM-DD') !== dayjs(sessions.find(s => s.id === t.session_id)?.created_at).format('YYYY-MM-DD');

  let sessionInfo = null;

  if (t.type === 'BUY') {
    // 1. Try to find session by t.session_id
    let session = sessions.find(s => s.id === t.session_id);
    
    // 2. If no session_id, try to find by price and time (fallback for legacy or broken links)
    if (!session) {
      session = sessions.find(s => 
        Math.abs(s.price_idr - t.price_idr) < 1 && 
        Math.abs(new Date(s.created_at).getTime() - new Date(t.tx_time).getTime()) < 5000
      );
    }

    if (session) {
      sessionInfo = `Sisa: ${session.remaining_usdt.toFixed(2)} USDT`;
    } else {
      // 3. Last fallback: if it's a BUY and we can't find the session, it's likely a data sync issue
      sessionInfo = `Sisa: Data tidak sinkron`;
    }
  } else if (t.type === 'SELL' && t.id) {
    let totalProfit = 0;
    let totalCost = 0;
    let hasSummary = false;

    // 1. Try to use enriched data from RPC (Server-side source of truth)
    if (t.profit_idr !== undefined) {
      totalProfit = t.profit_idr;
      totalCost = t.total_idr - totalProfit;
      hasSummary = true;
      
      // If we have detailed session breakdown from RPC, use it
      if (t.session_details && t.session_details.length > 0) {
        salesDetails = t.session_details.map(detail => ({
          sessionDate: dayjs(detail.session_date).format('DD MMM'),
          sessionDateRaw: new Date(detail.session_date),
          usdt: detail.sold_usdt,
          profit: detail.profit_idr,
          cost: detail.cost_idr,
          avgCost: detail.avg_cost
        }));
      }
    }
    
    // 2. Fallback to local data only if salesDetails is empty
    const allSalesForTx = sessionSales.filter(ss => ss.tx_id === t.id);
    
    // If no RPC data, calculate from local sales
    if (!hasSummary && allSalesForTx.length > 0) {
      totalProfit = allSalesForTx.reduce((sum, sale) => sum + sale.profit_idr, 0);
      totalCost = allSalesForTx.reduce((sum, sale) => sum + sale.cost_idr, 0);
      hasSummary = true;
    }

    if (hasSummary) {
      const profitPercent = totalCost > 0 ? (totalProfit / totalCost * 100).toFixed(2) : '0';
      sessionInfo = `Profit: ${formatIDR(totalProfit)} (${profitPercent}%)`;
      if (t.session_count && t.session_count > 0) {
        sessionInfo += ` • ${t.session_count} Sesi`;
      }
    }
    
    // Populate details if local data exists AND we haven't populated it from RPC yet
    if (salesDetails.length === 0 && allSalesForTx.length > 0) {
      salesDetails = allSalesForTx.map(sale => {
        const session = sessions.find(s => s.id === sale.session_id);
        const sessionDate = session ? new Date(session.created_at) : new Date();
        return {
          sessionDate: dayjs(sessionDate).format('DD MMM'),
          sessionDateRaw: sessionDate,
          usdt: sale.sold_usdt,
          profit: sale.profit_idr,
          cost: sale.cost_idr,
          avgCost: session?.avg_cost || 0
        };
      }).sort((a, b) => a.sessionDateRaw.getTime() - b.sessionDateRaw.getTime());
    }
  }
  
  return (
    <div 
      key={t.id} 
      className={`relative bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 transition-all active:scale-[0.99] ${
        isSelectionMode && selectedTxIds.has(t.id!) ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/10' : ''
      }`}
      onClick={() => {
        if (isSelectionMode) {
          toggleSelect(t.id!);
        } else {
          setSelectedTransaction(t);
          setShowDetailPopup(true);
        }
      }}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox for selection mode */}
        {isSelectionMode && (
          <div className={`mt-1 w-5 h-5 min-w-[1.25rem] rounded-full border-2 flex items-center justify-center transition-all ${
            selectedTxIds.has(t.id!) 
              ? 'bg-purple-600 border-purple-600' 
              : 'border-gray-300 dark:border-gray-600'
          }`}>
            {selectedTxIds.has(t.id!) && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
          </div>
        )}
        
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${t.type === 'BUY' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {t.type === 'BUY' ? 'Beli' : 'Jual'}
              </span>
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500">•</span>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate max-w-[80px]">
                {t.label || 'Unknown'}
              </span>
            </div>
            <span className={`text-sm font-bold tracking-tight ${t.type === 'BUY' ? 'text-gray-900 dark:text-white' : 'text-green-600 dark:text-green-400'}`}>
              {t.type === 'BUY' ? '-' : '+'}{formatIDR(t.total_idr)}
            </span>
          </div>
          
          <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <span>{dayjs(t.tx_time).format('HH:mm')}</span>
              {hasDateMismatch && <span className="text-yellow-600 text-[10px]">⚠️ Date Mismatch</span>}
            </div>
            <div className="flex items-center gap-1 font-mono">
              <span>{t.amount_usdt.toFixed(2)} USDT</span>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>@{t.price_idr.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Session/Profit Info */}
          <div className="mt-2 flex flex-col gap-2">
            {sessionInfo && (
              <div className={`text-xs py-1 px-2 rounded-lg inline-block self-start ${
                t.type === 'BUY' 
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' 
                  : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
              }`}>
                {sessionInfo}
              </div>
            )}
            
            {/* FIFO Details for SELL */}
            {salesDetails.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2 space-y-1.5 w-full">
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Sumber Aset (FIFO)</p>
                {salesDetails.map((detail, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[10px] text-gray-600 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 last:border-0 pb-1 last:pb-0">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                      <span>Beli {detail.sessionDate}</span>
                    </div>
                    <div className="flex flex-col items-end">
                       <span className="font-mono">{detail.usdt.toFixed(2)} USDT <span className="text-gray-300 dark:text-gray-600">@</span> {detail.avgCost.toLocaleString('id-ID')}</span>
                       <span className={`${detail.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                         {detail.profit >= 0 ? '+' : ''}{formatIDR(detail.profit)}
                       </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
