"use client";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/stores/useSessionStore";
import { supabase } from "@/lib/supabaseClient";
import { formatIDR } from "@/lib/utils";
import { 
  ArrowLeft, Target, Bell, LogOut, 
  ChevronRight, ToggleLeft, BookOpen, Loader2, CheckCircle2, XCircle
} from "lucide-react";
import { useState } from "react";
import dayjs from "dayjs";

export default function V2Settings() {
  const router = useRouter();
  // Theme always dark in v2
  const targetMonthly = useSessionStore(s => s.targetMonthly);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showTarget, setShowTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState(targetMonthly.toString());
  const setTargetMonthly = useSessionStore(s => s.setTargetMonthly);

  // Closing state
  const [showClosingConfirm, setShowClosingConfirm] = useState(false);
  const [showClosingProgress, setShowClosingProgress] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [closingSteps, setClosingSteps] = useState<{
    snapshot: 'pending' | 'loading' | 'success' | 'error';
    excel: 'pending' | 'loading' | 'success' | 'error';
    tele: 'pending' | 'loading' | 'success' | 'error';
    db: 'pending' | 'loading' | 'success' | 'error';
  }>({ snapshot: 'pending', excel: 'pending', tele: 'pending', db: 'pending' });
  const [closingError, setClosingError] = useState<string | null>(null);
  const [closingResult, setClosingResult] = useState<{show: boolean; type: 'success' | 'error'; message: string}>({
    show: false, type: 'success', message: ''
  });

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

  const handleMonthlyClosing = async () => {
    setShowClosingConfirm(false);
    setShowClosingProgress(true);
    setIsClosing(true);
    setClosingError(null);
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
          Periode: 'TOTAL', Mulai: '', Sampai: '',
          Profit_IDR: totalProfitAll, Beli_IDR: totalBuyAll, Jual_IDR: totalSellAll,
          Jumlah_Transaksi: totalTxAll, Jumlah_Sell: totalSellCountAll
        }
      ]);
      XLSX.utils.book_append_sheet(wb, summarySheet, "Ringkasan_Bulanan");
      
      const txSheet = XLSX.utils.json_to_sheet(transactions.map(t => ({
        Tanggal: dayjs(t.tx_time).format('YYYY-MM-DD HH:mm'),
        Bulan: dayjs(t.tx_time).format('YYYY-MM'),
        Tipe: t.type, Exchange: t.label,
        Harga: t.price_idr, Jumlah_USDT: t.amount_usdt,
        Total_IDR: t.total_idr, Fee: t.fee_idr
      })));
      XLSX.utils.book_append_sheet(wb, txSheet, "Transaksi");

      const profitSheet = XLSX.utils.json_to_sheet(sessionSales.map(s => ({
        Tanggal_Jual: dayjs(s.created_at).format('YYYY-MM-DD HH:mm'),
        Bulan: dayjs(s.created_at).format('YYYY-MM'),
        USDT_Terjual: s.sold_usdt, Modal_IDR: s.cost_idr,
        Pendapatan_IDR: s.proceeds_idr, Profit_IDR: s.profit_idr
      })));
      XLSX.utils.book_append_sheet(wb, profitSheet, "Profit_FIFO");

      const snapshotSheet = XLSX.utils.json_to_sheet(snapshotList.map((s: any) => ({
        Tanggal_Sesi: s.created_at ? dayjs(s.created_at).format('YYYY-MM-DD HH:mm') : '',
        Harga: s.price_idr ?? s.avg_cost, Avg_Cost: s.avg_cost, Sisa_USDT: s.remaining_usdt
      })));
      XLSX.utils.book_append_sheet(wb, snapshotSheet, "Sisa_Sesi");

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      setClosingSteps(prev => ({ ...prev, excel: 'success', tele: 'loading' }));

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

  const stepIcon = (status: string) => {
    if (status === 'loading') return <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />;
    if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    if (status === 'error') return <XCircle className="w-4 h-4 text-red-400" />;
    return <div className="w-4 h-4 rounded-full border-2 border-gray-600" />;
  };

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header — no V1/V2 switch here */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Pengaturan</h1>
          <p className="text-xs text-gray-500 mt-0.5">Kelola preferensi aplikasi</p>
        </div>
      </div>

      {/* Settings List */}
      <div className="space-y-2">
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
          onClick={() => router.push("/v2/settings/telegram")}
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

        {/* Tutup Buku */}
        <button
          onClick={() => setShowClosingConfirm(true)}
          className="w-full bg-[#111827] rounded-xl p-4 border border-white/[0.06] flex items-center gap-3 active:bg-white/5 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-white">Tutup Buku</p>
            <p className="text-[10px] text-gray-500">Ekspor rekap & bersihkan riwayat lama</p>
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

      {/* Closing Confirm Modal */}
      {showClosingConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-[#111827] rounded-2xl p-5 w-full max-w-sm border border-white/[0.06]">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-amber-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Tutup Buku Bulanan?</h3>
              <p className="text-xs text-gray-500">Data akan di-export ke Telegram dan riwayat lama akan dibersihkan.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClosingConfirm(false)}
                className="flex-1 py-3 bg-white/5 text-gray-400 rounded-xl text-sm font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleMonthlyClosing}
                className="flex-1 py-3 bg-amber-500 text-white rounded-xl text-sm font-bold"
              >
                Ya, Tutup Buku
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Closing Progress Modal */}
      {showClosingProgress && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-[#111827] rounded-2xl p-5 w-full max-w-sm border border-white/[0.06]">
            {!closingResult.show ? (
              <>
                <h3 className="text-sm font-bold text-white mb-4 text-center">Proses Tutup Buku</h3>
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-3">
                    {stepIcon(closingSteps.snapshot)}
                    <span className="text-sm text-gray-300">Snapshot sesi aktif</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {stepIcon(closingSteps.excel)}
                    <span className="text-sm text-gray-300">Generate Excel</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {stepIcon(closingSteps.tele)}
                    <span className="text-sm text-gray-300">Kirim ke Telegram</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {stepIcon(closingSteps.db)}
                    <span className="text-sm text-gray-300">Bersihkan database</span>
                  </div>
                </div>
                {closingError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-3">
                    <p className="text-xs text-red-400">{closingError}</p>
                  </div>
                )}
                {!isClosing && (
                  <button
                    onClick={() => setShowClosingProgress(false)}
                    className="w-full py-3 bg-white/5 text-gray-400 rounded-xl text-sm font-medium"
                  >
                    Tutup
                  </button>
                )}
              </>
            ) : (
              <div className="text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-white mb-2">Berhasil!</h3>
                <p className="text-xs text-gray-400 mb-4">{closingResult.message}</p>
                <button
                  onClick={() => { setShowClosingProgress(false); setClosingResult({ show: false, type: 'success', message: '' }); }}
                  className="w-full py-3 bg-emerald-500 text-white rounded-xl text-sm font-bold"
                >
                  OK
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
