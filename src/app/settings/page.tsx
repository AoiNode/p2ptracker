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
    show: false, type: 'success', message: ''
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
