"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSessionStore } from "@/stores/useSessionStore";
import EditTransactionModal from "@/components/EditTransactionModal";
import { formatIDR } from "@/lib/utils";
import { Session, Transaction, SessionSale } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";
import { 
  ArrowLeft, Layers, Clock, TrendingUp, ArrowDownLeft, ArrowUpRight, 
  Pencil, Trash2, CheckCircle2, XCircle, AlertTriangle, Loader2
} from "lucide-react";
import dayjs from "dayjs";

export default function V2SessionDetail() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  
  const sessions = useSessionStore(s => s.sessions);
  const transactions = useSessionStore(s => s.transactions);
  const sessionSales = useSessionStore(s => s.sessionSales);
  const fetchAllSessions = useSessionStore(s => s.fetchAllSessions);
  
  const [session, setSession] = useState<Session | null>(null);
  const [sessionTxs, setSessionTxs] = useState<Transaction[]>([]);
  const [sales, setSales] = useState<SessionSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTxId, setDeleteTxId] = useState<string | null>(null);
  const [deleteTxTarget, setDeleteTxTarget] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteSession, setShowDeleteSession] = useState(false);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  useEffect(() => { fetchAllSessions(); }, [fetchAllSessions]);

  useEffect(() => {
    const foundSession = sessions.find((s: Session) => s.id === sessionId);
    if (foundSession) {
      setSession(foundSession);
      setSessionTxs(
        transactions.filter((t: Transaction) => t.session_id === sessionId)
          .sort((a, b) => new Date(b.tx_time).getTime() - new Date(a.tx_time).getTime())
      );
      setSales(sessionSales.filter((s: SessionSale) => s.session_id === sessionId));
    }
    if (sessions.length > 0) setLoading(false);
  }, [sessionId, sessions, transactions, sessionSales]);

  const roi = session && session.total_invest_idr > 0
    ? (session.realized_profit_idr / session.total_invest_idr) * 100 : 0;

  const handleDeleteSession = async () => {
    if (!session || isDeletingSession) return;
    setIsDeletingSession(true);
    try {
      const { data: salesData } = await supabase.from('session_sales').select('tx_id').eq('session_id', session.id);
      const sellTxIds = salesData?.map((s: any) => s.tx_id) || [];
      if (sellTxIds.length > 0) await supabase.from('transactions').delete().in('id', sellTxIds);
      await supabase.from('sessions').delete().eq('id', session.id);
      await fetchAllSessions();
      router.push('/v2/sessions');
    } catch (e) {
      console.error(e); alert('Gagal menghapus sesi');
    } finally { setIsDeletingSession(false); setShowDeleteSession(false); }
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const txToDelete = sessionTxs.find(t => t.id === txId) || transactions.find(t => t.id === txId);
      if (!txToDelete) throw new Error('Transaction not found');

      if (txToDelete.type === 'SELL') {
        await supabase.from('session_sales').delete().eq('tx_id', txId);
      }
      await supabase.from('transactions').delete().eq('id', txId);

      if (txToDelete.type === 'BUY' && session) {
        const { data: allBuyTxs } = await supabase
          .from('transactions').select('*').eq('session_id', session.id).eq('type', 'BUY').neq('id', txId);
        const otherBuyTxs = allBuyTxs || [];

        if (otherBuyTxs.length === 0) {
          const { data: relatedSales } = await supabase.from('session_sales').select('tx_id').eq('session_id', session.id);
          if (relatedSales && relatedSales.length > 0) {
            const sellTxIds = [...new Set(relatedSales.map((s: any) => s.tx_id))];
            for (const sid of sellTxIds) await supabase.from('transactions').delete().eq('id', sid);
            await supabase.from('session_sales').delete().eq('session_id', session.id);
          }
        } else {
          const newTotalBuyUsdt = otherBuyTxs.reduce((sum, t: any) => sum + t.amount_usdt, 0);
          const { data: relatedSales } = await supabase.from('session_sales').select('*').eq('session_id', session.id).order('created_at', { ascending: true });
          if (relatedSales && relatedSales.length > 0) {
            const totalSold = relatedSales.reduce((sum, s: any) => sum + s.sold_usdt, 0);
            if (totalSold > newTotalBuyUsdt) {
              let remaining = totalSold - newTotalBuyUsdt;
              for (const sale of [...relatedSales].reverse()) {
                if (remaining <= 0) break;
                if (sale.sold_usdt <= remaining) {
                  await supabase.from('transactions').delete().eq('id', sale.tx_id);
                  await supabase.from('session_sales').delete().eq('id', sale.id);
                  remaining -= sale.sold_usdt;
                } else {
                  const newSold = sale.sold_usdt - remaining;
                  const ratio = newSold / sale.sold_usdt;
                  await supabase.from('session_sales').update({
                    sold_usdt: newSold, proceeds_idr: sale.proceeds_idr * ratio,
                    cost_idr: sale.cost_idr * ratio, profit_idr: sale.profit_idr * ratio
                  }).eq('id', sale.id);
                  await supabase.from('transactions').update({
                    amount_usdt: newSold, total_idr: sale.proceeds_idr * ratio
                  }).eq('id', sale.tx_id);
                  remaining = 0;
                }
              }
            }
          }
        }

        const { data: remainingTxs } = await supabase.from('transactions').select('*').eq('session_id', session.id).eq('type', 'BUY').order('tx_time', { ascending: true });
        const newTotalInvest = remainingTxs?.reduce((sum: number, t: any) => sum + t.total_idr, 0) || 0;
        const newTotalUsdt = remainingTxs?.reduce((sum: number, t: any) => sum + t.amount_usdt, 0) || 0;
        const newAvgCost = newTotalUsdt > 0 ? newTotalInvest / newTotalUsdt : 0;
        const { data: salesData } = await supabase.from('session_sales').select('sold_usdt').eq('session_id', session.id);
        const totalSoldUsdt = salesData?.reduce((sum: number, s: any) => sum + s.sold_usdt, 0) || 0;
        const newRemaining = Math.max(0, newTotalUsdt - totalSoldUsdt);

        await supabase.from('sessions').update({
          total_invest_idr: newTotalInvest, total_usdt: newTotalUsdt,
          avg_cost: newAvgCost, remaining_usdt: newRemaining,
          status: newRemaining <= 0.01 ? 'closed' : 'active'
        }).eq('id', session.id);
      }

      await fetchAllSessions();
      setDeleteTxId(null); setDeleteTxTarget(null);
    } catch (e: any) {
      console.error(e); alert('Gagal menghapus transaksi: ' + e.message);
    } finally { setIsDeleting(false); }
  };

  const handleEditTransaction = async (updatedTx: Transaction) => {
    try {
      await supabase.from('transactions').update({
        price_idr: updatedTx.price_idr, amount_usdt: updatedTx.amount_usdt,
        total_idr: updatedTx.total_idr, label: updatedTx.label, fee_idr: updatedTx.fee_idr
      }).eq('id', updatedTx.id);

      if (updatedTx.type === 'BUY' && session) {
        const { data: allBuyTxs } = await supabase.from('transactions').select('*').eq('session_id', session.id).eq('type', 'BUY').order('tx_time', { ascending: true });
        const newTotalInvest = allBuyTxs?.reduce((sum: number, t: any) => sum + t.total_idr, 0) || 0;
        const newTotalUsdt = allBuyTxs?.reduce((sum: number, t: any) => sum + t.amount_usdt, 0) || 0;
        const newAvgCost = newTotalUsdt > 0 ? newTotalInvest / newTotalUsdt : 0;
        const { data: salesData } = await supabase.from('session_sales').select('sold_usdt').eq('session_id', session.id);
        const totalSoldUsdt = salesData?.reduce((sum: number, s: any) => sum + s.sold_usdt, 0) || 0;
        const newRemaining = Math.max(0, newTotalUsdt - totalSoldUsdt);
        await supabase.from('sessions').update({
          total_invest_idr: newTotalInvest, total_usdt: newTotalUsdt,
          avg_cost: newAvgCost, remaining_usdt: newRemaining,
          status: newRemaining <= 0.01 ? 'closed' : 'active'
        }).eq('id', session.id);
      }
      await fetchAllSessions();
      setIsModalOpen(false); setEditingTx(null);
    } catch (e: any) {
      console.error(e); alert('Gagal mengedit: ' + e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="px-4 pt-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-white/5 rounded-xl mb-4">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="text-center py-16 text-gray-500">
          <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Sesi tidak ditemukan</p>
        </div>
      </div>
    );
  }

  const isActive = session.status === "active" && session.remaining_usdt > 0.00000001;
  const progress = session.total_usdt > 0 ? ((session.total_usdt - session.remaining_usdt) / session.total_usdt) * 100 : 0;

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">Detail Sesi</h1>
            <p className="text-[10px] text-gray-500">#{session.id?.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditMode(!editMode)}
            className={`p-2.5 rounded-xl transition-all ${
              editMode ? "bg-emerald-500 text-white" : "bg-[#111827] text-gray-500 border border-white/[0.06]"
            }`}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowDeleteSession(true)}
            className="p-2.5 rounded-xl bg-[#111827] text-red-400 border border-red-500/10"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-800 text-gray-500'
        }`}>
          {isActive ? 'Sesi Aktif' : 'Sesi Selesai'}
        </span>
      </div>

      {/* Session Info Cards */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-[#111827] rounded-xl p-3.5 border border-white/[0.06]">
          <p className="text-[10px] text-gray-500 mb-0.5">Total Investasi</p>
          <p className="text-sm font-bold text-white">{formatIDR(session.total_invest_idr)}</p>
        </div>
        <div className="bg-[#111827] rounded-xl p-3.5 border border-white/[0.06]">
          <p className="text-[10px] text-gray-500 mb-0.5">Total USDT</p>
          <p className="text-sm font-bold text-white">{session.total_usdt.toFixed(2)} USDT</p>
        </div>
        <div className="bg-[#111827] rounded-xl p-3.5 border border-white/[0.06]">
          <p className="text-[10px] text-gray-500 mb-0.5">Avg Cost</p>
          <p className="text-sm font-bold text-white">{formatIDR(session.avg_cost)}</p>
        </div>
        <div className="bg-[#111827] rounded-xl p-3.5 border border-white/[0.06]">
          <p className="text-[10px] text-gray-500 mb-0.5">Sisa USDT</p>
          <p className="text-sm font-bold text-white">{session.remaining_usdt.toFixed(4)}</p>
        </div>
      </div>

      {/* Profit */}
      <div className="bg-[#111827] rounded-xl p-4 border border-white/[0.06] mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-500 mb-1">Realized Profit</p>
            <p className={`text-xl font-bold ${session.realized_profit_idr >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatIDR(session.realized_profit_idr)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-500 mb-1">ROI</p>
            <p className={`text-xl font-bold ${roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {roi.toFixed(2)}%
            </p>
          </div>
        </div>
        {isActive && (
          <div className="mt-3">
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-violet-400 rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-right text-[10px] text-gray-600 mt-1">{progress.toFixed(1)}% terjual</p>
          </div>
        )}
      </div>

      {/* Transactions */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <span className="w-1 h-4 bg-blue-500 rounded-full" />
          Riwayat Transaksi ({sessionTxs.length})
        </h3>
        <div className="space-y-2">
          {sessionTxs.map(tx => {
            const sale = sales.find(s => s.tx_id === tx.id);
            const isBuy = tx.type === 'BUY';
            return (
              <div key={tx.id} className={`bg-[#111827] rounded-xl p-3.5 border border-white/[0.06] relative overflow-hidden`}>
                <div className={`absolute top-0 left-0 w-1 h-full ${isBuy ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <div className="flex items-start pl-2.5">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                      }`}>
                        {tx.type}
                      </span>
                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {dayjs(tx.tx_time).format('DD MMM, HH:mm')}
                      </span>
                      {tx.label && (
                        <span className="text-[10px] bg-white/5 text-gray-400 px-1.5 py-0.5 rounded">{tx.label}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[10px] text-gray-600">Harga</p>
                        <p className="text-xs font-bold text-gray-300">{formatIDR(tx.price_idr)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-600">Jumlah</p>
                        <p className="text-xs font-bold text-gray-300">{tx.amount_usdt.toFixed(2)} USDT</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-600">Total</p>
                        <p className="text-xs font-bold text-white">{formatIDR(tx.total_idr)}</p>
                      </div>
                    </div>
                    {sale && (
                      <div className="mt-1.5 pt-1.5 border-t border-white/[0.06]">
                        <span className={`text-[10px] font-medium ${sale.profit_idr >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          Profit: {formatIDR(sale.profit_idr)} ({((sale.profit_idr / sale.cost_idr) * 100).toFixed(2)}%)
                        </span>
                      </div>
                    )}
                  </div>
                  {editMode && (
                    <div className="flex flex-col gap-1.5 ml-2">
                      <button onClick={() => { setEditingTx(tx); setIsModalOpen(true); }}
                        className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors">
                        <Pencil className="w-3.5 h-3.5 text-blue-400" />
                      </button>
                      <button onClick={() => { setDeleteTxTarget(tx); setDeleteTxId(tx.id!); }}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {sessionTxs.length === 0 && (
            <div className="text-center py-8 text-gray-600">
              <p className="text-sm">Belum ada transaksi</p>
            </div>
          )}
        </div>
      </div>

      {/* Sales History */}
      {sales.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-purple-500 rounded-full" />
            Detail Penjualan ({sales.length})
          </h3>
          <div className="space-y-2">
            {sales.map(sale => {
              const tx = transactions.find(t => t.id === sale.tx_id) || sessionTxs.find(t => t.id === sale.tx_id);
              if (!tx) return null;
              return (
                <div key={sale.id} className="bg-[#111827] rounded-xl p-3.5 border border-white/[0.06] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
                  <div className="pl-2.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/15 text-purple-400">SOLD</span>
                      <span className="text-[10px] text-gray-500">{dayjs(sale.created_at || tx.tx_time).format('DD MMM, HH:mm')}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[10px] text-gray-600">Harga Jual</p>
                        <p className="text-xs font-bold text-gray-300">{formatIDR(tx.price_idr)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-600">Terjual</p>
                        <p className="text-xs font-bold text-gray-300">{sale.sold_usdt.toFixed(4)} USDT</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-600">Profit</p>
                        <p className={`text-xs font-bold ${sale.profit_idr >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatIDR(sale.profit_idr)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <EditTransactionModal
        transaction={editingTx}
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingTx(null); }}
        onSave={handleEditTransaction}
      />

      {/* Delete Transaction Confirm */}
      {deleteTxId && deleteTxTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center px-4">
          <div className="bg-[#111827] rounded-2xl p-5 w-full max-w-sm border border-white/[0.06]">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Hapus Transaksi {deleteTxTarget.type}?</h3>
              <p className="text-xs text-gray-500">{deleteTxTarget.amount_usdt.toFixed(2)} USDT • {formatIDR(deleteTxTarget.total_idr)}</p>
            </div>
            {deleteTxTarget.type === 'BUY' && sessionTxs.filter(t => t.type === 'BUY').length === 1 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4">
                <p className="text-[10px] text-amber-400">⚠️ Pembelian terakhir. Semua penjualan terkait juga akan dihapus.</p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setDeleteTxId(null); setDeleteTxTarget(null); }} disabled={isDeleting}
                className="flex-1 py-3 bg-white/5 text-gray-400 rounded-xl text-sm font-medium disabled:opacity-50">Batal</button>
              <button onClick={() => handleDeleteTransaction(deleteTxId)} disabled={isDeleting}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {isDeleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Session Confirm */}
      {showDeleteSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-[#111827] rounded-2xl p-5 w-full max-w-sm border border-white/[0.06]">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Hapus Sesi?</h3>
              <p className="text-xs text-gray-500">Sesi dan semua transaksi terkait akan dihapus permanen.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteSession(false)} disabled={isDeletingSession}
                className="flex-1 py-3 bg-white/5 text-gray-400 rounded-xl text-sm font-medium disabled:opacity-50">Batal</button>
              <button onClick={handleDeleteSession} disabled={isDeletingSession}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {isDeletingSession ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
