"use client";
import { useEffect, useState } from "react";
import { useSessionStore } from "@/stores/useSessionStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatIDR } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Session } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";
import { 
  Layers, Clock, TrendingUp, 
  ArrowDownLeft, CircleDot, CheckCircle2,
  Pencil, Trash2, X, ChevronRight
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/id";

dayjs.extend(relativeTime);
dayjs.locale("id");

export default function V2Sessions() {
  const { user } = useAuth();
  const router = useRouter();
  const fetchAllSessions = useSessionStore(s => s.fetchAllSessions);
  const sessions = useSessionStore(s => s.sessions);
  const transactions = useSessionStore(s => s.transactions);
  const sessionSales = useSessionStore(s => s.sessionSales);
  const [tab, setTab] = useState<"active" | "closed">("active");
  
  // Action sheet state
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (user) fetchAllSessions();
  }, [user]);

  const activeSessions = sessions
    .filter(s => s.status === "active" || s.remaining_usdt > 0.00000001)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const closedSessions = sessions
    .filter(s => s.status === "closed" && s.remaining_usdt <= 0.00000001)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const displaySessions = tab === "active" ? activeSessions : closedSessions;

  const totalCapital = activeSessions.reduce((s, sess) => s + sess.total_invest_idr, 0);
  const totalRemainingUSDT = activeSessions.reduce((s, sess) => s + sess.remaining_usdt, 0);
  const totalProfit = activeSessions.reduce((s, sess) => s + sess.realized_profit_idr, 0);

  const handleSessionClick = (sess: Session) => {
    setSelectedSession(sess);
    setShowActionSheet(true);
  };

  const handleDeleteSession = async () => {
    if (!selectedSession || isDeleting) return;
    setIsDeleting(true);
    
    try {
      // Get related sell transactions
      const { data: salesData } = await supabase
        .from('session_sales')
        .select('tx_id')
        .eq('session_id', selectedSession.id);
      
      const sellTxIds = salesData?.map((s: any) => s.tx_id) || [];
      if (sellTxIds.length > 0) {
        await supabase.from('transactions').delete().in('id', sellTxIds);
      }
      
      await supabase.from('sessions').delete().eq('id', selectedSession.id);
      
      await fetchAllSessions();
      setShowActionSheet(false);
      setDeleteConfirm(false);
      setSelectedSession(null);
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Gagal menghapus sesi');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewDetail = () => {
    if (selectedSession?.id) {
      router.push(`/sessions/${selectedSession.id}`);
      setShowActionSheet(false);
      setSelectedSession(null);
    }
  };

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Sesi Investasi</h1>
        <p className="text-xs text-gray-500 mt-0.5">Tracking batch pembelian USDT</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="bg-[#111827] rounded-xl p-3 border border-white/[0.06]">
          <Layers className="w-4 h-4 text-purple-400 mb-1" />
          <p className="text-[10px] text-gray-500">Aktif</p>
          <p className="text-sm font-bold text-white">{activeSessions.length}</p>
        </div>
        <div className="bg-[#111827] rounded-xl p-3 border border-white/[0.06]">
          <ArrowDownLeft className="w-4 h-4 text-blue-400 mb-1" />
          <p className="text-[10px] text-gray-500">USDT Tersisa</p>
          <p className="text-sm font-bold text-white">{totalRemainingUSDT.toFixed(2)}</p>
        </div>
        <div className="bg-[#111827] rounded-xl p-3 border border-white/[0.06]">
          <TrendingUp className="w-4 h-4 text-emerald-400 mb-1" />
          <p className="text-[10px] text-gray-500">Profit Real.</p>
          <p className="text-sm font-bold text-emerald-400">{formatIDR(totalProfit)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-4 bg-[#111827] rounded-xl p-1 border border-white/[0.06]">
        <button
          onClick={() => setTab("active")}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
            tab === "active" ? "bg-emerald-500/20 text-emerald-400" : "text-gray-500"
          }`}
        >
          Aktif ({activeSessions.length})
        </button>
        <button
          onClick={() => setTab("closed")}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
            tab === "closed" ? "bg-gray-700 text-gray-300" : "text-gray-500"
          }`}
        >
          Selesai ({closedSessions.length})
        </button>
      </div>

      {/* Session List */}
      <div className="space-y-2">
        {displaySessions.map((sess, i) => {
          const progress = sess.total_usdt > 0 
            ? ((sess.total_usdt - sess.remaining_usdt) / sess.total_usdt) * 100 
            : 0;
          const avgCost = sess.avg_cost;
          const isActive = sess.status === "active" && sess.remaining_usdt > 0.00000001;

          return (
            <div 
              key={sess.id || i} 
              onClick={() => handleSessionClick(sess)}
              className="bg-[#111827] rounded-xl p-4 border border-white/[0.06] cursor-pointer active:bg-white/5 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isActive ? "bg-purple-500/15" : "bg-gray-800"
                  }`}>
                    {isActive 
                      ? <CircleDot className="w-4 h-4 text-purple-400" />
                      : <CheckCircle2 className="w-4 h-4 text-gray-600" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">
                      {formatIDR(sess.total_invest_idr)}
                    </p>
                    <p className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {dayjs(sess.created_at).format("DD MMM YYYY • HH:mm")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    isActive 
                      ? "bg-emerald-500/15 text-emerald-400" 
                      : "bg-gray-800 text-gray-500"
                  }`}>
                    {isActive ? "Aktif" : "Selesai"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <p className="text-[10px] text-gray-600">Avg Cost</p>
                  <p className="text-xs font-bold text-gray-300">{formatIDR(avgCost)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-600">Sisa USDT</p>
                  <p className="text-xs font-bold text-gray-300">{sess.remaining_usdt.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-600">Profit</p>
                  <p className={`text-xs font-bold ${sess.realized_profit_idr >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {formatIDR(sess.realized_profit_idr)}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              {isActive && (
                <div>
                  <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-violet-400 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-right text-[10px] text-gray-600 mt-1">{progress.toFixed(1)}% terjual</p>
                </div>
              )}
            </div>
          );
        })}

        {displaySessions.length === 0 && (
          <div className="text-center py-12 text-gray-600">
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {tab === "active" ? "Tidak ada sesi aktif" : "Tidak ada sesi selesai"}
            </p>
          </div>
        )}
      </div>

      {/* Action Sheet */}
      {showActionSheet && selectedSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div 
              className="bg-[#111827] rounded-t-2xl p-5 border-t border-white/[0.06]"
              onClick={() => { setShowActionSheet(false); setSelectedSession(null); }}
            >
              <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4" />
              
              <div className="mb-4">
                <p className="text-sm font-bold text-white mb-1">Sesi #{selectedSession.id?.slice(0, 8)}</p>
                <p className="text-xs text-gray-500">
                  {formatIDR(selectedSession.total_invest_idr)} • {selectedSession.remaining_usdt.toFixed(4)} USDT tersisa
                </p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleViewDetail}
                  className="w-full py-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm font-medium text-emerald-400 flex items-center justify-center gap-2 active:bg-emerald-500/20"
                >
                  <Pencil className="w-4 h-4" />
                  Detail & Edit
                </button>
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="w-full py-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm font-medium text-red-400 flex items-center justify-center gap-2 active:bg-red-500/20"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus Sesi
                </button>
                <button
                  onClick={() => { setShowActionSheet(false); setSelectedSession(null); }}
                  className="w-full py-3.5 bg-white/5 rounded-xl text-sm font-medium text-gray-400"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && selectedSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center px-4">
          <div className="bg-[#111827] rounded-2xl p-5 w-full max-w-sm border border-white/[0.06]">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Hapus Sesi?</h3>
              <p className="text-xs text-gray-500">Sesi dan semua transaksi terkait akan dihapus. Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="flex-1 py-3 bg-white/5 text-gray-400 rounded-xl text-sm font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteSession}
                disabled={isDeleting}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-bold disabled:opacity-50"
              >
                {isDeleting ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
