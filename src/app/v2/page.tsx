"use client";
import { useEffect, useState } from "react";
import { useSessionStore, computeSessionDashboard } from "@/stores/useSessionStore";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { formatIDR } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { 
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownLeft, 
  Plus, Eye, EyeOff, ChevronRight, Clock, Layers
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/id";

dayjs.extend(relativeTime);
dayjs.locale("id");

export default function V2Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const fetchAllSessions = useSessionStore(s => s.fetchAllSessions);
  const sessions = useSessionStore(s => s.sessions);
  const transactions = useSessionStore(s => s.transactions);
  const s = computeSessionDashboard();
  
  const [hideBalance, setHideBalance] = useState(false);
  const [recentTx, setRecentTx] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchAllSessions();
      const fetchActivities = async () => {
        const { data } = await supabase.rpc("get_recent_activities", { 
          target_user_id: user.id, limit_count: 5 
        });
        if (data) setRecentTx(data);
      };
      fetchActivities();
    }
  }, [user]);

  const activeSessions = sessions.filter(sess => sess.status === "active" || sess.remaining_usdt > 0.00000001);
  const displayTx = recentTx.length > 0 ? recentTx : transactions.slice(0, 5);
  const totalProfit = s.saldoAkhir - s.totalBuy;
  
  // Sisa saldo = total remaining USDT dari sesi aktif, dikonversi ke IDR
  const sisaSaldoIDR = activeSessions.reduce((sum, sess) => {
    const costPerUsdt = sess.avg_cost || sess.price_idr || 0;
    return sum + (sess.remaining_usdt * costPerUsdt);
  }, 0);
  const remainingUSDT = s.capitalUSDT;

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Selamat datang</p>
          <h1 className="text-xl font-bold text-white mt-0.5">
            {user?.email?.split("@")[0] || "Trader"}
          </h1>
        </div>
        <button
          onClick={() => router.push("/v2/transaksi/new")}
          className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30 active:scale-95 transition-transform"
        >
          <Plus className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Balance Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-5 mb-4 shadow-xl shadow-emerald-500/20">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-12 translate-x-12" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
        
        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <span className="text-emerald-100 text-xs font-medium">Profit Bulan Ini</span>
            <button onClick={() => setHideBalance(!hideBalance)} className="p-1">
              {hideBalance ? <EyeOff className="w-4 h-4 text-emerald-200" /> : <Eye className="w-4 h-4 text-emerald-200" />}
            </button>
          </div>
          <p className="text-3xl font-bold text-white mb-4">
            {hideBalance ? "••••••••" : formatIDR(s.monthlyPL)}
          </p>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-200" />
                <span className="text-emerald-100 text-[10px] font-medium">Sisa Saldo</span>
              </div>
              <p className="text-sm font-bold text-white">
                {hideBalance ? "••••" : formatIDR(sisaSaldoIDR)}
              </p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-200" />
                <span className="text-emerald-100 text-[10px] font-medium">Profit Hari Ini</span>
              </div>
              <p className="text-sm font-bold text-white">
                {hideBalance ? "••••" : formatIDR(s.todayPL)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="bg-[#111827] rounded-xl p-3 border border-white/[0.06]">
          <Wallet className="w-4 h-4 text-blue-400 mb-1.5" />
          <p className="text-[10px] text-gray-500 mb-0.5">Sisa USDT</p>
          <p className="text-xs font-bold text-white">{remainingUSDT.toFixed(2)}</p>
        </div>
        <div className="bg-[#111827] rounded-xl p-3 border border-white/[0.06]">
          <Layers className="w-4 h-4 text-purple-400 mb-1.5" />
          <p className="text-[10px] text-gray-500 mb-0.5">Sesi Aktif</p>
          <p className="text-xs font-bold text-white">{activeSessions.length}</p>
        </div>
        <div className="bg-[#111827] rounded-xl p-3 border border-white/[0.06]">
          <TrendingUp className="w-4 h-4 text-emerald-400 mb-1.5" />
          <p className="text-[10px] text-gray-500 mb-0.5">ROI</p>
          <p className="text-xs font-bold text-emerald-400">{s.roi.toFixed(2)}%</p>
        </div>
      </div>

      {/* Monthly Target */}
      {s.targetMonthly > 0 && (
        <div className="bg-[#111827] rounded-xl p-4 border border-white/[0.06] mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-300">Target Bulanan</span>
            <span className="text-xs text-gray-500">{formatIDR(s.monthlyPL)} / {formatIDR(s.targetMonthly)}</span>
          </div>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(100, Math.max(0, s.progress))}%` }}
            />
          </div>
          <p className="text-right text-[10px] text-gray-500 mt-1.5">{s.progress.toFixed(1)}% tercapai</p>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300">Transaksi Terbaru</h2>
          <button 
            onClick={() => router.push("/v2/transaksi")}
            className="text-xs text-emerald-500 font-medium flex items-center gap-0.5"
          >
            Lihat Semua <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2">
          {displayTx.slice(0, 5).map((tx: any, i: number) => {
            const isBuy = (tx.type || tx.direction || "").toString().toUpperCase() === "BUY";
            return (
              <div key={tx.id || i} className="bg-[#111827] rounded-xl p-3.5 border border-white/[0.06] flex items-center gap-3">
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
                    <span className={`text-xs font-bold ${isBuy ? "text-emerald-400" : "text-red-400"}`}>
                      {isBuy ? "BUY" : "SELL"}
                    </span>
                    <span className="text-sm font-bold text-white">{formatIDR(tx.total_idr)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {dayjs(tx.tx_time).fromNow()}
                    </span>
                    <span className="text-[10px] text-gray-500">{tx.amount_usdt?.toFixed(2)} USDT</span>
                  </div>
                </div>
              </div>
            );
          })}

          {displayTx.length === 0 && (
            <div className="text-center py-8 text-gray-600">
              <p className="text-sm">Belum ada transaksi</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => router.push("/v2/transaksi/new")}
          className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3 active:bg-emerald-500/20 transition-colors"
        >
          <Plus className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium text-emerald-400">Transaksi Baru</span>
        </button>
        <button
          onClick={() => router.push("/v2/sessions")}
          className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex items-center gap-3 active:bg-purple-500/20 transition-colors"
        >
          <Layers className="w-5 h-5 text-purple-400" />
          <span className="text-sm font-medium text-purple-400">Lihat Sesi</span>
        </button>
      </div>
    </div>
  );
}
