"use client";
import { useEffect, useState, useMemo } from "react";
import { useSessionStore, computeSessionDashboard } from "@/stores/useSessionStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatIDR } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { 
  BarChart3, TrendingUp, TrendingDown, Calendar, 
  ArrowUpRight, ArrowDownLeft, Wallet, Download
} from "lucide-react";
import dayjs from "dayjs";

export default function V2Stats() {
  const { user } = useAuth();
  const fetchAllSessions = useSessionStore(s => s.fetchAllSessions);
  const transactions = useSessionStore(s => s.transactions);
  const sessionSales = useSessionStore(s => s.sessionSales);
  const s = computeSessionDashboard();

  // Monthly summary state
  const [monthlyHistory, setMonthlyHistory] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedSummaryMonth, setSelectedSummaryMonth] = useState<string>("all");
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  useEffect(() => {
    if (user) fetchAllSessions();
  }, [user]);

  // Fetch monthly history
  useEffect(() => {
    const fetchMonthlyHistory = async () => {
      try {
        const { data: { user: u } } = await supabase.auth.getUser();
        if (!u) return;
        const { data, error } = await supabase.rpc('get_monthly_profit_history', {
          target_user_id: u.id, target_year: null
        });
        if (!error && data) setMonthlyHistory(data);
      } catch (e) {
        console.error("Error fetching monthly history:", e);
      }
    };
    fetchMonthlyHistory();
  }, []);

  // Available years
  const availableYears = useMemo(() => {
    return Array.from(new Set([
      ...transactions.map(t => new Date(t.tx_time).getFullYear()),
      ...sessionSales.filter(s => s.created_at).map(s => new Date(s.created_at!).getFullYear()),
      ...monthlyHistory.map(m => new Date(m.month_key).getFullYear()),
      new Date().getFullYear()
    ])).sort((a, b) => b - a);
  }, [transactions, sessionSales, monthlyHistory]);

  // Filtered monthly history
  const monthlyHistoryForYear = useMemo(() => {
    return monthlyHistory
      .filter(m => new Date(m.month_key).getFullYear() === selectedYear)
      .filter(m => selectedSummaryMonth === "all" || new Date(m.month_key).getMonth() === Number(selectedSummaryMonth))
      .sort((a, b) => new Date(a.month_key).getTime() - new Date(b.month_key).getTime());
  }, [monthlyHistory, selectedYear, selectedSummaryMonth]);

  // Monthly breakdown
  const monthlyData = useMemo(() => {
    const months: Record<string, { buy: number; sell: number; profit: number; txCount: number }> = {};
    
    transactions.forEach(t => {
      const key = dayjs(t.tx_time).format("YYYY-MM");
      if (!months[key]) months[key] = { buy: 0, sell: 0, profit: 0, txCount: 0 };
      months[key].txCount++;
      if (t.type === "BUY") months[key].buy += t.total_idr;
      else months[key].sell += t.total_idr;
    });

    sessionSales.forEach(sale => {
      const key = dayjs(sale.created_at).format("YYYY-MM");
      if (!months[key]) months[key] = { buy: 0, sell: 0, profit: 0, txCount: 0 };
      months[key].profit += sale.profit_idr;
    });

    return Object.entries(months)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6);
  }, [transactions, sessionSales]);

  // Daily profit (last 7 days)
  const dailyProfit = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = dayjs().subtract(i, "day").format("YYYY-MM-DD");
      days[d] = 0;
    }
    sessionSales.forEach(sale => {
      const d = dayjs(sale.created_at).format("YYYY-MM-DD");
      if (d in days) days[d] += sale.profit_idr;
    });
    return Object.entries(days);
  }, [sessionSales]);

  const maxDailyProfit = Math.max(...dailyProfit.map(([, v]) => Math.abs(v)), 1);

  // Top exchanges
  const exchangeStats = useMemo(() => {
    const stats: Record<string, { count: number; volume: number }> = {};
    transactions.forEach(t => {
      const label = t.label || "Other";
      if (!stats[label]) stats[label] = { count: 0, volume: 0 };
      stats[label].count++;
      stats[label].volume += t.total_idr;
    });
    return Object.entries(stats).sort(([, a], [, b]) => b.volume - a.volume);
  }, [transactions]);

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Statistik</h1>
        <p className="text-xs text-gray-500 mt-0.5">Analisa performa trading</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        <div className="bg-[#111827] rounded-xl p-4 border border-white/[0.06]">
          <TrendingUp className="w-5 h-5 text-emerald-400 mb-2" />
          <p className="text-[10px] text-gray-500 mb-0.5">Total Profit</p>
          <p className="text-sm font-bold text-emerald-400">{formatIDR(s.saldoAkhir - s.totalBuy)}</p>
        </div>
        <div className="bg-[#111827] rounded-xl p-4 border border-white/[0.06]">
          <Wallet className="w-5 h-5 text-blue-400 mb-2" />
          <p className="text-[10px] text-gray-500 mb-1">Total Beli / Jual</p>
          <p className="text-xs font-bold text-emerald-400 mb-0.5">{formatIDR(s.totalBuy)}</p>
          <p className="text-xs font-bold text-red-400">{formatIDR(transactions.filter(t => t.type === 'SELL').reduce((acc, t) => acc + t.total_idr, 0))}</p>
        </div>
        <div className="bg-[#111827] rounded-xl p-4 border border-white/[0.06]">
          <BarChart3 className="w-5 h-5 text-purple-400 mb-2" />
          <p className="text-[10px] text-gray-500 mb-0.5">ROI</p>
          <p className="text-sm font-bold text-purple-400">{s.roi.toFixed(2)}%</p>
        </div>
        <div className="bg-[#111827] rounded-xl p-4 border border-white/[0.06]">
          <Calendar className="w-5 h-5 text-amber-400 mb-2" />
          <p className="text-[10px] text-gray-500 mb-0.5">Transaksi</p>
          <p className="text-sm font-bold text-white">{transactions.length}</p>
        </div>
      </div>

      {/* Daily Profit Chart (Last 7 Days) */}
      <div className="bg-[#111827] rounded-xl p-4 border border-white/[0.06] mb-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Profit 7 Hari Terakhir</h3>
        <div className="flex items-end gap-1.5 h-32">
          {dailyProfit.map(([date, profit]) => {
            const height = Math.max(4, (Math.abs(profit) / maxDailyProfit) * 100);
            const isPositive = profit >= 0;
            return (
              <div key={date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center" style={{ height: "100px" }}>
                  <div 
                    className={`w-full rounded-t-md transition-all duration-500 ${
                      isPositive ? "bg-emerald-500/60" : "bg-red-500/60"
                    }`}
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className="text-[8px] text-gray-600">{dayjs(date).format("dd")}</span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[10px] text-gray-600">Hari ini: {formatIDR(s.todayPL)}</span>
          <span className="text-[10px] text-gray-600">Bulan: {formatIDR(s.monthlyPL)}</span>
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div className="bg-[#111827] rounded-xl p-4 border border-white/[0.06] mb-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Rincian Bulanan</h3>
        <div className="space-y-3">
          {monthlyData.map(([month, data]) => (
            <div key={month} className="flex items-center gap-3">
              <div className="w-16">
                <p className="text-xs font-bold text-gray-300">{dayjs(month + "-01").format("MMM YY")}</p>
                <p className="text-[10px] text-gray-600">{data.txCount} tx</p>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <ArrowDownLeft className="w-3 h-3 text-emerald-500" />
                  <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500/50 rounded-full" style={{ 
                      width: `${Math.min(100, (data.buy / (monthlyData[0]?.[1]?.buy || 1)) * 100)}%` 
                    }} />
                  </div>
                  <span className="text-[10px] text-gray-500 w-16 text-right">{formatIDR(data.buy)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ArrowUpRight className="w-3 h-3 text-red-500" />
                  <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500/50 rounded-full" style={{ 
                      width: `${Math.min(100, (data.sell / (monthlyData[0]?.[1]?.sell || 1)) * 100)}%` 
                    }} />
                  </div>
                  <span className="text-[10px] text-gray-500 w-16 text-right">{formatIDR(data.sell)}</span>
                </div>
              </div>
              <div className="text-right w-20">
                <p className={`text-xs font-bold ${data.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {formatIDR(data.profit)}
                </p>
              </div>
            </div>
          ))}
          {monthlyData.length === 0 && (
            <p className="text-sm text-gray-600 text-center py-4">Belum ada data</p>
          )}
        </div>
      </div>

      {/* Top Exchanges */}
      <div className="bg-[#111827] rounded-xl p-4 border border-white/[0.06] mb-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Exchange Favorit</h3>
        <div className="space-y-2.5">
          {exchangeStats.map(([label, data], i) => {
            const maxVol = exchangeStats[0]?.[1]?.volume || 1;
            return (
              <div key={label} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                  i === 0 ? "bg-amber-500/20 text-amber-400" 
                  : i === 1 ? "bg-gray-500/20 text-gray-400"
                  : "bg-gray-800 text-gray-600"
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-300">{label}</span>
                    <span className="text-[10px] text-gray-500">{data.count} tx</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full"
                      style={{ width: `${(data.volume / maxVol) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 w-16 text-right">{formatIDR(data.volume)}</span>
              </div>
            );
          })}
          {exchangeStats.length === 0 && (
            <p className="text-sm text-gray-600 text-center py-4">Belum ada data</p>
          )}
        </div>
      </div>

      {/* Ringkasan Bulanan Tersimpan */}
      <div className="bg-[#111827] rounded-xl p-4 border border-white/[0.06] mb-4">
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-300">Ringkasan Bulanan Tersimpan</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Profit bulan kalender yang tetap tersimpan setelah Tutup Buku
            </p>
          </div>
          <div className="flex gap-1.5">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-[#0a0e1a] border border-white/[0.06] rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <select
              value={selectedSummaryMonth}
              onChange={(e) => setSelectedSummaryMonth(e.target.value)}
              className="bg-[#0a0e1a] border border-white/[0.06] rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
            >
              <option value="all">Semua</option>
              {monthNames.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {monthlyHistoryForYear.length > 0 ? (
          <div className="space-y-2">
            {monthlyHistoryForYear.map((item) => (
              <div
                key={item.month_key}
                className="flex items-center justify-between gap-3 bg-[#0a0e1a] rounded-xl px-3.5 py-3 border border-white/[0.04]"
              >
                <div>
                  <p className="text-xs font-bold text-gray-300">
                    {dayjs(item.month_start).format('MMMM YYYY')}
                  </p>
                  <p className="text-[10px] text-gray-600">
                    {dayjs(item.month_start).format('DD MMM')} - {dayjs(item.month_end).format('DD MMM')}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-bold ${Number(item.total_profit_idr) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatIDR(Number(item.total_profit_idr || 0))}
                  </p>
                  <p className="text-[10px] text-gray-600">
                    {item.is_finalized ? '✓ Final' : '● Berjalan'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-600">
            <p className="text-xs">Tidak ada ringkasan bulanan</p>
          </div>
        )}
      </div>
    </div>
  );
}
