"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/stores/useSessionStore";
import { ExchangeLabel } from "@/lib/types";
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

  const [tab, setTab] = useState<TabType>("BUY");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState<ExchangeLabel>("Bybit");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [showImport, setShowImport] = useState(false);

  const priceNum = parseFloat(price.replace(/\D/g, "")) || 0;
  const amountNum = parseFloat(amount.replace(/\D/g, "")) || 0;
  const usdtEstimate = tab === "BUY" && priceNum > 0 ? amountNum / priceNum : 0;

  const handleSubmit = async () => {
    if (!priceNum || !amountNum) {
      setError("Harga dan jumlah wajib diisi");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (tab === "BUY") {
        await addBuySessionSmart(priceNum, amountNum, new Date(), label);
      } else {
        await addSmartSell(amountNum, priceNum, new Date(), 0, "percent", label);
      }
      setSuccess(true);
      setTimeout(() => router.push("/v2/transaksi"), 1200);
    } catch (e: any) {
      setError(e.message || "Gagal menyimpan");
    } finally {
      setLoading(false);
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
          {/* Form */}
          <div className="space-y-4">
            {/* Price */}
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1.5 block">Harga (IDR)</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="17.985"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full bg-[#111827] border border-white/[0.06] rounded-xl px-4 py-3.5 text-lg font-bold text-white placeholder-gray-700 focus:outline-none focus:border-emerald-500/50"
              />
              {priceNum > 0 && (
                <p className="text-[10px] text-gray-500 mt-1">{formatIDR(priceNum)} per USDT</p>
              )}
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1.5 block">
                {tab === "BUY" ? "Jumlah Beli (IDR)" : "Jumlah Jual (USDT)"}
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder={tab === "BUY" ? "1.000.000" : "50"}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full bg-[#111827] border border-white/[0.06] rounded-xl px-4 py-3.5 text-lg font-bold text-white placeholder-gray-700 focus:outline-none focus:border-emerald-500/50"
              />
              {tab === "BUY" && usdtEstimate > 0 && (
                <p className="text-[10px] text-gray-500 mt-1">≈ {usdtEstimate.toFixed(4)} USDT</p>
              )}
            </div>

            {/* Exchange */}
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1.5 block">Exchange</label>
              <div className="flex flex-wrap gap-1.5">
                {exchanges.map(ex => (
                  <button
                    key={ex}
                    onClick={() => setLabel(ex)}
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
                  <span className="text-sm text-gray-400">{tab === "BUY" ? "Jumlah" : "USDT"}</span>
                  <span className="text-sm font-bold text-white">
                    {tab === "BUY" ? formatIDR(amountNum) : `${amountNum} USDT`}
                  </span>
                </div>
                {tab === "BUY" && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Estimasi USDT</span>
                    <span className="text-sm font-bold text-emerald-400">{usdtEstimate.toFixed(4)}</span>
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
