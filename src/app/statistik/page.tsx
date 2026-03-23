"use client";
import { useEffect, useState } from "react";
import PageWrapper from "@/components/PageWrapper";
import { useSessionStore } from "@/stores/useSessionStore";
import { supabase } from "@/lib/supabaseClient";
import { BarChart, Bar, LineChart, Line, AreaChart, Area, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import dayjs from "dayjs";
import { formatIDR } from "@/lib/utils";
import { Download } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function StatistikPage(){
  const txs = useSessionStore(s=>s.transactions);
  const sessions = useSessionStore(s=>s.sessions);
  const sessionSales = useSessionStore(s=>s.sessionSales);
  const stats = useSessionStore(s=>s.stats); // Use stats from store
  const fetchAllSessions = useSessionStore(s=>s.fetchAllSessions);
  const { currentTheme, isDark } = useTheme();
  const [downloading, setDownloading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  // Year selection state
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // State for daily stats
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [dailyView, setDailyView] = useState<'month' | 'alltime'>('month');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [dailyExpanded, setDailyExpanded] = useState(true);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  useEffect(() => {
    fetchAllSessions();
  }, [fetchAllSessions]);

  useEffect(() => {
    if (selectedYear === new Date().getFullYear()) {
      setSelectedMonth(new Date().getMonth());
    } else {
      setSelectedMonth(0);
    }
  }, [selectedYear]);

  // Fetch daily stats from RPC when year changes
  useEffect(() => {
    const fetchDailyStats = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase.rpc('get_daily_stats', { 
          target_user_id: user.id,
          target_year: selectedYear
        });

        if (!error && data) {
          setDailyStats(data);
        } else {
          console.warn("Failed to fetch daily stats RPC, falling back to client calc", error);
          setDailyStats([]); // Fallback will be used if empty
        }
      } catch (e) {
        console.error("Error fetching daily stats:", e);
        setDailyStats([]);
      }
    };

    fetchDailyStats();
  }, [selectedYear]);

  // Use stats from RPC if available, otherwise fallback to client calculation
  // Client calculation (fallback):
  const clientTotalBuy = txs.filter(t => t.type === 'BUY').reduce((acc, t) => acc + t.total_idr, 0);
  const clientTotalSell = txs.filter(t => t.type === 'SELL').reduce((acc, t) => acc + t.total_idr, 0);
  const clientTotalProfit = sessionSales.reduce((acc, s) => acc + s.profit_idr, 0);
  
  // Use stats if non-zero (meaning RPC worked), otherwise client
  const displayTotalProfit = stats.totalProfit !== 0 ? stats.totalProfit : clientTotalProfit;
  const displayTotalBuy = stats.totalBuyVolume !== 0 ? stats.totalBuyVolume : clientTotalBuy;
  const displayTotalSell = stats.totalSalesVolume !== 0 ? stats.totalSalesVolume : clientTotalSell;

  // Get available years from data
  const availableYears = Array.from(new Set([
    ...txs.map(t => new Date(t.tx_time).getFullYear()),
    ...sessionSales.filter(s => s.created_at).map(s => new Date(s.created_at!).getFullYear()),
    new Date().getFullYear() // Always include current year
  ])).sort((a, b) => b - a);

  // Group transactions by date for chart (Fallback Logic)
  const dailyMap = new Map<string, {buy: number, sell: number, profit: number}>();
  
  // Only process fallback if dailyStats is empty (RPC failed or empty)
  if (dailyStats.length === 0) {
    // Process BUY transactions
    txs.filter(t => t.type === 'BUY' && new Date(t.tx_time).getFullYear() === selectedYear).forEach(tx => {
      const dateKey = dayjs(tx.tx_time).format('DD/MM');
      const existing = dailyMap.get(dateKey) || {buy: 0, sell: 0, profit: 0};
      existing.buy += tx.total_idr;
      dailyMap.set(dateKey, existing);
    });
    
    sessionSales.forEach((rawSale: any) => {
      const saleDateSource = rawSale.created_at || rawSale.transactions?.tx_time;
      if (!saleDateSource) return;
      const saleDate = new Date(saleDateSource);
      if (saleDate.getFullYear() !== selectedYear) return;
      const dateKey = dayjs(saleDateSource).format('DD/MM');
      const existing = dailyMap.get(dateKey) || { buy: 0, sell: 0, profit: 0 };
      existing.sell += rawSale.proceeds_idr;
      existing.profit += rawSale.profit_idr;
      dailyMap.set(dateKey, existing);
    });
    
    // Include SELL transactions that don't have sessionSales yet (fallback)
    const sellTxIdsWithSales = new Set(
      sessionSales
        .map(sale => sale.tx_id)
        .filter((id): id is string => Boolean(id))
    );
    
    txs
      .filter(tx => 
        tx.type === 'SELL' && 
        new Date(tx.tx_time).getFullYear() === selectedYear &&
        tx.id && 
        !sellTxIdsWithSales.has(tx.id)
      )
      .forEach(tx => {
        const dateKey = dayjs(tx.tx_time).format('DD/MM');
        const existing = dailyMap.get(dateKey) || { buy: 0, sell: 0, profit: 0 };
        existing.sell += tx.total_idr;
        dailyMap.set(dateKey, existing);
      });
  }
  
  // Construct chart data: Prefer RPC data, fallback to client map
  let chartData;
  if (dailyStats.length > 0) {
     chartData = dailyStats.map(d => ({
       date: dayjs(d.tx_date).format('DD/MM'),
       buy: Number(d.buy_amount),
       sell: Number(d.sell_amount),
       profit: Number(d.profit_amount)
     }));
  } else {
     chartData = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        buy: Math.round(data.buy),
        sell: Math.round(data.sell),
        profit: Math.round(data.profit)
      }))
      .sort((a, b) => {
        const [dayA, monthA] = a.date.split('/').map(Number);
        const [dayB, monthB] = b.date.split('/').map(Number);
        return monthA - monthB || dayA - dayB;
      });
  }

  const chartDataDisplay = dailyView === 'month'
    ? chartData.filter((d: any) => {
      const parts = String(d.date).split('/');
      if (parts.length !== 2) return false;
      const month = Number(parts[1]);
      if (!Number.isFinite(month)) return false;
      return month - 1 === selectedMonth;
    })
    : chartData;

  // Calculate totals for selected year (chart only)
  const chartTotalBuy = chartData.reduce((sum: number, d: any) => sum + d.buy, 0);
  const chartTotalSell = chartData.reduce((sum: number, d: any) => sum + d.sell, 0);
  const chartTotalProfit = chartData.reduce((sum: number, d: any) => sum + d.profit, 0);

  // Determine what to display in cards
  // If selected year is current year, show ALL TIME stats from RPC/Store
  // If selected year is specific (past), show chart totals
  const isCurrentYear = selectedYear === new Date().getFullYear();
  const cardProfit = isCurrentYear ? displayTotalProfit : chartTotalProfit;
  const cardBuy = isCurrentYear ? displayTotalBuy : chartTotalBuy;
  const cardSell = isCurrentYear ? displayTotalSell : chartTotalSell;

  const handleDownloadCSV = (period: 'daily' | 'weekly' | 'monthly' | 'alltime') => {
    setShowModal(false);
    setDownloading(true);
    try {
      const today = new Date();
      
      // Filter transactions based on period
      const filteredTxs = txs.filter(tx => {
        const date = new Date(tx.tx_time);
        
        if (period === 'daily') {
          return date.toDateString() === today.toDateString();
        } else if (period === 'weekly') {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return date >= weekAgo;
        } else if (period === 'monthly') {
          return date.getMonth() === today.getMonth() && 
                 date.getFullYear() === today.getFullYear();
        } else {
          return true;
        }
      });
      
      if (filteredTxs.length === 0) {
        alert('Tidak ada data untuk periode yang dipilih');
        setDownloading(false);
        return;
      }
      
      // Create detailed CSV data with all transaction info
      const dataToDownload: Record<string, any>[] = [];
      
      // Helper to format numbers for CSV (raw numbers are better for Excel calculation)
      // But we will use a specific format that Excel Indonesia/US can handle if we use CSV.
      // Actually, standard CSV uses dot for decimals. Excel will interpret it correctly based on local settings usually.
      // To be safe and "rapi", we will use strings for display but clear format.
      // Wait, user wants "bisa dimengerti" (understandable).
      // Let's provide BOTH formatted (for reading) and raw (for calculation) if possible, 
      // OR just standard numbers. Let's stick to standard numbers for Price/Amount/Total/Profit.
      
      // Process each transaction with full details
      filteredTxs.forEach((tx, index) => {
        const session = tx.session_id ? sessions.find(s => s.id === tx.session_id) : null;
        const sales = sessionSales.filter(sale => sale.tx_id === tx.id);
        
        if (tx.type === 'BUY') {
          dataToDownload.push({
            'No': index + 1,
            'Tanggal': dayjs(tx.tx_time).format('YYYY-MM-DD'),
            'Waktu': dayjs(tx.tx_time).format('HH:mm'),
            'Tipe': 'BELI',
            'Harga (IDR)': tx.price_idr,
            'Jumlah (USDT)': tx.amount_usdt,
            'Total (IDR)': tx.total_idr,
            'Fee (IDR)': tx.fee_idr || 0,
            'Profit (IDR)': 0,
            'ROI (%)': 0,
            'Sesi ID': tx.session_id || '-',
            'Status Sesi': session ? session.status : '-',
            'Keterangan': session ? `Sisa: ${session.remaining_usdt.toFixed(2)} USDT` : 'Tanpa Sesi'
          });
        } else if (tx.type === 'SELL') {
          // For SELL transactions
          if (sales.length > 0) {
            const totalProfit = sales.reduce((sum, sale) => sum + sale.profit_idr, 0);
            const totalCost = sales.reduce((sum, sale) => sum + sale.cost_idr, 0);
            const roi = totalCost > 0 ? ((totalProfit / totalCost) * 100) : 0;
            
            // Main SELL entry
            dataToDownload.push({
              'No': index + 1,
              'Tanggal': dayjs(tx.tx_time).format('YYYY-MM-DD'),
              'Waktu': dayjs(tx.tx_time).format('HH:mm'),
              'Tipe': 'JUAL',
              'Harga (IDR)': tx.price_idr,
              'Jumlah (USDT)': tx.amount_usdt,
              'Total (IDR)': tx.total_idr,
              'Fee (IDR)': tx.fee_idr || 0,
              'Profit (IDR)': totalProfit,
              'ROI (%)': parseFloat(roi.toFixed(2)),
              'Sesi ID': 'MULTI-FIFO',
              'Status Sesi': '-',
              'Keterangan': `Gabungan ${sales.length} Sesi`
            });
            
            // Breakdown for each session used (Optional: Indented)
            sales.forEach((sale, saleIdx) => {
              const saleSession = sessions.find(s => s.id === sale.session_id);
              const saleRoi = sale.cost_idr > 0 ? ((sale.profit_idr / sale.cost_idr) * 100) : 0;
              
              dataToDownload.push({
                'No': '',
                'Tanggal': '',
                'Waktu': '',
                'Tipe': '↳ FIFO',
                'Harga (IDR)': 0, // Empty for clarity or specific buy price of that session?
                'Jumlah (USDT)': sale.sold_usdt,
                'Total (IDR)': sale.proceeds_idr,
                'Fee (IDR)': 0,
                'Profit (IDR)': sale.profit_idr,
                'ROI (%)': parseFloat(saleRoi.toFixed(2)),
                'Sesi ID': sale.session_id,
                'Status Sesi': saleSession ? saleSession.status : '-',
                'Keterangan': `Ambil dari Sesi ${dayjs(saleSession?.created_at).format('DD/MM')}`
              });
            });
          } else {
            // SELL without session sales data
            dataToDownload.push({
              'No': index + 1,
              'Tanggal': dayjs(tx.tx_time).format('YYYY-MM-DD'),
              'Waktu': dayjs(tx.tx_time).format('HH:mm'),
              'Tipe': 'JUAL',
              'Harga (IDR)': tx.price_idr,
              'Jumlah (USDT)': tx.amount_usdt,
              'Total (IDR)': tx.total_idr,
              'Fee (IDR)': tx.fee_idr || 0,
              'Profit (IDR)': 0,
              'ROI (%)': 0,
              'Sesi ID': '-',
              'Status Sesi': '-',
              'Keterangan': 'Data profit belum tersedia'
            });
          }
        }
      });
      
      // Calculate Summaries
      const totalBuy = filteredTxs.filter(t => t.type === 'BUY').reduce((sum, t) => sum + t.total_idr, 0);
      const totalSell = filteredTxs.filter(t => t.type === 'SELL').reduce((sum, t) => sum + t.total_idr, 0);
      const totalProfit = sessionSales
        .filter(sale => filteredTxs.some(tx => tx.id === sale.tx_id))
        .reduce((sum, sale) => sum + sale.profit_idr, 0);
      
      // Empty Row
      dataToDownload.push({});

      // Summary Rows
      dataToDownload.push({
        'No': 'SUMMARY',
        'Tipe': 'Total Beli',
        'Total (IDR)': totalBuy
      });
      dataToDownload.push({
        'No': 'SUMMARY',
        'Tipe': 'Total Jual',
        'Total (IDR)': totalSell
      });
      dataToDownload.push({
        'No': 'SUMMARY',
        'Tipe': 'Total Profit',
        'Total (IDR)': totalProfit, // Put in Total column for alignment or Profit column?
        'Profit (IDR)': totalProfit
      });
      
      if (dataToDownload.length === 0) {
        alert('Tidak ada data untuk di-export');
        setDownloading(false);
        return;
      }
      
      // Convert to CSV
      const headers = [
        'No', 'Tanggal', 'Waktu', 'Tipe', 
        'Harga (IDR)', 'Jumlah (USDT)', 'Total (IDR)', 'Fee (IDR)', 
        'Profit (IDR)', 'ROI (%)', 
        'Sesi ID', 'Status Sesi', 'Keterangan'
      ];

      const csvContent = [
        headers.join(';'),
        ...dataToDownload.map(row => 
          headers.map(header => {
            const value = row[header];
            if (value === undefined || value === null) return '';
            // If number, keep as is
            if (typeof value === 'number') return value.toString().replace('.', ',');
            // Escape quotes in strings
            const stringValue = String(value);
            if (stringValue.includes(';') || stringValue.includes('"') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          }).join(';')
        )
      ].join('\n');
      
      const BOM = '\uFEFF';
      const filename = `Laporan-P2P-${period}-${dayjs().format('YYYY-MM-DD')}.csv`;
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating CSV:', error);
      alert('Terjadi kesalahan saat membuat CSV');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <PageWrapper>
      <main className="pb-28 px-4 pt-4 dark:bg-gray-900 min-h-screen">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Statistik Profit</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Track your daily performance and profit trends
            </p>
          </div>
          
          <div className="flex gap-2">
            {/* Year Selector */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white border-none focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

            {/* Download Button - Icon Only */}
            <button
              onClick={() => setShowModal(true)}
              disabled={downloading}
              className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors disabled:opacity-50"
              title="Download CSV"
            >
              <Download size={20} />
            </button>
          </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-5 bg-gradient-to-br from-green-500 to-green-600 rounded-3xl text-white shadow-lg shadow-green-500/20">
            <div className="text-white/80 text-sm mb-1">Total Profit (Realized)</div>
            <div className="text-3xl font-bold">{formatIDR(cardProfit)}</div>
          </div>
          <div className="p-5 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">Volume Beli</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatIDR(cardBuy)}</div>
          </div>
          <div className="p-5 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">Volume Jual</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatIDR(cardSell)}</div>
          </div>
        </div>

        {/* Download Modal Popup */}
        {showModal && (
          <>
            {/* Background Overlay */}
            <div 
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
              onClick={() => setShowModal(false)}
            />
            
            {/* Modal Container */}
            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-6 w-full max-w-sm pointer-events-auto">
                {/* Modal Header */}
                <div className="text-center mb-6">
                  <div className="flex justify-center mb-3">
                    <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full p-3">
                      <Download className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Pilih Periode Export</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Download data transaksi CSV</p>
                </div>
                
                {/* Options */}
                <div className="space-y-2">
                  <button
                    onClick={() => handleDownloadCSV('daily')}
                    className="w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📊</span>
                      <div>
                        <div className="font-medium text-gray-800 dark:text-white">Harian</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Data hari ini saja</div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => handleDownloadCSV('weekly')}
                    className="w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📈</span>
                      <div>
                        <div className="font-medium text-gray-800 dark:text-white">Mingguan</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Data 7 hari terakhir</div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => handleDownloadCSV('monthly')}
                    className="w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📅</span>
                      <div>
                        <div className="font-medium text-gray-800 dark:text-white">Bulanan</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Data bulan ini</div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => handleDownloadCSV('alltime')}
                    className="w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🗂️</span>
                      <div>
                        <div className="font-medium text-gray-800 dark:text-white">Semua Data</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Seluruh riwayat transaksi</div>
                      </div>
                    </div>
                  </button>
                </div>
                
                {/* Cancel Button */}
                <button
                  onClick={() => setShowModal(false)}
                  className="w-full mt-4 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors text-sm font-medium"
                >
                  Batal
                </button>
              </div>
            </div>
          </>
        )}
        
        {/* Chart or Empty State */}
        {chartData.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-soft">
            <div className="flex flex-col gap-3 mb-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Daily Performance</h2>
                <button
                  onClick={() => setDailyExpanded(v => !v)}
                  className="shrink-0 text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {dailyExpanded ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <div className="w-full sm:w-auto flex items-center rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setDailyView('month')}
                    className={`flex-1 sm:flex-none px-3 py-2 text-xs font-semibold transition-colors ${
                      dailyView === 'month'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    Per Bulan
                  </button>
                  <button
                    onClick={() => setDailyView('alltime')}
                    className={`flex-1 sm:flex-none px-3 py-2 text-xs font-semibold transition-colors ${
                      dailyView === 'alltime'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    All Time
                  </button>
                </div>

                {dailyView === 'month' && (
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full sm:w-auto text-xs px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                  >
                    {monthNames.map((m, idx) => (
                      <option key={m} value={idx}>{m}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {dailyExpanded ? (
              chartDataDisplay.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    {currentTheme.chartType === 'line' ? (
                      <LineChart data={chartDataDisplay}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                    <XAxis dataKey="date" stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                    <YAxis tickFormatter={(value: any) => `${value/1000}k`} stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                    <Tooltip formatter={(value: any) => formatIDR(value as number)} contentStyle={{ backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }} />
                    <Legend />
                    <Line type="monotone" dataKey="buy" stroke={isDark ? currentTheme.chartColors.buyDark : currentTheme.chartColors.buy} strokeWidth={2} dot={{ r: 4 }} name="Beli" />
                    <Line type="monotone" dataKey="sell" stroke={isDark ? currentTheme.chartColors.sellDark : currentTheme.chartColors.sell} strokeWidth={2} dot={{ r: 4 }} name="Jual" />
                    <Line type="monotone" dataKey="profit" stroke={isDark ? currentTheme.chartColors.profitDark : currentTheme.chartColors.profit} strokeWidth={2} dot={{ r: 4 }} name="Profit" />
                      </LineChart>
                    ) : currentTheme.chartType === 'area' ? (
                      <AreaChart data={chartDataDisplay}>
                    <defs>
                      <linearGradient id="buyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isDark ? currentTheme.chartColors.buyDark : currentTheme.chartColors.buy} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={isDark ? currentTheme.chartColors.buyDark : currentTheme.chartColors.buy} stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="sellGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isDark ? currentTheme.chartColors.sellDark : currentTheme.chartColors.sell} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={isDark ? currentTheme.chartColors.sellDark : currentTheme.chartColors.sell} stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isDark ? currentTheme.chartColors.profitDark : currentTheme.chartColors.profit} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={isDark ? currentTheme.chartColors.profitDark : currentTheme.chartColors.profit} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                    <XAxis dataKey="date" stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                    <YAxis tickFormatter={(value: any) => `${value/1000}k`} stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                    <Tooltip formatter={(value: any) => formatIDR(value as number)} contentStyle={{ backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }} />
                    <Legend />
                    <Area type="monotone" dataKey="buy" stroke={isDark ? currentTheme.chartColors.buyDark : currentTheme.chartColors.buy} fill="url(#buyGradient)" name="Beli" />
                    <Area type="monotone" dataKey="sell" stroke={isDark ? currentTheme.chartColors.sellDark : currentTheme.chartColors.sell} fill="url(#sellGradient)" name="Jual" />
                    <Area type="monotone" dataKey="profit" stroke={isDark ? currentTheme.chartColors.profitDark : currentTheme.chartColors.profit} fill="url(#profitGradient)" name="Profit" />
                      </AreaChart>
                    ) : currentTheme.chartType === 'composed' ? (
                      <ComposedChart data={chartDataDisplay}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                    <XAxis dataKey="date" stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                    <YAxis tickFormatter={(value: any) => `${value/1000}k`} stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                    <Tooltip formatter={(value: any) => formatIDR(value as number)} contentStyle={{ backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }} />
                    <Legend />
                    <Bar dataKey="buy" fill={isDark ? currentTheme.chartColors.buyDark : currentTheme.chartColors.buy} name="Beli" />
                    <Bar dataKey="sell" fill={isDark ? currentTheme.chartColors.sellDark : currentTheme.chartColors.sell} name="Jual" />
                    <Line type="monotone" dataKey="profit" stroke={isDark ? currentTheme.chartColors.profitDark : currentTheme.chartColors.profit} strokeWidth={3} dot={{ r: 5 }} name="Profit" />
                      </ComposedChart>
                    ) : (
                      <BarChart data={chartDataDisplay}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                    <XAxis dataKey="date" stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                    <YAxis tickFormatter={(value: any) => `${value/1000}k`} stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                    <Tooltip formatter={(value: any) => formatIDR(value as number)} contentStyle={{ backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }} />
                    <Legend />
                    <Bar dataKey="buy" fill={isDark ? currentTheme.chartColors.buyDark : currentTheme.chartColors.buy} name="Beli" />
                    <Bar dataKey="sell" fill={isDark ? currentTheme.chartColors.sellDark : currentTheme.chartColors.sell} name="Jual" />
                    <Bar dataKey="profit" fill={isDark ? currentTheme.chartColors.profitDark : currentTheme.chartColors.profit} name="Profit" />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-6 text-center text-sm text-gray-600 dark:text-gray-300">
                  Tidak ada data untuk periode ini.
                </div>
              )
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {dailyView === 'month'
                  ? `Menampilkan harian bulan ${monthNames[selectedMonth]} ${selectedYear}`
                  : `Menampilkan harian sepanjang ${selectedYear}`}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-soft">
            <div className="flex flex-col items-center justify-center text-center space-y-3">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-gray-500 dark:text-gray-400">Belum ada data transaksi</p>
            </div>
          </div>
        )}
      </main>
    </PageWrapper>
  );
}
