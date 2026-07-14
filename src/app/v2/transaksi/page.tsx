"use client";
import { useEffect, useState, useMemo } from "react";
import { useSessionStore } from "@/stores/useSessionStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatIDR } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { 
  ArrowUpRight, ArrowDownLeft, Clock, Search, 
  X, Plus
} from "lucide-react";
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
  
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("ALL");

  useEffect(() => {
    if (user) fetchAllSessions();
  }, [user]);

  const filtered = useMemo(() => {
    let result = [...transactions];
    if (filter !== "ALL") result = result.filter(t => t.type === filter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t => 
        t.label?.toLowerCase().includes(q) ||
        t.total_idr.toString().includes(q) ||
        t.amount_usdt.toString().includes(q)
      );
    }
    return result;
  }, [transactions, filter, search]);

  const totalBuy = filtered.filter(t => t.type === "BUY").reduce((s, t) => s + t.total_idr, 0);
  const totalSell = filtered.filter(t => t.type === "SELL").reduce((s, t) => s + t.total_idr, 0);

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Transaksi</h1>
          <p className="text-xs text-gray-500 mt-0.5">{transactions.length} total transaksi</p>
        </div>
        <button
          onClick={() => router.push("/v2/transaksi/new")}
          className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30 active:scale-95 transition-transform"
        >
          <Plus className="w-5 h-5 text-white" />
        </button>
      </div>

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

      {/* Filter Tabs */}
      <div className="flex gap-1.5 mb-4 bg-[#111827] rounded-xl p-1 border border-white/[0.06]">
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

      {/* Transaction List */}
      <div className="space-y-1.5">
        {filtered.map(tx => {
          const isBuy = tx.type === "BUY";
          return (
            <div key={tx.id} className="bg-[#111827] rounded-xl p-3.5 border border-white/[0.06] flex items-center gap-3">
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
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-600">
            <p className="text-sm">Tidak ada transaksi ditemukan</p>
          </div>
        )}
      </div>
    </div>
  );
}
