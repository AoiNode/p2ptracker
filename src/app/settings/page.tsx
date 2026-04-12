"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PageWrapper from "@/components/PageWrapper";
import { useTheme } from "@/contexts/ThemeContext";
import { useSessionStore } from "@/stores/useSessionStore";
import { supabase } from "@/lib/supabaseClient";
import { formatIDR } from "@/lib/utils";
import { getButtonStyle } from "@/lib/buttonStyles";
import ConfirmModal from "@/components/ConfirmModal";
import PopupNotification from "@/components/PopupNotification";
import dayjs from "dayjs";

export default function SettingsPage() {
  const router = useRouter();
  const { isDark, toggleTheme, currentTheme, setTheme, availableThemes } = useTheme();
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Closing State
  const [showClosingConfirm, setShowClosingConfirm] = useState(false);
  const [showClosingProgress, setShowClosingProgress] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [closingSteps, setClosingSteps] = useState<{
    snapshot: 'pending' | 'loading' | 'success' | 'error',
    excel: 'pending' | 'loading' | 'success' | 'error',
    tele: 'pending' | 'loading' | 'success' | 'error',
    db: 'pending' | 'loading' | 'success' | 'error'
  }>({
    snapshot: 'pending',
    excel: 'pending',
    tele: 'pending',
    db: 'pending'
  });
  const [activeSnapshot, setActiveSnapshot] = useState<any[]>([]);
  const [closingError, setClosingError] = useState<string | null>(null);
  const [closingResult, setClosingResult] = useState<{show: boolean, type: 'success' | 'error', message: string}>({
    show: false,
    type: 'success',
    message: ''
  });
  
  const targetMonthly = useSessionStore(s => s.targetMonthly);
  const setTargetMonthly = useSessionStore(s => s.setTargetMonthly);
  const [tempTarget, setTempTarget] = useState(targetMonthly.toString());
  
  const handleSaveTarget = async () => {
    const newTarget = parseInt(tempTarget.replace(/\D/g, ''));
    if (newTarget > 0) {
      await setTargetMonthly(newTarget);
      setShowTargetModal(false);
    }
  };

  const handleMonthlyClosing = async () => {
    setShowClosingConfirm(false);
    setShowClosingProgress(true);
    setIsClosing(true);
    setClosingError(null);
    setActiveSnapshot([]);
    setClosingSteps({ snapshot: 'loading', excel: 'pending', tele: 'pending', db: 'pending' });
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Silakan login kembali");

      await useSessionStore.getState().fetchAllSessions();

      const previewRes = await fetch('/api/monthly-closing-preview', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const preview = await previewRes.json();
      if (!previewRes.ok) throw new Error(preview.error || 'Gagal membaca sesi aktif');

      const snapshotList = Array.isArray(preview.activeSessions) ? preview.activeSessions : [];
      setActiveSnapshot(snapshotList);
      setClosingSteps(prev => ({ ...prev, snapshot: 'success', excel: 'loading' }));

      const { transactions, sessionSales } = useSessionStore.getState();
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const monthKeys = Array.from(new Set([
        ...transactions.map(t => dayjs(t.tx_time).format('YYYY-MM')),
        ...sessionSales.map(s => dayjs(s.created_at).format('YYYY-MM'))
      ])).sort();

      const monthlyRows = monthKeys.map((key) => {
        const monthStart = dayjs(`${key}-01`).startOf('month');
        const monthEnd = monthStart.endOf('month');

        const startMs = monthStart.valueOf();
        const endMs = monthEnd.valueOf();

        const monthTxs = transactions.filter(t => {
          const ms = dayjs(t.tx_time).valueOf();
          return ms >= startMs && ms <= endMs;
        });

        const monthBuys = monthTxs.filter(t => t.type === 'BUY');
        const monthSells = monthTxs.filter(t => t.type === 'SELL');

        const totalBuyIdr = monthBuys.reduce((sum, t) => sum + Number(t.total_idr || 0), 0);
        const totalSellIdr = monthSells.reduce((sum, t) => sum + Number(t.total_idr || 0), 0);

        const monthSales = sessionSales.filter(s => {
          const ms = dayjs(s.created_at).valueOf();
          return ms >= startMs && ms <= endMs;
        });
        const totalProfitIdr = monthSales.reduce((sum, s) => sum + Number(s.profit_idr || 0), 0);

        return {
          Periode: `${monthStart.format('YYYY-MM')} (${monthStart.format('DD MMM')} - ${monthEnd.format('DD MMM')})`,
          Mulai: monthStart.format('YYYY-MM-DD'),
          Sampai: monthEnd.format('YYYY-MM-DD'),
          Profit_IDR: totalProfitIdr,
          Beli_IDR: totalBuyIdr,
          Jual_IDR: totalSellIdr,
          Jumlah_Transaksi: monthTxs.length,
          Jumlah_Sell: monthSales.length
        };
      });

      const totalProfitAll = monthlyRows.reduce((sum, r) => sum + Number(r.Profit_IDR || 0), 0);
      const totalBuyAll = monthlyRows.reduce((sum, r) => sum + Number(r.Beli_IDR || 0), 0);
      const totalSellAll = monthlyRows.reduce((sum, r) => sum + Number(r.Jual_IDR || 0), 0);
      const totalTxAll = monthlyRows.reduce((sum, r) => sum + Number(r.Jumlah_Transaksi || 0), 0);
      const totalSellCountAll = monthlyRows.reduce((sum, r) => sum + Number(r.Jumlah_Sell || 0), 0);

      const summarySheet = XLSX.utils.json_to_sheet([
        ...monthlyRows,
        {
          Periode: 'TOTAL',
          Mulai: '',
          Sampai: '',
          Profit_IDR: totalProfitAll,
          Beli_IDR: totalBuyAll,
          Jual_IDR: totalSellAll,
          Jumlah_Transaksi: totalTxAll,
          Jumlah_Sell: totalSellCountAll
        }
      ]);
      XLSX.utils.book_append_sheet(wb, summarySheet, "Ringkasan_Bulanan");
      
      const txSheet = XLSX.utils.json_to_sheet(transactions.map(t => ({
        Tanggal: dayjs(t.tx_time).format('YYYY-MM-DD HH:mm'),
        Bulan: dayjs(t.tx_time).format('YYYY-MM'),
        Tipe: t.type,
        Exchange: t.label,
        Harga: t.price_idr,
        Jumlah_USDT: t.amount_usdt,
        Total_IDR: t.total_idr,
        Fee: t.fee_idr
      })));
      XLSX.utils.book_append_sheet(wb, txSheet, "Transaksi");

      const profitSheet = XLSX.utils.json_to_sheet(sessionSales.map(s => ({
        Tanggal_Jual: dayjs(s.created_at).format('YYYY-MM-DD HH:mm'),
        Bulan: dayjs(s.created_at).format('YYYY-MM'),
        USDT_Terjual: s.sold_usdt,
        Modal_IDR: s.cost_idr,
        Pendapatan_IDR: s.proceeds_idr,
        Profit_IDR: s.profit_idr
      })));
      XLSX.utils.book_append_sheet(wb, profitSheet, "Profit_FIFO");

      const snapshotSheet = XLSX.utils.json_to_sheet(snapshotList.map((s: any) => ({
        Tanggal_Sesi: s.created_at ? dayjs(s.created_at).format('YYYY-MM-DD HH:mm') : '',
        Harga: s.price_idr ?? s.avg_cost,
        Avg_Cost: s.avg_cost,
        Sisa_USDT: s.remaining_usdt
      })));
      XLSX.utils.book_append_sheet(wb, snapshotSheet, "Sisa_Sesi");

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      setClosingSteps(prev => ({ ...prev, excel: 'success', tele: 'loading' }));

      // 2. Get Chat ID & Send to Telegram
      const linkResponse = await fetch('/api/telegram/link', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const linkData = await linkResponse.json();
      if (!linkData.linked || !linkData.account?.telegram_user_id) {
        throw new Error("Tahap Telegram: Bot belum terhubung.");
      }

      setClosingSteps(prev => ({ ...prev, db: 'loading' }));
      const res = await fetch('/api/monthly-closing', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          excelData: wbout,
          fileName: `Rekap_P2P_${dayjs().format('MMM_YYYY')}.xlsx`,
          chatId: linkData.account.telegram_user_id,
          skipCleaning: false
        })
      });

      const result = await res.json();
      
      if (!res.ok) {
        if (result.partialSuccess) setClosingSteps(prev => ({ ...prev, tele: 'success', db: 'error' }));
        else setClosingSteps(prev => ({ ...prev, tele: 'error' }));
        throw new Error(result.error || "Gagal dalam proses Tutup Buku");
      }

      setClosingSteps({ snapshot: 'success', excel: 'success', tele: 'success', db: 'success' });
      
      setClosingResult({
        show: true,
        type: 'success',
        message: result.warning
          ? `Tutup Buku Berhasil! ${result.archiveStats.deleted_transactions} transaksi dihapus, ${result.archiveStats.deleted_sessions} sesi dihapus, ${result.archiveStats.restored_sessions} sesi aktif dipulihkan. (Catatan: ${result.warning})`
          : `Tutup Buku Berhasil! ${result.archiveStats.deleted_transactions} transaksi dihapus, ${result.archiveStats.deleted_sessions} sesi dihapus, ${result.archiveStats.restored_sessions} sesi aktif dipulihkan.`
      });

      setTimeout(() => window.location.reload(), 5000);

    } catch (e: any) {
      console.error(e);
      setClosingError(e.message);
      // Determine which step failed if not already set
      setClosingSteps(prev => {
        if (prev.snapshot === 'loading') return { ...prev, snapshot: 'error' };
        if (prev.excel === 'loading') return { ...prev, excel: 'error' };
        if (prev.tele === 'loading') return { ...prev, tele: 'error' };
        if (prev.db === 'loading') return { ...prev, db: 'error' };
        return prev;
      });
    } finally {
      setIsClosing(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear local storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Redirect to login
      router.push("/login");
    } catch (error) {
      console.error("Error logging out:", error);
      alert("Gagal logout. Silakan coba lagi.");
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };
  
  return (
    <PageWrapper>
      <main className="pb-28 px-4 pt-4 dark:bg-gray-900 min-h-screen">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-2xl">
            <span className="text-2xl">{currentTheme.icons.settings || '⚙️'}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pengaturan</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Kelola preferensi aplikasi</p>
          </div>
        </div>
        
        <div className="space-y-8">
          {/* Section: Tutup Buku */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">
              Manajemen Data
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-2xl">
                  📊
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">Tutup Buku Bulanan</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Ekspor rekap & bersihkan riwayat lama</p>
                </div>
              </div>

              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed text-center italic">
                  &quot;Gunakan fitur ini setiap akhir bulan untuk menjaga performa aplikasi tetap cepat. Data modal tetap aman.&quot;
                </p>
              </div>

              <button
                onClick={() => setShowClosingConfirm(true)}
                disabled={isClosing}
                className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-purple-600/25 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isClosing ? 'Sedang Diproses...' : 'Mulai Tutup Buku'}
              </button>
            </div>
          </section>

          {/* Section: Tampilan */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">
              Tampilan & Preferensi
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-2 shadow-sm border border-gray-100 dark:border-gray-700">
              {/* Theme Selector */}
              <button 
                onClick={() => setShowThemeModal(true)}
                className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-2xl transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-xl">
                      {currentTheme.icon}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Tema Aplikasi</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{currentTheme.name}</div>
                    </div>
                  </div>
                  <div className="text-gray-400 group-hover:text-purple-500 transition-colors">→</div>
                </div>
              </button>

              <div className="h-px bg-gray-100 dark:bg-gray-700 mx-4 my-1" />

              {/* Dark Mode Toggle */}
              <div className="p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-xl">
                    {currentTheme.icons.darkMode}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Mode Gelap</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Sesuaikan dengan kenyamanan mata</div>
                  </div>
                </div>
                <button
                  onClick={toggleTheme}
                  className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  style={{ backgroundColor: isDark ? 'var(--color-primary)' : '#E5E7EB' }}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${isDark ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </section>

          {/* Section: Akun & Target */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">
              Akun & Target
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-2 shadow-sm border border-gray-100 dark:border-gray-700">
              {/* Monthly Target */}
              <button 
                onClick={() => setShowTargetModal(true)}
                className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-2xl transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-xl">
                      {currentTheme.icons.target}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Target Bulanan</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{formatIDR(targetMonthly)}</div>
                    </div>
                  </div>
                  <div className="text-gray-400 group-hover:text-purple-500 transition-colors">→</div>
                </div>
              </button>

              <div className="h-px bg-gray-100 dark:bg-gray-700 mx-4 my-1" />

              {/* Telegram Bot */}
              <button 
                onClick={() => router.push('/settings/telegram')}
                className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-2xl transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center text-xl">
                      🤖
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Telegram Bot</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Hubungkan untuk notifikasi</div>
                    </div>
                  </div>
                  <div className="text-gray-400 group-hover:text-purple-500 transition-colors">→</div>
                </div>
              </button>
              
              <div className="h-px bg-gray-100 dark:bg-gray-700 mx-4 my-1" />

              {/* Logout */}
              <button 
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full text-left p-4 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xl">
                      {currentTheme.icons.logout}
                    </div>
                    <div>
                      <div className="font-medium text-red-600 dark:text-red-400">Logout</div>
                      <div className="text-sm text-red-400/70 dark:text-red-400/70">Keluar dari sesi saat ini</div>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </section>

          {/* Section: Lainnya */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">
              Lainnya
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-2 shadow-sm border border-gray-100 dark:border-gray-700">
               {/* Install App */}
               <button 
                onClick={() => {
                  const event = new Event('beforeinstallprompt');
                  window.dispatchEvent(event);
                }}
                className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-2xl transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-xl">
                      {currentTheme.icons.installApp}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Install Aplikasi</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Tambahkan ke layar utama</div>
                    </div>
                  </div>
                  <div className="text-gray-400 group-hover:text-purple-500 transition-colors">→</div>
                </div>
              </button>
            </div>
          </section>
        </div>

        {/* About Section - ZigsAI P2P Tools */}
        <div className="mt-12 mb-4 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-2xl mb-4">
            <span className="text-3xl">💎</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            ZigsAI P2P Tools
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">
            v1.0.0 • Advanced Trading Management
          </p>
          <div className="text-xs text-gray-400 dark:text-gray-600">
            © 2025 ZigsAI Technology. All rights reserved.
          </div>
        </div>

        {/* Theme Modal */}
        {showThemeModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto animate-slide-up">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Pilih Tema</h3>
              <div className="space-y-3">
                {Object.values(availableThemes).map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => {
                      setTheme(theme.id);
                      setShowThemeModal(false);
                    }}
                    className={`w-full text-left p-4 rounded-xl transition-all ${
                      currentTheme.id === theme.id 
                        ? 'bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-2' 
                        : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent'
                    }`}
                    style={{
                      borderColor: currentTheme.id === theme.id ? 'var(--color-primary)' : 'transparent'
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{theme.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">{theme.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{theme.description}</div>
                        <div className="flex gap-1 mt-2">
                          <div 
                            className="w-6 h-6 rounded-full border"
                            style={{ 
                              backgroundColor: isDark ? theme.colors.primaryDark : theme.colors.primary,
                              borderColor: 'var(--color-border)'
                            }}
                          />
                          <div 
                            className="w-6 h-6 rounded-full border"
                            style={{ 
                              backgroundColor: isDark ? theme.colors.secondaryDark : theme.colors.secondary,
                              borderColor: 'var(--color-border)'
                            }}
                          />
                          <div 
                            className="w-6 h-6 rounded-full border"
                            style={{ 
                              backgroundColor: isDark ? theme.colors.accentDark : theme.colors.accent,
                              borderColor: 'var(--color-border)'
                            }}
                          />
                        </div>
                      </div>
                      {currentTheme.id === theme.id && (
                        <svg className="w-5 h-5" style={{ color: 'var(--color-primary)' }} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowThemeModal(false)}
                className={`w-full mt-4 ${getButtonStyle(currentTheme.id, 'secondary')}`}
              >
                Tutup
              </button>
            </div>
          </div>
        )}

        {showClosingProgress && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center px-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md animate-slide-up border border-gray-100 dark:border-gray-700">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Proses Tutup Buku</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Jangan tutup halaman sampai selesai.
                  </p>
                </div>
                {!isClosing && (
                  <button
                    onClick={() => setShowClosingProgress(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="space-y-3 mb-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">1. Membaca Sesi Aktif</span>
                  {closingSteps.snapshot === 'loading' && <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />}
                  {closingSteps.snapshot === 'success' && <span className="text-emerald-500 text-sm font-bold">DONE</span>}
                  {closingSteps.snapshot === 'error' && <span className="text-rose-500 text-sm font-bold">ERROR</span>}
                </div>

                {activeSnapshot.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                    <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                      Tersisa {activeSnapshot.length} sesi aktif:
                    </div>
                    <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                      {activeSnapshot.slice(0, 10).map((s: any, idx: number) => (
                        <div key={s.id || idx} className="flex items-center justify-between">
                          <span className="truncate pr-2">
                            {s.remaining_usdt?.toFixed ? s.remaining_usdt.toFixed(2) : s.remaining_usdt} USDT
                          </span>
                          <span className="shrink-0 text-gray-500 dark:text-gray-400">
                            @ {Math.round(Number(s.avg_cost ?? s.price_idr) || 0).toLocaleString('id-ID')}
                          </span>
                        </div>
                      ))}
                      {activeSnapshot.length > 10 && (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          +{activeSnapshot.length - 10} sesi lainnya…
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">2. Menyiapkan Data Excel</span>
                  {closingSteps.excel === 'loading' && <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />}
                  {closingSteps.excel === 'success' && <span className="text-emerald-500 text-sm font-bold">DONE</span>}
                  {closingSteps.excel === 'error' && <span className="text-rose-500 text-sm font-bold">ERROR</span>}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">3. Mengirim ke Telegram Bot</span>
                  {closingSteps.tele === 'loading' && <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />}
                  {closingSteps.tele === 'success' && <span className="text-emerald-500 text-sm font-bold">DONE</span>}
                  {closingSteps.tele === 'error' && <span className="text-rose-500 text-sm font-bold">ERROR</span>}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">4. Reset & Pulihkan Sesi</span>
                  {closingSteps.db === 'loading' && <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />}
                  {closingSteps.db === 'success' && <span className="text-emerald-500 text-sm font-bold">DONE</span>}
                  {closingSteps.db === 'error' && <span className="text-rose-500 text-sm font-bold">ERROR</span>}
                </div>

                {closingError && (
                  <div className="mt-2 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-mono break-words">
                    ❌ Detail Error: {closingError}
                  </div>
                )}
              </div>

              {!isClosing && (
                <button
                  onClick={() => setShowClosingProgress(false)}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold rounded-2xl transition-all"
                >
                  Tutup
                </button>
              )}
            </div>
          </div>
        )}

        <PopupNotification
          show={closingResult.show}
          type={closingResult.type}
          title={closingResult.type === 'success' ? 'Berhasil' : 'Gagal'}
          message={closingResult.message}
          onClose={() => setClosingResult(prev => ({ ...prev, show: false }))}
        />

        {/* Confirm Monthly Closing */}
        <ConfirmModal
          isOpen={showClosingConfirm}
          onClose={() => !isClosing && setShowClosingConfirm(false)}
          onConfirm={handleMonthlyClosing}
          title="Tutup Buku Bulanan"
          message="Sistem akan membaca sesi aktif yang masih tersisa, mengirim Excel rekap ke Telegram, lalu menghapus semua data transaksi dan sesi. Setelah itu, sesi aktif akan dipulihkan otomatis dari snapshot agar modal tetap aman. Lanjutkan?"
          confirmText="Ya, Tutup Buku"
          isLoading={isClosing}
          type="warning"
        />

        {/* Target Modal */}
        {showTargetModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm animate-slide-up">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Set Target Bulanan</h3>
              <input
                type="text"
                value={tempTarget}
                onChange={(e) => setTempTarget(e.target.value)}
                className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 mb-4"
                placeholder="Masukkan target..."
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setTempTarget(targetMonthly.toString());
                    setShowTargetModal(false);
                  }}
                  className={`flex-1 ${getButtonStyle(currentTheme.id, 'secondary')}`}
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveTarget}
                  className={`flex-1 ${getButtonStyle(currentTheme.id, 'primary')}`}
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Logout Confirmation Modal */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm animate-slide-up">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Konfirmasi Logout</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Apakah Anda yakin ingin keluar dari aplikasi?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className={`flex-1 ${getButtonStyle(currentTheme.id, 'secondary')}`}
                  disabled={loggingOut}
                >
                  Batal
                </button>
                <button
                  onClick={handleLogout}
                  className={`flex-1 ${getButtonStyle(currentTheme.id, 'danger')}`}
                  disabled={loggingOut}
                >
                  {loggingOut ? "Keluar..." : "Ya, Keluar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </PageWrapper>
  );
}
