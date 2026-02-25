"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageWrapper from "@/components/PageWrapper";
import { useSessionStore } from "@/stores/useSessionStore";
import { Session, ExchangeLabel } from "@/lib/types";
import { formatIDR } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import PopupNotification from "@/components/PopupNotification";

export default function NewTx(){
  const params = useSearchParams();
  const type = params.get('type') || 'buy';
  const [price, setPrice] = useState(16700);
  const [idr, setIdr] = useState(1000000);
  const [usdt, setUsdt] = useState(0);
  const [fee, setFee] = useState(0);
  const [feeType, setFeeType] = useState<'percent' | 'value'>('percent');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [totalAvailableUSDT, setTotalAvailableUSDT] = useState<number>(0);
  const [sellInputMode, setSellInputMode] = useState<'usdt' | 'idr'>('usdt');
  const [buyInputMode, setBuyInputMode] = useState<'idr' | 'usdt'>('idr'); // Add buy input mode
  const [isLoading, setIsLoading] = useState(false);
  const [transactionDate, setTransactionDate] = useState('');
  const [transactionTime, setTransactionTime] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<ExchangeLabel>('Binance');
  
  // Popup notification state
  const [popup, setPopup] = useState({
    show: false,
    type: 'success' as 'success' | 'error',
    title: '',
    message: '',
    details: {} as any
  });
  const router = useRouter();
  const addBuySession = useSessionStore(s=>s.addBuySession);
  const addBuySessionSmart = useSessionStore(s=>s.addBuySessionSmart);
  const addSellSession = useSessionStore(s=>s.addSellSession);
  const addSmartSell = useSessionStore(s=>s.addSmartSell);
  const getActiveSessions = useSessionStore(s=>s.getActiveSessions);
  const fetchAllSessions = useSessionStore(s=>s.fetchAllSessions);

  const onChange = (p:number, i:number)=>{
    setPrice(p); 
    if (type==='buy') {
      setIdr(i);
      const feeAmount = feeType === 'percent' ? (i * fee / 100) : fee;
      setUsdt((i - feeAmount)/p);
    }
    // In sell mode, don't auto-calculate USDT - user inputs it manually
  };
  
  // Handler for buy mode input changes
  const handleBuyInputChange = (value: number, mode: 'idr' | 'usdt') => {
    if (mode === 'idr') {
      setIdr(value);
      const feeAmount = feeType === 'percent' ? (value * fee / 100) : fee;
      setUsdt((value - feeAmount) / price);
    } else {
      setUsdt(value);
      const baseIdr = value * price;
      const feeAmount = feeType === 'percent' ? (baseIdr * fee / 100) : fee;
      setIdr(baseIdr + feeAmount);
    }
  };

  const handleMaxUsdt = () => {
    // For smart FIFO sell, use total available from all sessions
    setUsdt(totalAvailableUSDT);
    const feeAmount = feeType === 'percent' ? (totalAvailableUSDT * price * fee / 100) : fee;
    setIdr(totalAvailableUSDT * price - feeAmount);
  };

  // Initialize date and time on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}:${seconds}`;
      
      console.log('Setting date to:', dateStr, '(today is', day, month, year, ')');
      console.log('Setting time to:', timeStr);
      
      setTransactionDate(dateStr);
      setTransactionTime(timeStr);
    }, 100); // Small delay to ensure component is ready
    
    return () => clearTimeout(timer);
  }, [type]); // Re-run when type changes
  
  useEffect(() => {
    // Fetch sessions
    fetchAllSessions().then(() => {
      const sessions = getActiveSessions();
      setActiveSessions(sessions);
      // Calculate total available USDT across all sessions
      const totalUsdt = sessions.reduce((sum, s) => sum + (s.remaining_usdt || 0), 0);
      setTotalAvailableUSDT(totalUsdt);
    });
  }, [fetchAllSessions, getActiveSessions]);

  return (
    <PageWrapper>
      <main className="pb-28 px-4 pt-4 dark:bg-gray-900 min-h-screen">
        {/* Popup Notification */}
        <PopupNotification
          show={popup.show}
          type={popup.type}
          title={popup.title}
          message={popup.message}
          details={popup.details}
          onClose={() => {
            setPopup({ ...popup, show: false });
            // Navigate after closing success popup
            if (popup.type === 'success') {
              setTimeout(() => {
                router.push("/transaksi");
              }, 300);
            }
          }}
        />
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
              setTransactionDate(dateStr);
              setTransactionTime(timeStr);
            }}
            className="text-sm px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800"
          >
            Reset ke Hari Ini
          </button>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-soft space-y-3">
          {/* Date and Time Fields */}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-sm text-gray-600 dark:text-gray-400">Tanggal</span>
              <input 
                type="date" 
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="mt-1 w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2"
                placeholder="yyyy-mm-dd"
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600 dark:text-gray-400">Waktu (HH:MM:SS)</span>
              <input 
                type="time" 
                value={transactionTime}
                onChange={(e) => setTransactionTime(e.target.value)}
                step="1"
                className="mt-1 w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2"
              />
            </label>
          </div>
          
          <label className="block">
            <span className="text-sm text-gray-600 dark:text-gray-400">Harga (IDR/USDT)</span>
            <input type="number" value={price} onChange={e=>{
              const newPrice = Number(e.target.value);
              setPrice(newPrice);
              if (type==='buy') {
                // Recalculate based on current input mode
                if (buyInputMode === 'idr') {
                  const feeAmount = feeType === 'percent' ? (idr * fee / 100) : fee;
                  setUsdt((idr - feeAmount)/newPrice);
                } else {
                  const baseIdr = usdt * newPrice;
                  const feeAmount = feeType === 'percent' ? (baseIdr * fee / 100) : fee;
                  setIdr(baseIdr + feeAmount);
                }
              } else if (usdt > 0) {
                // In sell mode, update IDR based on current USDT
                const feeAmount = feeType === 'percent' ? (usdt * newPrice * fee / 100) : fee;
                setIdr(usdt * newPrice + feeAmount);
              }
            }} className="mt-1 w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2"/>
          </label>
          
          {type==='buy' ? (
            <label className="block">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {buyInputMode === 'idr' ? 'Total IDR' : 'Jumlah USDT'}
                </span>
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setBuyInputMode('idr')}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      buyInputMode === 'idr' 
                        ? 'bg-purple-600 text-white' 
                        : 'text-gray-600 dark:text-gray-300 hover:text-purple-600'
                    }`}
                  >
                    IDR
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuyInputMode('usdt')}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      buyInputMode === 'usdt' 
                        ? 'bg-purple-600 text-white' 
                        : 'text-gray-600 dark:text-gray-300 hover:text-purple-600'
                    }`}
                  >
                    USDT
                  </button>
                </div>
              </div>
              <input 
                type="number" 
                value={buyInputMode === 'idr' ? idr : usdt} 
                onChange={e => {
                  const value = Number(e.target.value);
                  handleBuyInputChange(value, buyInputMode);
                }} 
                className="mt-1 w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2"
                placeholder={buyInputMode === 'idr' ? 'Masukkan jumlah IDR' : 'Masukkan jumlah USDT'}
              />
            </label>
          ) : (
            <>
              <label className="block">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {sellInputMode === 'usdt' ? 'Jumlah USDT Dijual' : 'Total IDR Dijual'}
                  </span>
                  <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setSellInputMode('usdt')}
                      className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                        sellInputMode === 'usdt'
                          ? 'bg-purple-600 text-white'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      USDT
                    </button>
                    <button
                      type="button"
                      onClick={() => setSellInputMode('idr')}
                      className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                        sellInputMode === 'idr'
                          ? 'bg-purple-600 text-white'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      IDR
                    </button>
                  </div>
                </div>
                
                {sellInputMode === 'usdt' ? (
                  <>
                    <div className="flex gap-2">
                      <input type="number" value={usdt} onChange={e=>{
                        const u = Number(e.target.value);
                        setUsdt(u);
                        const feeAmount = feeType === 'percent' ? (u * price * fee / 100) : fee;
                        setIdr(u * price - feeAmount);
                      }} className="flex-1 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2"/>
                      <button
                        type="button"
                        onClick={handleMaxUsdt}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        Max
                      </button>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Tersedia: {totalAvailableUSDT.toFixed(4)} USDT
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Total IDR: {formatIDR(idr)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <input type="number" value={idr} onChange={e=>{
                        const i = Number(e.target.value);
                        setIdr(i);
                        const feeAmount = feeType === 'percent' ? (i * fee / 100) : fee;
                        const netIdr = i + feeAmount; // Add fee back to get gross
                        const u = netIdr / price;
                        setUsdt(u);
                      }} className="flex-1 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2"/>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Akan menjual: {usdt.toFixed(4)} USDT
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Max tersedia: {totalAvailableUSDT.toFixed(4)} USDT
                    </div>
                  </>
                )}
                
                <div className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                  ✨ Smart FIFO: Otomatis ambil dari sesi tertua
                </div>
              </label>
            </>
          )}
          
          {/* Fee Input */}
          <label className="block">
            <span className="text-sm text-gray-600 dark:text-gray-400">Fee</span>
            <div className="flex gap-2">
              <input 
                type="number" 
                value={fee} 
                onChange={e => {
                  const newFee = Number(e.target.value);
                  setFee(newFee);
                  if (type==='buy') {
                    // Recalculate based on current input mode
                    if (buyInputMode === 'idr') {
                      const feeAmount = feeType === 'percent' ? (idr * newFee / 100) : newFee;
                      setUsdt((idr - feeAmount)/price);
                    } else {
                      const baseIdr = usdt * price;
                      const feeAmount = feeType === 'percent' ? (baseIdr * newFee / 100) : newFee;
                      setIdr(baseIdr + feeAmount);
                    }
                  } else if (usdt > 0) {
                    // In sell mode, recalculate IDR with new fee
                    const feeAmount = feeType === 'percent' ? (usdt * price * newFee / 100) : newFee;
                    setIdr(usdt * price + feeAmount);
                  }
                }} 
                className="flex-1 mt-1 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2"
                placeholder="0"
              />
              <div className="flex mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setFeeType('percent');
                    if (type==='buy') {
                      if (buyInputMode === 'idr') {
                        const feeAmount = idr * fee / 100;
                        setUsdt((idr - feeAmount)/price);
                      } else {
                        const baseIdr = usdt * price;
                        const feeAmount = baseIdr * fee / 100;
                        setIdr(baseIdr + feeAmount);
                      }
                    } else if (usdt > 0) {
                      const feeAmount = usdt * price * fee / 100;
                      setIdr(usdt * price + feeAmount);
                    }
                  }}
                  className={`px-3 py-2 rounded-l-lg transition-colors ${
                    feeType === 'percent' 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFeeType('value');
                    if (type==='buy') {
                      if (buyInputMode === 'idr') {
                        setUsdt((idr - fee)/price);
                      } else {
                        const baseIdr = usdt * price;
                        setIdr(baseIdr + fee);
                      }
                    } else if (usdt > 0) {
                      setIdr(usdt * price + fee);
                    }
                  }}
                  className={`px-3 py-2 rounded-r-lg transition-colors ${
                    feeType === 'value' 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Rp
                </button>
              </div>
            </div>
          </label>
          
          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm space-y-1">
            {type === 'buy' ? (
              buyInputMode === 'idr' ? (
                <>Anda akan mendapat <span className="font-semibold">{usdt.toFixed(4)} USDT</span></>
              ) : (
                <>Total biaya <span className="font-semibold">{formatIDR(idr)}</span></>
              )
            ) : (
              <>Anda akan menjual <span className="font-semibold">{usdt.toFixed(4)} USDT</span></>
            )}
            {fee > 0 && (
              <div className="text-xs mt-1">
                Fee {(type === 'buy' && selectedLabel === 'Tokocrypto') ? '(tambah bayar)' : '(dikurangi)'}: {formatIDR(feeType === 'percent' ? ((type === 'buy' ? idr : (usdt * price)) * fee / 100) : fee)}
              </div>
            )}
            {type === 'buy' && selectedLabel === 'Tokocrypto' && fee > 0 && (
              <>
                <div className="text-xs mt-1 font-semibold text-orange-600 dark:text-orange-400">
                  Total bayar: {formatIDR(idr + (idr * 0.075 / 100))} (+0.075%)
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  USDT diterima: {(usdt * (1 - 0.0222 / 100)).toFixed(4)} USDT (-0.0222%)
                </div>
              </>
            )}
          </div>

          {/* Exchange Label Selection */}
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Platform Exchange
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(['Binance', 'Bybit', 'OKX', 'Bitget', 'Tokocrypto', 'Other'] as ExchangeLabel[]).map(label => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setSelectedLabel(label);
                    // Auto-set fee based on exchange
                    if (label === 'Tokocrypto') {
                      setFee(0.0972);
                      setFeeType('percent');
                    } else if (label === 'Binance') {
                      setFee(0.1);
                      setFeeType('percent');
                    } else {
                      // Reset fee to 0 for other exchanges
                      setFee(0);
                      setFeeType('percent');
                    }
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedLabel === label
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </label>
          
          <button
            onClick={async () => {
              // Prevent double click
              if (isLoading) return;
              
              setIsLoading(true);
              try {
                // Combine date and time - use local time directly
                // Supabase will handle timezone conversion automatically
                // If time includes seconds, use it; otherwise append :00
                const timeWithSeconds = transactionTime.includes(':') && transactionTime.split(':').length === 3 
                  ? transactionTime 
                  : `${transactionTime}:00`;
                const transactionDateTime = new Date(`${transactionDate}T${timeWithSeconds}`);
                
                if (type === 'buy') {
                  const feeAmount = feeType === 'percent' ? (idr * fee / 100) : fee;
                  
                  // Tokocrypto: Special calculation - IDR +0.075%, USDT -0.0222%
                  // Others: Pay base IDR but get less USDT (worth base - fee)
                  if (selectedLabel === 'Tokocrypto') {
                    // Tokocrypto: IDR increases by 0.075%, USDT decreases by 0.0222%
                    const idrIncrease = idr * 0.075 / 100; // 0.075% increase
                    const totalPaid = idr + idrIncrease;
                    // Pass base_idr and special USDT reduction flag for Tokocrypto
                    await addBuySessionSmart(price, totalPaid, transactionDateTime, selectedLabel, idr);
                    // USDT = (idr / price) * (1 - 0.000222)
                  } else {
                    // For others: fee is deducted from what you get
                    const netValue = idr - feeAmount;
                    await addBuySessionSmart(price, netValue, transactionDateTime, selectedLabel);
                  }
                  
                  // Success state with popup
                  setIsLoading(false);
                  const actualPayment = selectedLabel === 'Tokocrypto' ? idr + (idr * 0.075 / 100) : idr;
                  const feeDisplay = selectedLabel === 'Tokocrypto' 
                    ? formatIDR(Math.round(idr * 0.075 / 100))
                    : (fee > 0 ? formatIDR(Math.round(feeAmount)) : 'Rp0');
                  
                  setPopup({
                    show: true,
                    type: 'success',
                    title: 'Transaksi Berhasil',
                    message: 'Transaksi pembelian USDT telah tersimpan',
                    details: {
                      amount: `${usdt.toFixed(4)} USDT`,
                      cost: formatIDR(actualPayment),
                      price: `Rp ${price.toLocaleString('id-ID')}/USDT`,
                      exchange: selectedLabel,
                      fee: feeDisplay,
                      refNumber: Date.now().toString()
                    }
                  });
                } else {
                  // Calculate estimated cost based on active sessions (FIFO)
                  let remainingToSell = usdt;
                  let totalCost = 0;
                  
                  for (const session of activeSessions) {
                    if (remainingToSell <= 0) break;
                    const toSell = Math.min(remainingToSell, session.remaining_usdt);
                    totalCost += toSell * session.avg_cost;
                    remainingToSell -= toSell;
                  }
                  
                  // SELL: Fee is always subtracted from proceeds (all exchanges)
                  await addSmartSell(usdt, price, transactionDateTime, fee, feeType, selectedLabel);
                  
                  // Success state with popup
                  setIsLoading(false);
                  const totalProceeds = usdt * price;
                  const feeAmount = feeType === 'percent' ? (totalProceeds * fee / 100) : fee;
                  // Fee always subtracted from proceeds for SELL
                  const netProceeds = totalProceeds - feeAmount;
                  
                  // Calculate profit
                  const profit = netProceeds - totalCost;
                  
                  setPopup({
                    show: true,
                    type: 'success',
                    title: 'Transaksi Berhasil',
                    message: 'FIFO otomatis dari sesi tertua',
                    details: {
                      amount: `${usdt.toFixed(4)} USDT`,
                      price: `Rp ${price.toLocaleString('id-ID')}/USDT`,
                      exchange: selectedLabel,
                      fee: fee > 0 ? formatIDR(Math.round(feeAmount)) : 'Rp0',
                      proceeds: formatIDR(Math.round(netProceeds)),
                      cost: formatIDR(Math.round(totalCost)),
                      profit: formatIDR(Math.round(profit)),
                      refNumber: Date.now().toString()
                    }
                  });
                }
              } catch (error: any) {
                console.error('Transaction error:', error);
                setIsLoading(false);
                setPopup({
                  show: true,
                  type: 'error',
                  title: 'Transaksi Gagal',
                  message: error.message || 'Terjadi kesalahan saat menyimpan transaksi',
                  details: {}
                });
              }
            }}
            disabled={isLoading}
            className={`w-full bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl py-3 font-semibold transition-all ${
              isLoading 
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:from-purple-700 hover:to-violet-700'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Menyimpan...</span>
              </div>
            ) : (
              `Simpan ${type==='buy'?'Pembelian':'Penjualan'}`
            )}
          </button>
        </div>
      </main>
    </PageWrapper>
  );
}
