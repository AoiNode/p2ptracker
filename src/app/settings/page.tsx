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
  const [showFixConfirm, setShowFixConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [fixResult, setFixResult] = useState<{show: boolean, type: 'success' | 'error', message: string}>({
    show: false,
    type: 'success',
    message: ''
  });

  // Closing State
  const [showClosingConfirm, setShowClosingConfirm] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [closingStep, setClosingStep] = useState<'idle' | 'exporting' | 'sending' | 'cleaning'>('idle');
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

  const handleMonthlyClosing = async (skipCleaning = false) => {
    setIsClosing(true);
    setClosingStep('exporting');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Silakan login kembali");

      // 1. Get current month data from store
      const { transactions, sessionSales } = useSessionStore.getState();
      
      // 2. Prepare Excel
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      
      const txSheet = XLSX.utils.json_to_sheet(transactions.map(t => ({
        Tanggal: dayjs(t.tx_time).format('YYYY-MM-DD HH:mm'),
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
        USDT_Terjual: s.sold_usdt,
        Modal_IDR: s.cost_idr,
        Pendapatan_IDR: s.proceeds_idr,
        Profit_IDR: s.profit_idr
      })));
      XLSX.utils.book_append_sheet(wb, profitSheet, "Profit_FIFO");

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });

      // 3. Get Chat ID
      setClosingStep('sending');
      const linkResponse = await fetch('/api/telegram/link', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const linkData = await linkResponse.json();
      if (!linkData.linked || !linkData.account?.telegram_user_id) {
        throw new Error("Bot Telegram belum terhubung.");
      }

      // 4. Send to API
      if (!skipCleaning) setClosingStep('cleaning');
      
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
          skipCleaning: skipCleaning
        })
      });

      const result = await res.json();
      if (!res.ok) {
        if (result.partialSuccess) {
          setClosingResult({
            show: true,
            type: 'error',
            message: result.error
          });
          return;
        }
        throw new Error(result.error);
      }

      setClosingResult({
        show: true,
        type: 'success',
        message: skipCleaning 
          ? "Rekap Excel berhasil dikirim ke Telegram!" 
          : `Tutup Buku Berhasil! Rekap dikirim ke Telegram. ${result.archiveStats.deleted_transactions} data lama dibersihkan.`
      });

      if (!skipCleaning) {
        setTimeout(() => window.location.reload(), 5000);
      }

    } catch (e: any) {
      console.error(e);
      setClosingResult({
        show: true,
        type: 'error',
        message: e.message || "Gagal melakukan tutup buku"
      });
    } finally {
      setIsClosing(false);
      setClosingStep('idle');
      setShowClosingConfirm(false);
    }
  };

  const handleOnlyCleaning = async () => {
    setIsClosing(true);
    setClosingStep('cleaning');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Silakan login kembali");

      // Call the new V2 RPC
      const { data: archiveData, error: archiveError } = await supabase.rpc('archive_closed_data_v2', {
        target_user_id: session.user.id
      });

      if (archiveError) throw archiveError;

      setClosingResult({
        show: true,
        type: 'success',
        message: `Database berhasil dibersihkan! ${archiveData.deleted_transactions} data lama dihapus.`
      });

      setTimeout(() => window.location.reload(), 3000);
    } catch (e: any) {
      console.error(e);
      setClosingResult({
        show: true,
        type: 'error',
        message: e.message || "Gagal membersihkan database"
      });
    } finally {
      setIsClosing(false);
      setClosingStep('idle');
    }
  };

  const handleFixProfit = async () => {
    setIsFixing(true);
    // Close modal immediately or keep it open with loading state?
    // Let's keep modal open with loading state handled by ConfirmModal
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setFixResult({
          show: true,
          type: 'error',
          message: "Sesi tidak valid, silakan login ulang."
        });
        setIsFixing(false);
        setShowFixConfirm(false);
        return;
      }

      // 1. Check if RPC function is installed (Optional but helpful for diagnostics)
      // We skip this check to be faster and just try rebuild directly
      
      // Set timeout for fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout

      const res = await fetch('/api/rebuild-sales', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result.error || `Server error: ${res.status}`);
      }

      if (result.success) {
        setShowFixConfirm(false);
        
        let message = `Berhasil! ${result.stats.processedTxs} transaksi diproses & ${result.stats.newSalesRecords} record profit diperbarui.`;
        if (result.stats.method === 'rpc') {
          message += " (Mode Cepat RPC ✅)";
        } else {
          message += " (Mode Lambat JS ⚠️ - Mohon install fungsi SQL di dashboard untuk performa lebih baik)";
        }

        setFixResult({
          show: true,
          type: 'success',
          message: message
        });
        
        // Refresh data after short delay
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        throw new Error(result.error || "Gagal memperbaiki data");
      }
    } catch (e: any) {
      console.error(e);
      setShowFixConfirm(false);
      
      let errorMsg = "Terjadi kesalahan sistem";
      if (e.name === 'AbortError') {
        errorMsg = "Waktu habis (Timeout). Data Anda mungkin terlalu banyak. Silakan coba lagi nanti atau hubungi developer.";
      } else if (e.message) {
        errorMsg = e.message;
      }

      setFixResult({
        show: true,
        type: 'error',
        message: errorMsg
      });
    } finally {
      setIsFixing(false);
    }
  };

  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [checkingDebug, setCheckingDebug] = useState(false);

  const handleCheckData = async () => {
    setCheckingDebug(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Check Backend Data
      const res = await fetch('/api/debug-data', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const backendData = await res.json();

      // Check Frontend Data (RLS Check)
      const { count: frontendSalesCount, error: rlsError } = await supabase
        .from('session_sales')
        .select('*', { count: 'exact', head: true });

      setDebugInfo({
        backend: backendData,
        frontend: {
          salesCount: frontendSalesCount,
          rlsError: rlsError
        }
      });
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingDebug(false);
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
          {/* Section: Troubleshoot Data */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">
              Bantuan & Perbaikan Data
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-2 shadow-sm border border-gray-100 dark:border-gray-700">
              {/* Monthly Closing */}
              <div className="p-4 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-2xl transition-colors group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-xl text-purple-600 font-bold">
                      {isClosing ? (
                        <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                      ) : "📊"}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Tutup Buku Bulanan</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {closingStep === 'exporting' ? '📊 Menyiapkan Excel...' : 
                         closingStep === 'sending' ? '📤 Mengirim ke Telegram...' :
                         closingStep === 'cleaning' ? '🧹 Membersihkan Database...' :
                         'Kirim rekap Excel & reset riwayat'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowClosingConfirm(true)}
                    disabled={isClosing}
                    className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-600/20 disabled:opacity-50"
                  >
                    Tutup Buku
                  </button>
                  <button 
                    onClick={() => handleMonthlyClosing(true)}
                    disabled={isClosing}
                    className="px-3 py-2 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 text-[10px] font-bold rounded-xl hover:bg-purple-50 transition-all disabled:opacity-50"
                  >
                    Hanya Kirim Excel
                  </button>
                </div>
              </div>

              <div className="h-px bg-gray-100 dark:bg-gray-700 mx-4 my-1" />

              {/* Fix Profit */}
              <div className="p-4 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-2xl transition-colors group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center text-xl">
                      {isFixing ? (
                        <div className="w-5 h-5 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
                      ) : "🛠️"}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Sinkronisasi Sesi</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Perbaiki sisa saldo USDT yang tidak akurat</div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowFixConfirm(true)}
                    disabled={isFixing || isClosing}
                    className="flex-1 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-yellow-500/20 disabled:opacity-50"
                  >
                    Sinkronkan Sekarang
                  </button>
                  <button 
                    onClick={handleOnlyCleaning}
                    disabled={isFixing || isClosing}
                    className="px-3 py-2 border border-yellow-200 dark:border-yellow-800 text-yellow-600 dark:text-yellow-400 text-[10px] font-bold rounded-xl hover:bg-yellow-50 transition-all disabled:opacity-50"
                  >
                    Hanya Bersihkan Data
                  </button>
                </div>
              </div>
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

          {/* Section: Data & Diagnostik */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">
              Data & Diagnostik
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-2 shadow-sm border border-gray-100 dark:border-gray-700">
               {/* Fix Profit */}
               <button 
                onClick={() => setShowFixConfirm(true)}
                disabled={isFixing}
                className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-2xl transition-colors group disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center text-xl">
                      🛠️
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Perbaiki Data Profit</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                         Hitung ulang profit yang hilang
                      </div>
                    </div>
                  </div>
                  <div className="text-gray-400 group-hover:text-purple-500 transition-colors">→</div>
                </div>
              </button>

               {/* Debug Data */}
               <div className="h-px bg-gray-100 dark:bg-gray-700 mx-4 my-1" />
               <button 
                onClick={handleCheckData}
                disabled={checkingDebug}
                className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-2xl transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-xl">
                      🔍
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Cek Konsistensi Data</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                         {checkingDebug ? 'Memeriksa...' : 'Debug data sales & profit'}
                      </div>
                    </div>
                  </div>
                  <div className="text-gray-400 group-hover:text-purple-500 transition-colors">→</div>
                </div>
              </button>

              {debugInfo && (
                <div className="m-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-mono overflow-auto max-h-60 border border-gray-200 dark:border-gray-700">
                  <div className="mb-2 font-bold text-gray-700 dark:text-gray-300">Hasil Diagnosa:</div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <span className="text-gray-500">Backend Sales:</span>
                      <span className="ml-2 font-bold">{debugInfo.backend?.counts?.session_sales ?? '?'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Frontend Sales:</span>
                      <span className="ml-2 font-bold text-blue-600">{debugInfo.frontend?.salesCount ?? '?'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Profit (DB):</span>
                      <span className="ml-2 font-bold text-green-600">{formatIDR(debugInfo.backend?.financials?.total_profit_backend ?? 0)}</span>
                    </div>
                  </div>
                  {debugInfo.frontend?.rlsError && (
                    <div className="text-red-500 mb-2">
                      RLS Error: {debugInfo.frontend.rlsError.message}
                    </div>
                  )}
                  {debugInfo.backend?.counts?.session_sales !== debugInfo.frontend?.salesCount && (
                    <div className="text-orange-500 mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                      ⚠️ Data tidak sinkron! Kemungkinan karena limit query.
                      <br/>
                      Backend ({debugInfo.backend?.counts?.session_sales}) vs Frontend ({debugInfo.frontend?.salesCount})
                      <br/>
                      Sistem profit sudah menggunakan perhitungan server-side (RPC), jadi total profit di Dashboard tetap AKURAT meskipun angka ini beda.
                    </div>
                  )}
                </div>
              )}
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

        {/* Fix Confirmation Modal */}
        <ConfirmModal
          isOpen={showFixConfirm}
          onClose={() => !isFixing && setShowFixConfirm(false)}
          onConfirm={handleFixProfit}
          title="Perbaiki Data Profit?"
          message="Sistem akan menghitung ulang semua profit berdasarkan riwayat transaksi Anda. Proses ini aman dan dapat memperbaiki data yang hilang atau tidak sinkron."
          confirmText="Mulai Perbaikan"
          isLoading={isFixing}
          type="warning"
        />

        {/* Result Notification */}
        <PopupNotification
          show={fixResult.show}
          type={fixResult.type}
          title={fixResult.type === 'success' ? 'Perbaikan Berhasil' : 'Gagal Memperbaiki'}
          message={fixResult.message}
          onClose={() => setFixResult(prev => ({ ...prev, show: false }))}
        />

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
          message="Sistem akan mengirimkan rekap transaksi bulan ini ke Bot Telegram Anda (Excel), lalu menghapus riwayat transaksi lama yang sudah tertutup. Sesi yang masih aktif (ada sisa USDT) tetap dipertahankan. Lanjutkan?"
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
