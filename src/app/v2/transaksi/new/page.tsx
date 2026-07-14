"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/stores/useSessionStore";
import { Session, ExchangeLabel } from "@/lib/types";
import { formatIDR } from "@/lib/utils";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Check, Upload } from "lucide-react";
import dynamic from "next/dynamic";

const ImportTransactionModal = dynamic(() => import("@/components/ImportTransactionModal"), { ssr: false });

const exchanges: ExchangeLabel[] = ["Binance", "Bybit", "OKX", "Bitget", "Tokocrypto", "Other"];

type TabType = "BUY" | "SELL" | "IMPORT";

export default function V2NewTransaction() {
  const router = useRouter();
  const addBuySessionSmart = useSessionStore(s => s.addBuySessionSmart);
  const addSmartSell = useSessionStore(s => s.addSmartSell);
  const fetchAllSessions = useSessionStore(s => s.fetchAllSessions);
  const getActiveSessions = useSessionStore(s => s.getActiveSessions);

  const [tab, setTab] = useState<TabType>("BUY");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState<ExchangeLabel>("Bybit");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [showImport, setShowImport] = useState(false);
  
  // Fee state
  const [fee, setFee] = useState(0);
  const [feeType, setFeeType] = useState<'percent' | 'value'>('percent');
  
  // Input mode toggle
  const [buyInputMode, setBuyInputMode] = useState<'idr' | 'usdt'>('idr');
  const [sellInputMode, setSellInputMode] = useState<'usdt' | 'idr'>('usdt');
  
  // Date/time
  const [txDate, setTxDate] = useState('');
  const [txTime, setTxTime] = useState('');
  
  // Active sessions for sell
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [totalAvailableUSDT, setTotalAvailableUSDT] = useState(0);

  // Initialize date/time
  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    setTxDate(`${y}-${m}-${d}`);
    setTxTime(`${h}:${mi}:${s}`);
  }, [tab]);

  // Fetch active sessions for sell
  useEffect(() => {
    fetchAllSessions().then(() => {
      const sessions = getActiveSessions();
      setActiveSessions(sessions);
      setTotalAvailableUSDT(sessions.reduce((sum, s) => sum + (s.remaining_usdt || 0), 0));
    });
  }, [fetchAllSessions, getActiveSessions]);

  const priceNum = parseFloat(price.replace(/[^\d]/g, "")) || 0;
  const amountNum = parseFloat(amount.replace(/[^\d]/g, "")) || 0;
  
  // Calculate based on input mode
  const calcUsdt = () => {
    if (tab === "BUY") {
      if (buyInputMode === 'idr') {
        const feeAmt = feeType === 'percent' ? (amountNum * fee / 100) : fee;
        return priceNum > 0 ? (amountNum - feeAmt) / priceNum : 0;
      } else {
        return amountNum; // User directly enters USDT
      }
    } else {
      if (sellInputMode === 'usdt') {
        return amountNum;
      } else {
        // IDR mode: calculate USDT from IDR
        return priceNum > 0 ? (amountNum + (feeType === 'percent' ? amountNum * fee / 100 : fee)) / priceNum : 0;
      }
    }
  };
  
  const calcIdr = () => {
    if (tab === "BUY") {
      if (buyInputMode === 'idr') {
        return amountNum;
      } else {
        const baseIdr = amountNum * priceNum;
        const feeAmt = feeType === 'percent' ? (baseIdr * fee / 100) : fee;
        return baseIdr + feeAmt;
      }
    } else {
      if (sellInputMode === 'usdt') {
        const feeAmt = feeType === 'percent' ? (amountNum * priceNum * fee / 100) : fee;
        return amountNum * priceNum - feeAmt;
      } else {
        return amountNum;
      }
    }
  };

  const usdtEstimate = calcUsdt();
  const idrEstimate = calcIdr();
  const feeAmount = feeType === 'percent' 
    ? (tab === "BUY" 
        ? (buyInputMode === 'idr' ? amountNum * fee / 100 : amountNum * priceNum * fee / 100)
        : (sellInputMode === 'usdt' ? amountNum * priceNum * fee / 100 : amountNum * fee / 100))
    : fee;

  const handleSubmit = async () => {
    if (!priceNum || !amountNum) {
      setError("Harga dan jumlah wajib diisi");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const txDateTime = new Date(`${txDate}T${txTime}`);
      
      if (tab === "BUY") {
        const totalIdr = buyInputMode === 'idr' ? amountNum : idrEstimate;
        await addBuySessionSmart(priceNum, totalIdr, txDateTime, label);
      } else {
        const soldUsdt = sellInputMode === 'usdt' ? amountNum : usdtEstimate;
        await addSmartSell(soldUsdt, priceNum, txDateTime, fee, feeType, label);
      }
      setSuccess(true);
      setTimeout(() => router.push("/v2/transaksi"), 1200);
    } catch (e: any) {
      setError(e.message || "Gagal menyimpan");
    } finally {
      setLoading(false);
    }
  };

  // Auto-set fee when exchange changes
  const handleExchangeChange = (ex: ExchangeLabel) => {
    setLabel(ex);
    if (ex === 'Tokocrypto') {
      setFee(0.0972);
      setFeeType('percent');
    } else if (ex === 'Binance') {
      setFee(0.1);
      setFeeType('percent');
    } else {
      setFee(0);
      setFeeType('percent');
    }
  };

  if (success) {
    return (
      <div className="px-4 pt-6 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mb-4 animate-bounce">
          <Check className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">Berhasil!</h2>
        <p className="text-sm text-gray-400">Transaksi {tab} berhasil disimpan</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <h1 className="text-lg font-bold text-white">Transaksi Baru</h1>
      </div>

      {/* 3 Tab Toggle: BUY / SELL / IMPORT */}
      <div className="flex gap-1.5 mb-6 bg-[#111827] rounded-xl p-1.5 border border-white/[0.06]">
        <button
          onClick={() => { setTab("BUY"); setError(""); }}
          className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-medium text-sm transition-all ${
            tab === "BUY" 
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
              : "text-gray-500 border border-transparent"
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          BUY
        </button>
        <button
          onClick={() => { setTab("SELL"); setError(""); }}
          className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-medium text-sm transition-all ${
            tab === "SELL" 
              ? "bg-red-500/20 text-red-400 border border-red-500/30" 
              : "text-gray-500 border border-transparent"
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          SELL
        </button>
        <button
          onClick={() => { setTab("IMPORT"); setError(""); }}
          className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-medium text-sm transition-all ${
            tab === "IMPORT" 
              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" 
              : "text-gray-500 border border-transparent"
          }`}
        >
          <Upload className="w-4 h-4" />
          IMPORT
        </button>
      </div>

      {/* Import Tab */}
      {tab === "IMPORT" && (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-16 h-16 bg-blue-500/15 rounded-2xl flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 text-blue-400" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">Import Transaksi</h3>
          <p className="text-xs text-gray-500 mb-6 text-center">
            Upload file Excel dari exchange untuk import transaksi secara otomatis
          </p>
          <button
            onClick={() => setShowImport(true)}
            className="w-full py-4 bg-blue-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/30 active:scale-[0.98]"
          >
            Pilih File Excel
          </button>
        </div>
      )}

      {/* BUY / SELL Form */}
      {tab !== "IMPORT" && (
        <>
          <div className="space-y-4">
            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1.5 block">Tanggal</label>
                <input
                  type="date"
                  value={txDate}
                  onChange={e => setTxDate(e.target.value)}
                  className="w-full bg-[#111827] border border-white/[0.06] rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1.5 block">Waktu</label>
                <input
                  type="time"
                  step="1"
                  value={txTime}
                  onChange={e => setTxTime(e.target.value)}
                  className="w-full bg-[#111827] border border-white/[0.06] rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            {/* Price */}
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1.5 block">Harga (IDR/USDT)</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="16.700"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full bg-[#111827] border border-white/[0.06] rounded-xl px-4 py-3.5 text-lg font-bold text-white placeholder-gray-700 focus:outline-none focus:border-emerald-500/50"
              />
              {priceNum > 0 && (
                <p className="text-[10px] text-gray-500 mt-1">{formatIDR(priceNum)} per USDT</p>
              )}
            </div>

            {/* Amount with USDT/IDR toggle */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-gray-500 font-medium">
                  {tab === "BUY" 
                    ? (buyInputMode === 'idr' ? 'Total IDR' : 'Jumlah USDT')
                    : (sellInputMode === 'usdt' ? 'Jumlah USDT Dijual' : 'Total IDR Dijual')
                  }
                </label>
                <div className="flex bg-[#111827] rounded-lg p-0.5 border border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => tab === "BUY" ? setBuyInputMode('idr') : setSellInputMode('idr')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                      (tab === "BUY" ? buyInputMode : sellInputMode) === 'idr'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-gray-500'
                    }`}
                  >
                    IDR
                  </button>
                  <button
                    type="button"
                    onClick={() => tab === "BUY" ? setBuyInputMode('usdt') : setSellInputMode('usdt')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                      (tab === "BUY" ? buyInputMode : sellInputMode) === 'usdt'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-gray-500'
                    }`}
                  >
                    USDT
                  </button>
                </div>
              </div>
              <input
                type="text"
                inputMode="numeric"
                placeholder={
                  tab === "BUY" 
                    ? (buyInputMode === 'idr' ? "1.000.000" : "50")
                    : (sellInputMode === 'usdt' ? "50" : "850.000")
                }
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full bg-[#111827] border border-white/[0.06] rounded-xl px-4 py-3.5 text-lg font-bold text-white placeholder-gray-700 focus:outline-none focus:border-emerald-500/50"
              />
              {/* Max button for SELL USDT mode */}
              {tab === "SELL" && sellInputMode === 'usdt' && totalAvailableUSDT > 0 && (
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-gray-500">Tersedia: {totalAvailableUSDT.toFixed(4)} USDT</p>
                  <button
                    type="button"
                    onClick={() => setAmount(totalAvailableUSDT.toString())}
                    className="text-[10px] text-emerald-400 font-medium"
                  >
                    Max
                  </button>
                </div>
              )}
              {/* Estimate */}
              {tab === "BUY" && buyInputMode === 'idr' && usdtEstimate > 0 && (
                <p className="text-[10px] text-gray-500 mt-1">≈ {usdtEstimate.toFixed(4)} USDT</p>
              )}
              {tab === "BUY" && buyInputMode === 'usdt' && idrEstimate > 0 && (
                <p className="text-[10px] text-gray-500 mt-1">≈ {formatIDR(idrEstimate)}</p>
              )}
              {tab === "SELL" && sellInputMode === 'usdt' && idrEstimate > 0 && (
                <p className="text-[10px] text-gray-500 mt-1">≈ {formatIDR(idrEstimate)}</p>
              )}
              {tab === "SELL" && sellInputMode === 'idr' && usdtEstimate > 0 && (
                <p className="text-[10px] text-gray-500 mt-1">≈ {usdtEstimate.toFixed(4)} USDT</p>
              )}
              {tab === "SELL" && (
                <p className="text-[10px] text-purple-400 mt-1">✨ Smart FIFO: Otomatis ambil dari sesi tertua</p>
              )}
            </div>

            {/* Fee */}
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1.5 block">Fee</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={fee || ''}
                  onChange={e => setFee(Number(e.target.value))}
                  className="flex-1 bg-[#111827] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-emerald-500/50"
                  placeholder="0"
                />
                <div className="flex">
                  <button
                    type="button"
                    onClick={() => setFeeType('percent')}
                    className={`px-3 py-3 rounded-l-xl text-xs font-medium transition-all ${
                      feeType === 'percent'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-[#111827] text-gray-500 border border-white/[0.06]'
                    }`}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeeType('value')}
                    className={`px-3 py-3 rounded-r-xl text-xs font-medium transition-all ${
                      feeType === 'value'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-[#111827] text-gray-500 border border-white/[0.06]'
                    }`}
                  >
                    Rp
                  </button>
                </div>
              </div>
              {fee > 0 && (
                <p className="text-[10px] text-gray-500 mt-1">
                  Fee: {formatIDR(feeAmount)}
                </p>
              )}
            </div>

            {/* Exchange */}
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1.5 block">Exchange</label>
              <div className="flex flex-wrap gap-1.5">
                {exchanges.map(ex => (
                  <button
                    key={ex}
                    onClick={() => handleExchangeChange(ex)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      label === ex
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-[#111827] text-gray-500 border border-white/[0.06]"
                    }`}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Summary Card */}
          {priceNum > 0 && amountNum > 0 && (
            <div className="mt-6 bg-[#111827] rounded-xl p-4 border border-white/[0.06]">
              <h3 className="text-xs text-gray-500 font-medium mb-3">Ringkasan</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Tipe</span>
                  <span className={`text-sm font-bold ${tab === "BUY" ? "text-emerald-400" : "text-red-400"}`}>{tab}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Harga</span>
                  <span className="text-sm font-bold text-white">{formatIDR(priceNum)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">USDT</span>
                  <span className="text-sm font-bold text-white">{usdtEstimate.toFixed(4)} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Total IDR</span>
                  <span className="text-sm font-bold text-white">{formatIDR(idrEstimate)}</span>
                </div>
                {fee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Fee</span>
                    <span className="text-sm font-bold text-amber-400">{formatIDR(feeAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Exchange</span>
                  <span className="text-sm font-bold text-white">{label}</span>
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || !priceNum || !amountNum}
            className={`w-full mt-6 py-4 rounded-xl font-bold text-sm transition-all ${
              loading || !priceNum || !amountNum
                ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                : tab === "BUY"
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 active:scale-[0.98]"
                  : "bg-red-500 text-white shadow-lg shadow-red-500/30 active:scale-[0.98]"
            }`}
          >
            {loading ? "Menyimpan..." : `Konfirmasi ${tab}`}
          </button>
        </>
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportTransactionModal 
          isOpen={showImport} 
          onClose={() => setShowImport(false)} 
          onSuccess={() => {
            fetchAllSessions();
            router.push("/v2/transaksi");
          }} 
        />
      )}
    </div>
  );
}
