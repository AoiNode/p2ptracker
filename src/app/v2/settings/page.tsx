"use client";
import { useRouter } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";
import { useSessionStore } from "@/stores/useSessionStore";
import { supabase } from "@/lib/supabaseClient";
import { formatIDR } from "@/lib/utils";
import { 
  ArrowLeft, Moon, Sun, Target, Bell, LogOut, 
  ChevronRight, Palette, Info, ToggleLeft
} from "lucide-react";
import { useState } from "react";

export default function V2Settings() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const targetMonthly = useSessionStore(s => s.targetMonthly);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showTarget, setShowTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState(targetMonthly.toString());
  const setTargetMonthly = useSessionStore(s => s.setTargetMonthly);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      router.push("/login");
    } catch (e) {
      console.error(e);
    } finally {
      setLoggingOut(false);
    }
  };

  const handleSaveTarget = async () => {
    const val = parseInt(tempTarget.replace(/\D/g, ""));
    if (val > 0) {
      await setTargetMonthly(val);
      setShowTarget(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Pengaturan</h1>
            <p className="text-xs text-gray-500 mt-0.5">Kelola preferensi aplikasi</p>
          </div>
        </div>
        
        {/* V1/V2 Switch */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-gray-500">V1</span>
          <button
            onClick={() => router.push("/")}
            className="relative inline-flex h-5 w-9 items-center rounded-full bg-emerald-500 transition-colors focus:outline-none"
          >
            <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm translate-x-4.5" />
          </button>
          <span className="text-[10px] font-medium text-emerald-400">V2</span>
        </div>
      </div>

      {/* Settings List */}
      <div className="space-y-2">
        {/* Dark Mode */}
        <button
          onClick={toggleTheme}
          className="w-full bg-[#111827] rounded-xl p-4 border border-white/[0.06] flex items-center gap-3 active:bg-white/5 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
            {isDark ? <Moon className="w-5 h-5 text-purple-400" /> : <Sun className="w-5 h-5 text-amber-400" />}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-white">Mode Gelap</p>
            <p className="text-[10px] text-gray-500">{isDark ? "Aktif" : "Nonaktif"}</p>
          </div>
          <div className={`w-10 h-6 rounded-full flex items-center transition-all ${isDark ? "bg-emerald-500 justify-end" : "bg-gray-600 justify-start"}`}>
            <div className="w-4 h-4 bg-white rounded-full mx-1 shadow-sm" />
          </div>
        </button>

        {/* Target Bulanan */}
        <button
          onClick={() => setShowTarget(true)}
          className="w-full bg-[#111827] rounded-xl p-4 border border-white/[0.06] flex items-center gap-3 active:bg-white/5 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <Target className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-white">Target Bulanan</p>
            <p className="text-[10px] text-gray-500">{formatIDR(targetMonthly)}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>

        {/* Telegram Bot */}
        <button
          onClick={() => router.push("/settings/telegram")}
          className="w-full bg-[#111827] rounded-xl p-4 border border-white/[0.06] flex items-center gap-3 active:bg-white/5 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 flex items-center justify-center">
            <Bell className="w-5 h-5 text-sky-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-white">Telegram Bot</p>
            <p className="text-[10px] text-gray-500">Hubungkan untuk notifikasi</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>

        {/* Switch to V1 */}
        <button
          onClick={() => router.push("/settings")}
          className="w-full bg-[#111827] rounded-xl p-4 border border-white/[0.06] flex items-center gap-3 active:bg-white/5 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
            <ToggleLeft className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-white">Mode V1</p>
            <p className="text-[10px] text-gray-500">Beralih ke interface klasik</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full bg-[#111827] rounded-xl p-4 border border-red-500/10 flex items-center gap-3 active:bg-red-500/10 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
            <LogOut className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-red-400">{loggingOut ? "Keluar..." : "Logout"}</p>
            <p className="text-[10px] text-gray-500">Keluar dari sesi saat ini</p>
          </div>
        </button>
      </div>

      {/* App Info */}
      <div className="mt-10 text-center">
        <p className="text-[10px] text-gray-600">ZigsAI P2P Tools v2.0.0</p>
        <p className="text-[10px] text-gray-700 mt-0.5">© 2025 ZigsAI Technology</p>
      </div>

      {/* Target Modal */}
      {showTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-[#111827] rounded-2xl p-5 w-full max-w-sm border border-white/[0.06]">
            <h3 className="text-sm font-bold text-white mb-3">Set Target Bulanan</h3>
            <input
              type="text"
              inputMode="numeric"
              value={tempTarget}
              onChange={e => setTempTarget(e.target.value)}
              className="w-full bg-[#0a0e1a] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 mb-4"
              placeholder="Masukkan target..."
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setTempTarget(targetMonthly.toString()); setShowTarget(false); }}
                className="flex-1 py-3 bg-white/5 text-gray-400 rounded-xl text-sm font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleSaveTarget}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl text-sm font-bold"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
