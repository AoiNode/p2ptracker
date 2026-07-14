"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/stores/useSessionStore";
import { ExchangeLabel } from "@/lib/types";
import { formatIDR } from "@/lib/utils";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Check } from "lucide-react";

const exchanges: ExchangeLabel[] = ["Binance", "Bybit", "OKX", "Bitget", "Tokocrypto", "Other"];

export default function V2NewTransaction() {
  const router = useRouter();
  const addBuySessionSmart = useSessionStore(s => s.addBuySessionSmart);
  const addSmartSell = useSessionStore(s => s.addSmartSell);

  const [type, setType] = useState<"BUY" | "SELL">("BUY");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState<ExchangeLabel>("Bybit");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const priceNum = parseFloat(price.replace(/\D/g, "")) || 0;
  const amountNum = parseFloat(amount.replace(/\D/g, "")) || 0;
  const total = type === "BUY" ? amountNum : 0;
  const usdtEstimate = type === "BUY" && priceNum > 0 ? amountNum / priceNum : 0;

  const handleSubmit = async () => {
    if (!priceNum || !amountNum) {
      setError("Harga dan jumlah wajib diisi");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (type === "BUY") {
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
        <p className="text-sm text-gray-400">Transaksi {type} berhasil disimpan</p>
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

      {/* Type Toggle */}
      <div className="flex gap-2 mb-6 bg-[#111827] rounded-xl p-1.5 border border-white/[0.06]">
        <button
          onClick={() => setType("BUY")}
          className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-medium text-sm transition-all ${
            type === "BUY" 
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
              : "text-gray-500 border border-transparent"
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          BUY
        </button>
        <button
          onClick={() => setType("SELL")}
          className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-medium text-sm transition-all ${
            type === "SELL" 
              ? "bg-red-500/20 text-red-400 border border-red-500/30" 
              : "text-gray-500 border border-transparent"
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          SELL
        </button>
      </div>

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
            {type === "BUY" ? "Jumlah Beli (IDR)" : "Jumlah Jual (USDT)"}
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder={type === "BUY" ? "1.000.000" : "50"}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full bg-[#111827] border border-white/[0.06] rounded-xl px-4 py-3.5 text-lg font-bold text-white placeholder-gray-700 focus:outline-none focus:border-emerald-500/50"
          />
          {type === "BUY" && usdtEstimate > 0 && (
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
              <span className={`text-sm font-bold ${type === "BUY" ? "text-emerald-400" : "text-red-400"}`}>{type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Harga</span>
              <span className="text-sm font-bold text-white">{formatIDR(priceNum)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">{type === "BUY" ? "Jumlah" : "USDT"}</span>
              <span className="text-sm font-bold text-white">
                {type === "BUY" ? formatIDR(amountNum) : `${amountNum} USDT`}
              </span>
            </div>
            {type === "BUY" && (
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
            : type === "BUY"
              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 active:scale-[0.98]"
              : "bg-red-500 text-white shadow-lg shadow-red-500/30 active:scale-[0.98]"
        }`}
      >
        {loading ? "Menyimpan..." : `Konfirmasi ${type}`}
      </button>
    </div>
  );
}
