"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { useSessionStore } from "@/stores/useSessionStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatIDR } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Transaction, SessionSale, ExchangeLabel } from "@/lib/types";
import { 
  ArrowUpRight, ArrowDownLeft, Clock, Search, 
  X, Plus, Filter, ListChecks, Trash2, RefreshCw
} from "lucide-react";
import { deleteTransaction } from "@/lib/transactionService";
import { supabase } from "@/lib/supabaseClient";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/id";

dayjs.extend(relativeTime);
dayjs.locale("id");

type FilterType = "ALL" | "BUY" | "SELL";

export default function V2Transactions() {
  const { user } = useAuth();
  const router = useRouter();
  const fetchAllSessions = useSessionStore(s => s.fetchAllSessions);
  const transactions = useSessionStore(s => s.transactions);
  const sessions = useSessionStore(s => s.sessions);
  const sessionSales = useSessionStore(s => s.sessionSales);
  
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeLabel | 'All'>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  
  // Selection mode
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [hiddenTxIds, setHiddenTxIds] = useState<Set<string>>(new Set());
  const pendingDeleteRef = useRef<{ ids: string[]; timeoutId: ReturnType<typeof setTimeout> } | null>(null);
  
  // Enriched transactions
  const [enrichedTxs, setEnrichedTxs] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAllSessions();
      fetchEnrichedTransactions();
    }
  }, [user]);

  const fetchEnrichedTransactions = async () => {
    setIsLoading(true);
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return;
      const { data, error } = await supabase.rpc('get_recent_activities', { 
        target_user_id: u.id, limit_count: 1000 
      });
      if (!error && data) setEnrichedTxs(data);
    } catch (err) {
      console.error("Error fetching enriched transactions", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Merge enriched + store
  const enrichedIds = new Set(enrichedTxs.map(t => t.id).filter(Boolean));
  const newTxs = transactions.filter(t => t.id && !enrichedIds.has(t.id));
  const allTxs = [...newTxs, ...enrichedTxs].filter(tx => {
    if (!tx.id) return true;
    return !hiddenTxIds.has(tx.id);
  });

  const filtered = useMemo(() => {
    let result = [...allTxs];
    if (filter !== "ALL") result = result.filter(t => t.type === filter);
    if (exchangeFilter !== 'All') result = result.filter(t => t.label === exchangeFilter);
    if (dateFilter) result = result.filter(t => dayjs(t.tx_time).format('YYYY-MM-DD') === dateFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t => 
        t.label?.toLowerCase().includes(q) ||
        t.total_idr.toString().includes(q) ||
        t.amount_usdt.toString().includes(q)
      );
    }
    return result.sort((a, b) => new Date(b.tx_time).getTime() - new Date(a.tx_time).getTime());
  }, [allTxs, filter, exchangeFilter, dateFilter, search]);

  const totalBuy = filtered.filter(t => t.type === "BUY").reduce((s, t) => s + t.total_idr, 0);
  const totalSell = filtered.filter(t => t.type === "SELL").reduce((s, t) => s + t.total_idr, 0);

  // Selection handlers
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedTxIds(new Set());
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedTxIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedTxIds(newSelected);
  };

  const scheduleDelete = (ids: string[]) => {
    const validIds = ids.filter(Boolean);
    if (validIds.length === 0) return;

    if (pendingDeleteRef.current) {
      clearTimeout(pendingDeleteRef.current.timeoutId);
      setHiddenTxIds(prev => {
        const next = new Set(prev);
        for (const id of pendingDeleteRef.current!.ids) next.delete(id);
        return next;
      });
    }

    setHiddenTxIds(prev => {
      const next = new Set(prev);
      for (const id of validIds) next.add(id);
      return next;
    });

    const timeoutId = setTimeout(async () => {
      pendingDeleteRef.current = null;
      for (const id of validIds) {
        try { await deleteTransaction(id); } catch (e) { console.error(e); }
      }
      await fetchAllSessions();
      await fetchEnrichedTransactions();
      setHiddenTxIds(prev => {
        const next = new Set(prev);
        for (const id of validIds) next.delete(id);
        return next;
      });
    }, 4000);

    pendingDeleteRef.current = { ids: validIds, timeoutId };
  };

  const handleBulkDelete = () => {
    if (selectedTxIds.size === 0) return;
    scheduleDelete(Array.from(selectedTxIds));
    setIsSelectionMode(false);
    setSelectedTxIds(new Set());
  };

  const handleRefresh = async () => {
    await fetchAllSessions();
    await fetchEnrichedTransactions();
  };

  const hasActiveFilter = filter !== "ALL" || exchangeFilter !== 'All' || dateFilter !== '';

  // Group by date
  const today = dayjs().startOf('day');
  const yesterday = dayjs().subtract(1, 'day').startOf('day');
  const todayTxs = filtered.filter(t => dayjs(t.tx_time).isSame(today, 'day'));
  const yesterdayTxs = filtered.filter(t => dayjs(t.tx_time).isSame(yesterday, 'day') && !dayjs(t.tx_time).isSame(today, 'day'));
  const olderTxs = filtered.filter(t => !dayjs(t.tx_time).isSame(today, 'day') && !dayjs(t.tx_time).isSame(yesterday, 'day'));

  const renderTx = (tx: any) => {
    const isBuy = (tx.type || "").toUpperCase() === "BUY";
    return (
      <div 
        key={tx.id} 
        onClick={() => {
          if (isSelectionMode && tx.id) {
            toggleSelect(tx.id);
          } else if (!isSelectionMode && tx.session_id) {
            router.push(`/v2/sessions/${tx.session_id}`);
          }
        }}
        className={`bg-[#111827] rounded-xl p-3.5 border flex items-center gap-3 transition-all ${
          isSelectionMode && selectedTxIds.has(tx.id) 
            ? "border-emerald-500/50 bg-emerald-500/5" 
            : "border-white/[0.06]"
        } ${isSelectionMode || tx.session_id ? "cursor-pointer active:bg-white/5" : ""}`}
      >
        {isSelectionMode && (
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
            selectedTxIds.has(tx.id) ? "bg-emerald-500 border-emerald-500" : "border-gray-600"
          }`}>
            {selectedTxIds.has(tx.id) && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        )}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
          isBuy ? "bg-emerald-500/15" : "bg-red-500/15"
        }`}>
          {isBuy 
            ? <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
            : <ArrowUpRight className="w-4 h-4 text-red-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold ${isBuy ? "text-emerald-400" : "text-red-400"}`}>
                {tx.type}
              </span>
              {tx.label && (
                <span className="text-[10px] bg-white/5 text-gray-400 px-1.5 py-0.5 rounded">
                  {tx.label}
                </span>
              )}
            </div>
            <span className="text-sm font-bold text-white">{formatIDR(tx.total_idr)}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {dayjs(tx.tx_time).format("DD MMM HH:mm")}
            </span>
            <div className="text-right">
              <span className="text-[10px] text-gray-500">{tx.amount_usdt?.toFixed(4)} USDT</span>
              <span className="text-[10px] text-gray-600 ml-1.5">@{formatIDR(tx.price_idr)}</span>
            </div>
          </div>
          {tx.profit_idr !== undefined && tx.profit_idr !== 0 && (
            <div className="mt-1">
              <span className={`text-[10px] font-medium ${tx.profit_idr >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                Profit: {formatIDR(tx.profit_idr)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Transaksi</h1>
          <p className="text-xs text-gray-500 mt-0.5">{filtered.length} Riwayat</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-xl transition-all ${
              showFilters || hasActiveFilter
                ? "bg-emerald-500/20 text-emerald-400" 
                : "bg-[#111827] text-gray-500 border border-white/[0.06]"
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={toggleSelectionMode}
            className={`p-2.5 rounded-xl transition-all ${
              isSelectionMode 
                ? "bg-emerald-500 text-white" 
                : "bg-[#111827] text-gray-500 border border-white/[0.06]"
            }`}
          >
            {isSelectionMode ? <X className="w-4 h-4" /> : <ListChecks className="w-4 h-4" />}
          </button>
          <button
            onClick={handleRefresh}
            className="p-2.5 rounded-xl bg-[#111827] text-gray-500 border border-white/[0.06]"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {!isSelectionMode && (
            <button
              onClick={() => router.push("/v2/transaksi/new")}
              className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30 active:scale-95 transition-transform"
            >
              <Plus className="w-5 h-5 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="mb-4 bg-[#111827] rounded-xl p-4 border border-white/[0.06] space-y-3">
          {/* Type Filter */}
          <div>
            <label className="text-[10px] text-gray-500 font-medium mb-1.5 block">Tipe</label>
            <div className="flex gap-1.5 bg-[#0a0e1a] rounded-lg p-1">
              {(["ALL", "BUY", "SELL"] as FilterType[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                    filter === f
                      ? f === "BUY" ? "bg-emerald-500/20 text-emerald-400" 
                        : f === "SELL" ? "bg-red-500/20 text-red-400"
                        : "bg-white/10 text-white"
                      : "text-gray-500"
                  }`}
                >
                  {f === "ALL" ? "Semua" : f}
                </button>
              ))}
            </div>
          </div>

          {/* Date Filter */}
          <div>
            <label className="text-[10px] text-gray-500 font-medium mb-1.5 block">Tanggal</label>
            <div className="relative">
              <input
                type="date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="w-full bg-[#0a0e1a] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              />
              {dateFilter && (
                <button onClick={() => setDateFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-3 h-3 text-gray-500" />
                </button>
              )}
            </div>
          </div>

          {/* Exchange Filter */}
          <div>
            <label className="text-[10px] text-gray-500 font-medium mb-1.5 block">Exchange</label>
            <div className="flex flex-wrap gap-1.5">
              {(['All', 'Binance', 'Bybit', 'OKX', 'Bitget', 'Tokocrypto', 'Other'] as (ExchangeLabel | 'All')[]).map(l => (
                <button
                  key={l}
                  onClick={() => setExchangeFilter(l)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all border ${
                    exchangeFilter === l
                      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                      : 'bg-transparent border-white/[0.06] text-gray-500'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Reset */}
          {hasActiveFilter && (
            <button
              onClick={() => { setFilter("ALL"); setExchangeFilter("All"); setDateFilter(""); }}
              className="text-xs text-emerald-400 font-medium"
            >
              Reset Filter
            </button>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
        <input
          type="text"
          placeholder="Cari transaksi..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-[#111827] border border-white/[0.06] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
          <p className="text-[10px] text-emerald-400/70 mb-0.5">Total Beli</p>
          <p className="text-sm font-bold text-emerald-400">{formatIDR(totalBuy)}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          <p className="text-[10px] text-red-400/70 mb-0.5">Total Jual</p>
          <p className="text-sm font-bold text-red-400">{formatIDR(totalSell)}</p>
        </div>
      </div>

      {/* Transaction List - grouped by date */}
      <div className="space-y-4">
        {todayTxs.length > 0 && (
          <div>
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">Hari Ini</h3>
            <div className="space-y-1.5">
              {todayTxs.map(tx => renderTx(tx))}
            </div>
          </div>
        )}
        {yesterdayTxs.length > 0 && (
          <div>
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">Kemarin</h3>
            <div className="space-y-1.5">
              {yesterdayTxs.map(tx => renderTx(tx))}
            </div>
          </div>
        )}
        {olderTxs.length > 0 && (
          <div>
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">Lebih Lama</h3>
            <div className="space-y-1.5">
              {olderTxs.map(tx => renderTx(tx))}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-600">
            <p className="text-sm">Tidak ada transaksi ditemukan</p>
          </div>
        )}
      </div>

      {/* Floating Delete Button */}
      {isSelectionMode && selectedTxIds.size > 0 && (
        <div className="fixed bottom-24 left-0 right-0 px-4 z-40 flex justify-center">
          <button 
            onClick={handleBulkDelete}
            className="bg-red-600 text-white px-6 py-3 rounded-full shadow-lg shadow-red-600/30 font-semibold flex items-center gap-2 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Hapus {selectedTxIds.size} Transaksi
          </button>
        </div>
      )}
    </div>
  );
}
