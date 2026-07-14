"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSessionStore } from "@/stores/useSessionStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatIDR } from "@/lib/utils";
import { Transaction, Session, SessionSale, ExchangeLabel } from "@/lib/types";
import { deleteTransaction } from "@/lib/transactionService";
import { supabase } from "@/lib/supabaseClient";
import EditTransactionModal from "@/components/EditTransactionModal";
import dayjs from "dayjs";
import "dayjs/locale/id";
import { 
  ArrowLeft, ArrowDownLeft, ArrowUpRight, Edit3, Trash2, 
  Clock, Building2, Coins, DollarSign, Hash, AlertTriangle,
  CheckCircle, X
} from "lucide-react";

dayjs.locale("id");

export default function V2TransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const sessions = useSessionStore(s => s.sessions);
  const sessionSales = useSessionStore(s => s.sessionSales);
  const fetchAllSessions = useSessionStore(s => s.fetchAllSessions);
  
  const [tx, setTx] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [salesDetails, setSalesDetails] = useState<any[]>([]);

  useEffect(() => {
    if (user && id) {
      fetchTransaction();
      fetchAllSessions();
    }
  }, [user, id]);

  const fetchTransaction = async () => {
    setIsLoading(true);
    try {
      // Try enriched first
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return;
      
      const { data, error } = await supabase.rpc('get_recent_activities', { 
        target_user_id: u.id, limit_count: 1000 
      });
      
      if (!error && data) {
        const found = data.find((t: Transaction) => t.id === id);
        if (found) {
          setTx(found);
          // Build sales details for SELL
          if (found.type === 'SELL' && found.id) {
            buildSalesDetails(found);
          }
          setIsLoading(false);
          return;
        }
      }
      
      // Fallback: direct query
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .single();
      
      if (!txError && txData) {
        setTx(txData);
        if (txData.type === 'SELL') {
          buildSalesDetails(txData);
        }
      }
    } catch (err) {
      console.error("Error fetching transaction", err);
    } finally {
      setIsLoading(false);
    }
  };

  const buildSalesDetails = async (transaction: Transaction) => {
    try {
      const { data: sales } = await supabase
        .from('session_sales')
        .select('*')
        .eq('tx_id', transaction.id);
      
      if (sales && sales.length > 0) {
        const details = sales.map(sale => {
          const session = sessions.find(s => s.id === sale.session_id);
          return {
            sessionDate: session ? dayjs(session.created_at).format('DD MMM YYYY') : '-',
            usdt: sale.sold_usdt,
            profit: sale.profit_idr,
            cost: sale.cost_idr,
            avgCost: session?.avg_cost || 0,
            proceeds: sale.proceeds_idr
          };
        });
        setSalesDetails(details);
      }
    } catch (err) {
      console.error("Error building sales details", err);
    }
  };

  const handleDelete = async () => {
    if (!tx?.id) return;
    setIsDeleting(true);
    try {
      await deleteTransaction(tx.id);
      await fetchAllSessions();
      setShowDeleteConfirm(false);
      router.push('/v2/transaksi');
    } catch (err) {
      console.error("Error deleting transaction", err);
      alert("Gagal menghapus transaksi: " + (err as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditSave = async (id: string, price: number, amount: number, fee: number, feeType: 'percent' | 'value', txTime: Date, label?: ExchangeLabel) => {
    try {
      const baseTotal = amount * price;
      let total = baseTotal;
      
      if (tx?.type === 'BUY' && label === 'Tokocrypto') {
        total = baseTotal * 1.00075;
      } else {
        const feeCalc = feeType === 'percent' ? (baseTotal * fee / 100) : fee;
        total = baseTotal - feeCalc;
      }
      
      const feeIdr = fee > 0 ? (feeType === 'percent' ? (baseTotal * fee / 100) : fee) : 0;
      
      // Handle SELL → recalculate session_sales
      if (tx?.type === 'SELL') {
        const { data: oldSales } = await supabase
          .from('session_sales').select('*').eq('tx_id', id);
        if (oldSales && oldSales.length > 0) {
          await supabase.from('session_sales').delete().eq('tx_id', id);
        }
        
        const { data: { user: u } } = await supabase.auth.getUser();
        if (!u) throw new Error('User not authenticated');
        
        const { data: availableSessions } = await supabase
          .from('sessions').select('*')
          .eq('user_id', u.id).gt('remaining_usdt', 0)
          .order('created_at', { ascending: true });
        
        if (availableSessions && availableSessions.length > 0) {
          let remainingToSell = amount;
          for (const session of availableSessions) {
            if (remainingToSell <= 0) break;
            if (session.remaining_usdt <= 0) continue;
            const soldFromSession = Math.min(remainingToSell, session.remaining_usdt);
            const proceedsFromSession = soldFromSession * price;
            const costFromSession = soldFromSession * session.avg_cost;
            const profitFromSession = proceedsFromSession - costFromSession;
            await supabase.from('session_sales').insert({
              session_id: session.id, tx_id: id,
              sold_usdt: soldFromSession, proceeds_idr: proceedsFromSession,
              cost_idr: costFromSession, profit_idr: profitFromSession
            });
            const newRemaining = session.remaining_usdt - soldFromSession;
            await supabase.from('sessions').update({
              remaining_usdt: newRemaining,
              realized_profit_idr: session.realized_profit_idr + profitFromSession,
              status: newRemaining <= 0.0001 ? 'closed' : 'active'
            }).eq('id', session.id);
            remainingToSell -= soldFromSession;
            session.remaining_usdt = newRemaining;
          }
        }
      } else if (tx?.type === 'BUY' && tx.session_id) {
        const { data: session } = await supabase
          .from('sessions').select('*').eq('id', tx.session_id).single();
        if (session) {
          const amountDiff = amount - tx.amount_usdt;
          const totalDiff = total - tx.total_idr;
          const newTotalUsdt = session.total_usdt + amountDiff;
          const newRemaining = session.remaining_usdt + amountDiff;
          const newTotalInvest = session.total_invest_idr + totalDiff;
          await supabase.from('sessions').update({
            price_idr: price, total_usdt: newTotalUsdt,
            remaining_usdt: newRemaining, total_invest_idr: newTotalInvest,
            avg_cost: newTotalUsdt > 0 ? newTotalInvest / newTotalUsdt : price
          }).eq('id', tx.session_id);
        }
      }
      
      const { error } = await supabase.from('transactions').update({
        price_idr: price, amount_usdt: amount, total_idr: total,
        fee_idr: feeIdr, tx_time: txTime.toISOString(), label: label || 'Binance'
      }).eq('id', id);
      if (error) throw error;
      
      await fetchAllSessions();
      await fetchTransaction();
      setShowEditModal(false);
    } catch (err) {
      console.error("Error updating transaction", err);
      alert("Gagal mengupdate transaksi: " + (err as Error).message);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex flex-col items-center justify-center px-4">
        <p className="text-gray-500 mb-4">Transaksi tidak ditemukan</p>
        <button onClick={() => router.push('/v2/transaksi')} className="text-emerald-400 text-sm font-medium">
          ← Kembali
        </button>
      </div>
    );
  }

  const isBuy = tx.type === "BUY";
  const baseTotal = tx.amount_usdt * tx.price_idr;
  const feeAmount = tx.fee_idr || 0;
  
  // Get session info for BUY
  const relatedSession = tx.session_id ? sessions.find(s => s.id === tx.session_id) : null;
  
  // Profit for SELL
  const totalProfit = tx.profit_idr ?? salesDetails.reduce((s, d) => s + d.profit, 0);
  const totalCost = salesDetails.reduce((s, d) => s + d.cost, 0);
  const profitPercent = totalCost > 0 ? (totalProfit / totalCost * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0a0e1a] pb-8">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0a0e1a]/90 backdrop-blur-lg border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl text-gray-400 active:bg-white/5">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-white">Detail Transaksi</h1>
          <div className="w-9" />
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Hero Card */}
        <div className={`rounded-2xl p-5 border ${
          isBuy 
            ? "bg-emerald-500/[0.07] border-emerald-500/20" 
            : "bg-red-500/[0.07] border-red-500/20"
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                isBuy ? "bg-emerald-500/20" : "bg-red-500/20"
              }`}>
                {isBuy 
                  ? <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                  : <ArrowUpRight className="w-5 h-5 text-red-400" />
                }
              </div>
              <div>
                <span className={`text-sm font-bold ${isBuy ? "text-emerald-400" : "text-red-400"}`}>
                  {isBuy ? "PEMBELIAN" : "PENJUALAN"}
                </span>
                {tx.label && (
                  <p className="text-[10px] text-gray-500 mt-0.5">{tx.label}</p>
                )}
              </div>
            </div>
            <span className="text-[10px] text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {dayjs(tx.tx_time).format("DD MMM YYYY • HH:mm")}
            </span>
          </div>
          
          <div className="text-center">
            <p className="text-[10px] text-gray-500 mb-1">Total Transaksi</p>
            <p className={`text-2xl font-bold ${isBuy ? "text-emerald-400" : "text-red-400"}`}>
              {isBuy ? "-" : "+"}{formatIDR(Math.round(tx.total_idr))}
            </p>
          </div>

          {/* Profit info for SELL */}
          {!isBuy && totalProfit !== 0 && (
            <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-center gap-2">
              <span className={`text-xs font-medium ${totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {totalProfit >= 0 ? "▲" : "▼"} {formatIDR(Math.round(totalProfit))}
              </span>
              <span className={`text-[10px] ${totalProfit >= 0 ? "text-emerald-400/60" : "text-red-400/60"}`}>
                ({profitPercent.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>

        {/* Reference */}
        <div className="bg-[#111827] rounded-xl p-3.5 border border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hash className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-[10px] text-gray-500">No. Referensi</span>
            </div>
            <span className="text-xs font-mono text-gray-300">
              {tx.id ? tx.id.substring(0, 12).toUpperCase() : '-'}
            </span>
          </div>
        </div>

        {/* Detail Card */}
        <div className="bg-[#111827] rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/[0.06]">
            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Detail Transaksi</p>
          </div>
          
          <div className="p-4 space-y-3">
            {/* Exchange */}
            {tx.label && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-gray-600" />
                  <span className="text-xs text-gray-400">Exchange</span>
                </div>
                <span className="text-xs text-white font-medium">{tx.label}</span>
              </div>
            )}
            
            {/* Jumlah USDT */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-3.5 h-3.5 text-gray-600" />
                <span className="text-xs text-gray-400">Jumlah</span>
              </div>
              <span className="text-xs text-white font-medium font-mono">{tx.amount_usdt.toFixed(4)} USDT</span>
            </div>
            
            {/* Harga */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-gray-600" />
                <span className="text-xs text-gray-400">Harga</span>
              </div>
              <span className="text-xs text-white font-medium">{formatIDR(tx.price_idr)}/USDT</span>
            </div>
            
            {/* Subtotal */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 pl-5.5">Subtotal</span>
              <span className="text-xs text-gray-300 font-mono">{formatIDR(Math.round(baseTotal))}</span>
            </div>
            
            {/* Fee */}
            {feeAmount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 pl-5.5">Biaya Admin</span>
                <span className="text-xs text-gray-300 font-mono">{formatIDR(Math.round(feeAmount))}</span>
              </div>
            )}
          </div>
        </div>

        {/* Session Info for BUY */}
        {isBuy && relatedSession && (
          <div className="bg-[#111827] rounded-xl border border-white/[0.06] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/[0.06]">
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Info Sesi</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Status</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  relatedSession.status === 'active' 
                    ? 'bg-emerald-500/20 text-emerald-400' 
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {relatedSession.status === 'active' ? 'AKTIF' : 'SELESAI'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Total Invest</span>
                <span className="text-xs text-white font-medium">{formatIDR(Math.round(relatedSession.total_invest_idr))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Avg Cost</span>
                <span className="text-xs text-white font-medium">{formatIDR(Math.round(relatedSession.avg_cost))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Sisa USDT</span>
                <span className="text-xs text-emerald-400 font-medium font-mono">{relatedSession.remaining_usdt.toFixed(4)} USDT</span>
              </div>
              
              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>Progress</span>
                  <span>{((1 - relatedSession.remaining_usdt / relatedSession.total_usdt) * 100).toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all" 
                    style={{ width: `${Math.min(100, (1 - relatedSession.remaining_usdt / relatedSession.total_usdt) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Link to session */}
              <button
                onClick={() => router.push(`/v2/sessions/${relatedSession.id}`)}
                className="w-full py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 font-medium active:bg-emerald-500/20"
              >
                Lihat Detail Sesi →
              </button>
            </div>
          </div>
        )}

        {/* FIFO Details for SELL */}
        {!isBuy && salesDetails.length > 0 && (
          <div className="bg-[#111827] rounded-xl border border-white/[0.06] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/[0.06]">
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Sumber Aset (FIFO)</p>
            </div>
            <div className="p-4 space-y-2.5">
              {salesDetails.map((detail, idx) => (
                <div key={idx} className="bg-[#0a0e1a] rounded-lg p-3 border border-white/[0.04]">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[10px] text-gray-400">Beli {detail.sessionDate}</span>
                    </div>
                    <span className={`text-[10px] font-medium ${detail.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {detail.profit >= 0 ? "+" : ""}{formatIDR(Math.round(detail.profit))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 font-mono">
                      {detail.usdt.toFixed(4)} USDT @ {formatIDR(Math.round(detail.avgCost))}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      Cost: {formatIDR(Math.round(detail.cost))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="flex items-center justify-center gap-2 py-3.5 bg-[#111827] border border-white/[0.06] rounded-xl text-emerald-400 text-sm font-medium active:bg-white/5 transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center justify-center gap-2 py-3.5 bg-[#111827] border border-red-500/20 rounded-xl text-red-400 text-sm font-medium active:bg-red-500/5 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Hapus
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => !isDeleting && setShowDeleteConfirm(false)}>
          <div className="bg-[#111827] rounded-2xl border border-white/[0.06] max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
            <h3 className="text-base font-bold text-white text-center mb-2">Hapus Transaksi?</h3>
            <p className="text-xs text-gray-500 text-center mb-5">
              Transaksi yang dihapus tidak dapat dikembalikan. Yakin ingin melanjutkan?
            </p>
            
            <div className="bg-[#0a0e1a] rounded-xl p-3 mb-5 border border-white/[0.04]">
              <p className="text-[10px] text-gray-500 mb-1">Detail yang akan dihapus:</p>
              <p className="text-xs text-white font-medium">
                {tx.type === 'BUY' ? 'Pembelian' : 'Penjualan'} {tx.amount_usdt.toFixed(4)} USDT
              </p>
              <p className="text-[10px] text-gray-400 mt-1">Total: {formatIDR(Math.round(tx.total_idr))}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-white/[0.06] rounded-xl text-gray-400 text-sm font-medium disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-red-600 rounded-xl text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Menghapus...
                  </>
                ) : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && tx && (
        <EditTransactionModal
          isOpen={showEditModal}
          transaction={tx}
          onClose={() => setShowEditModal(false)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}
