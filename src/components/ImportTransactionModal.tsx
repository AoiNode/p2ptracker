"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import * as XLSX from 'xlsx';
import { X, Upload, Check, AlertCircle, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useSessionStore } from "@/stores/useSessionStore";
import { processSmartFIFOSell } from "@/lib/sessionManager";
import { ExchangeLabel, Session } from "@/lib/types";
import { formatIDR } from "@/lib/utils";

interface ImportTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedTransaction {
  id: string;
  date: Date;
  type: 'BUY' | 'SELL';
  price: number;
  fiatAmount: number;
  usdtAmount: number;
  selected: boolean;
  status?: 'pending' | 'success' | 'error' | 'duplicate' | 'canceled';
  error?: string;
  isCanceled?: boolean;
}

export default function ImportTransactionModal({ isOpen, onClose, onSuccess }: ImportTransactionModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [parsedData, setParsedData] = useState<ParsedTransaction[]>([]);
  const [fileName, setFileName] = useState("");
  const [selectedLabel, setSelectedLabel] = useState<ExchangeLabel>('Bybit');
  const [mounted, setMounted] = useState(false);
  const [previewProfit, setPreviewProfit] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewTableScrollRef = useRef<HTMLDivElement>(null);
  const isImportingRef = useRef(false); // Hard lock against double-submit (mobile double-tap)
  
  const addBuySessionSmart = useSessionStore(s => s.addBuySessionSmart);
  const addSmartSell = useSessionStore(s => s.addSmartSell);
  const fetchAllSessions = useSessionStore(s => s.fetchAllSessions);
  const transactions = useSessionStore(s => s.transactions);
  const sessions = useSessionStore(s => s.sessions);

  useEffect(() => {
    setMounted(true);
  }, []);

  const totalToImport = useMemo(
    () => parsedData.filter(p => p.selected && !p.isCanceled && p.status !== 'duplicate').length,
    [parsedData]
  );

  const importedCount = useMemo(
    () => parsedData.filter(p => p.status === 'success').length,
    [parsedData]
  );

  const importErrorCount = useMemo(
    () => parsedData.filter(p => p.status === 'error').length,
    [parsedData]
  );

  // Calculate preview profit whenever parsedData changes or selection changes
  useEffect(() => {
    if (step !== 'preview' && step !== 'importing') {
      setPreviewProfit(null);
      return;
    }

    const calculateProfit = () => {
      try {
        // 1. Clone active sessions to avoid mutation
        let currentSessions: Session[] = sessions
          .filter(s => s.status === 'active' && s.remaining_usdt > 0)
          .map(s => ({ ...s }));

        let totalCalculatedProfit = 0;
        
        // 2. Get valid preview transactions sorted by date
        const validTxs = parsedData
          .filter(t => t.selected && !t.isCanceled && t.status !== 'duplicate')
          .sort((a, b) => a.date.getTime() - b.date.getTime());

        // 3. Simulate FIFO
        for (const tx of validTxs) {
          if (tx.type === 'BUY') {
            // Create virtual session
            const newSession: Session = {
              id: `virtual-${tx.id}`,
              created_at: tx.date.toISOString(),
              total_invest_idr: tx.fiatAmount,
              total_usdt: tx.usdtAmount,
              avg_cost: tx.fiatAmount / tx.usdtAmount,
              remaining_usdt: tx.usdtAmount,
              realized_profit_idr: 0,
              status: 'active'
            };
            currentSessions.push(newSession);
          } else {
            // Simulate Sell
            // Sort sessions by date (FIFO) before processing
            currentSessions.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            
            try {
              const result = processSmartFIFOSell(
                currentSessions, 
                tx.usdtAmount, 
                tx.price, 
                tx.date.toISOString(), 
                0 // Fee assumed 0 for import preview as per logic in handleImport
              );
              
              totalCalculatedProfit += result.totalProfit;
              
              // Update sessions based on result
              result.affectedSessions.forEach(affected => {
                const index = currentSessions.findIndex(s => s.id === affected.session.id);
                if (index !== -1) {
                  currentSessions[index] = affected.session;
                }
              });
            } catch (err) {
              // If sell fails (e.g. not enough balance), we just ignore profit from this tx
              // or could potentially mark it as invalid in UI, but for now just skip profit calc
              console.warn(`Preview simulation: Cannot sell for tx ${tx.id}`, err);
            }
          }
        }
        
        setPreviewProfit(totalCalculatedProfit);
      } catch (error) {
        console.error("Error calculating preview profit:", error);
        setPreviewProfit(null);
      }
    };

    calculateProfit();
  }, [parsedData, sessions, step]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Read raw rows to detect header position (Bybit export has headers on row 3)
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        // Find the header row: look for a row containing known column names
        let headerRowIndex = 0;
        const knownHeaders = ['order no', 'direction', 'unit price', 'coin amount', 'fiat amount', 'type', 'side', 'price', 'date', 'created time'];
        for (let i = 0; i < Math.min(10, rawData.length); i++) {
          const rowStr = (rawData[i] || []).map((v: any) => (v || '').toString().toLowerCase()).join(' ');
          if (knownHeaders.some(h => rowStr.includes(h))) {
            headerRowIndex = i;
            break;
          }
        }
        
        // Use detected header row
        const headers = (rawData[headerRowIndex] || []).map((h: any) => (h || '').toString().trim());
        const dataRows = rawData.slice(headerRowIndex + 1);
        
        // Convert to objects using detected headers
        const data = dataRows
          .filter((row: any[]) => row.some((cell: any) => cell != null && cell !== ''))
          .map((row: any[]) => {
            const obj: Record<string, any> = {};
            headers.forEach((h, i) => {
              if (h) obj[h] = row[i];
            });
            return obj;
          });
        
        processData(data);
      } catch (error) {
        console.error("Error parsing file:", error);
        alert("Failed to parse Excel file");
      }
    };
    reader.readAsBinaryString(file);
  };

  const processData = (data: any[]) => {
    const processed: ParsedTransaction[] = data.map((row: any, index) => {
      // Map columns - supports both old format (Type/Price/Crypto Amount) and Bybit export (Direction/Unit Price/Coin Amount)
      const typeRaw = row['Direction'] || row['Type'] || row['type'] || row['Side'] || 'BUY';
      const type: 'BUY' | 'SELL' = typeRaw.toString().toUpperCase().includes('SELL') ? 'SELL' : 'BUY';
      
      const fiatAmount = parseFloat(row['Fiat Amount'] || row['fiat amount'] || row['Total'] || '0');
      const price = parseFloat(row['Unit Price'] || row['Price'] || row['price'] || '0');
      
      // Calculate USDT amount if not present, or use Coin Amount / Crypto Amount if available
      let usdtAmount = parseFloat(row['Coin Amount'] || row['Crypto Amount'] || row['Amount'] || '0');
      if (!usdtAmount && price > 0) {
        usdtAmount = fiatAmount / price;
      }
      
      // Try to parse date, default to now if missing
      // Supports Bybit export with timezone offset like 'Time (UTC+07:00)'
      let date = new Date();
      const rawDate = row['Time (UTC+07:00)'] || row['Time (UTC+0)'] || row['Date'] || row['Created Time'] || row['Time'];
      if (rawDate) {
        if (rawDate instanceof Date) {
          date = rawDate;
        } else {
          const parsedDate = new Date(rawDate);
          if (!isNaN(parsedDate.getTime())) {
            date = parsedDate;
          }
        }
      }

      // Check for duplicates against existing transactions
      // Safety measure to prevent looping/duplicate imports
      const isDuplicate = transactions.some(existing => {
        const timeDiff = Math.abs(new Date(existing.tx_time).getTime() - date.getTime());
        const isSameTime = timeDiff < 60000; // 1 minute tolerance for variations
        const isSameType = existing.type === type;
        const isSamePrice = Math.abs(existing.price_idr - price) < 1; // 1 IDR tolerance
        const isSameAmount = Math.abs(existing.amount_usdt - usdtAmount) < 0.01; // 0.01 USDT tolerance
        
        return isSameTime && isSameType && isSamePrice && isSameAmount;
      });

      // Check status column for canceled transactions
      // Bybit uses 'Completed', 'Canceled', etc.
      const statusRaw = row['Status'] || row['status'] || '';
      const statusStr = statusRaw.toString().toLowerCase();
      const isCanceled = statusStr.includes('cancel');
      
      const status: ParsedTransaction['status'] = isCanceled ? 'canceled' : (isDuplicate ? 'duplicate' : 'pending');

      return {
        id: `row-${index}`,
        date,
        type,
        price,
        fiatAmount,
        usdtAmount,
        selected: !isDuplicate && !isCanceled, // Auto-deselect duplicates and canceled
        status,
        error: isDuplicate ? 'Transaction already exists' : undefined,
        isCanceled
      };
    }).filter(t => t.price > 0 && t.fiatAmount > 0); // Filter invalid rows

    processed.reverse();

    setParsedData(processed);
    setStep('preview');
  };

  const handleImport = async () => {
    // Hard guard: block re-entry from a second tap before React re-renders `step`.
    // A useRef flips synchronously, so a double-tap can't fire two import loops
    // (root cause of the rare 1-BUY-becomes-2x duplication).
    if (isImportingRef.current) return;
    isImportingRef.current = true;

    setStep('importing');
    // Only import rows that are selected AND not duplicate/canceled.
    const selected = parsedData.filter(t => t.selected && !t.isCanceled && t.status !== 'duplicate');

    for (const tx of selected) {
      try {
        if (tx.type === 'BUY') {
          await addBuySessionSmart(tx.price, tx.fiatAmount, tx.date, selectedLabel, undefined, false);
        } else {
          // For SELL, we use Smart Sell logic
          // Note: addSmartSell takes sold_usdt, price_idr, date, fee, feeType, label
          await addSmartSell(tx.usdtAmount, tx.price, tx.date, 0, 'percent', selectedLabel, false);
        }
        
        setParsedData(prev => prev.map(p => p.id === tx.id ? { ...p, status: 'success' } : p));
      } catch (error) {
        console.error(`Error importing ${tx.id}:`, error);
        setParsedData(prev => prev.map(p => p.id === tx.id ? { ...p, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' } : p));
      }
    }

    await fetchAllSessions();
    
    // If all success, close after short delay
    const allSuccess = selected.every(t => parsedData.find(p => p.id === t.id)?.status !== 'error'); // Check current state logic slightly off here due to async state update, but okay for now
    
    setTimeout(() => {
      onSuccess();
      onClose();
      // Reset state
      setStep('upload');
      setParsedData([]);
      setFileName("");
      isImportingRef.current = false; // Release lock for the next import
    }, 1500);
  };

  const toggleSelect = (id: string) => {
    setParsedData(prev => prev.map(p => p.id === id ? { ...p, selected: !p.selected } : p));
  };

  const toggleSelectAll = () => {
    const selectableItems = parsedData.filter(p => !p.isCanceled && p.status !== 'duplicate');
    const allSelected = selectableItems.length > 0 && selectableItems.every(p => p.selected);
    
    setParsedData(prev => prev.map(p => {
      if (p.isCanceled || p.status === 'duplicate') return { ...p, selected: false };
      return { ...p, selected: !allSelected };
    }));
  };

  const scrollPreviewTable = (direction: 'left' | 'right') => {
    const el = previewTableScrollRef.current;
    if (!el) return;
    const amount = Math.max(240, Math.round(el.clientWidth * 0.8));
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Import Transactions
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {step === 'upload' ? 'Upload Excel file (.xls, .xlsx)' : 'Preview and confirm transactions'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {step !== 'upload' && (
              <button 
                onClick={() => {
                  setStep('upload');
                  setParsedData([]);
                  setFileName("");
                }}
                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full transition-colors"
                title="Reset Import"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {step === 'upload' && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-gray-700/50 transition-all cursor-pointer"
                   onClick={() => fileInputRef.current?.click()}>
                <input 
                  type="file" 
                  accept=".xls,.xlsx" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full mb-4">
                  <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-lg font-medium text-gray-700 dark:text-gray-200">Click to upload Excel file</p>
                <p className="text-sm text-gray-500 mt-2">Supports .xls and .xlsx</p>
                <p className="text-xs text-gray-400 mt-1">Supports: Bybit P2P export, generic Excel (Type/Direction, Price/Unit Price, Fiat Amount, Coin Amount)</p>
              </div>
            </div>
          )}

          {(step === 'preview' || step === 'importing') && (
            <div className="flex-1 flex flex-col gap-4 p-6 overflow-hidden">
              <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg shrink-0">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Exchange Label
                  </label>
                  <select
                    value={selectedLabel}
                    onChange={(e) => setSelectedLabel(e.target.value as ExchangeLabel)}
                    disabled={step === 'importing'}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Binance">Binance</option>
                    <option value="Tokocrypto">Tokocrypto</option>
                    <option value="Bybit">Bybit</option>
                    <option value="OKX">OKX</option>
                    <option value="Bitget">Bitget</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Ringkasan Import
                  </p>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-0.5">
                    <p>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {parsedData.filter(p => !p.isCanceled && p.status !== 'duplicate').length}
                      </span> transaksi siap diimport.
                    </p>
                    {step === 'importing' && totalToImport > 0 && (
                      <p>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {importedCount}
                        </span>
                        <span className="mx-1">/</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {totalToImport}
                        </span>
                        <span> terimport</span>
                        {importErrorCount > 0 && (
                          <span className="ml-1 text-red-500 dark:text-red-400">
                            ({importErrorCount} gagal)
                          </span>
                        )}
                      </p>
                    )}
                    {previewProfit !== null && (
                      <p className="flex items-center gap-1">
                        <span>Estimasi Total Profit:</span>
                        <span className={`font-semibold ${previewProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {formatIDR(previewProfit)}
                        </span>
                      </p>
                    )}
                    {parsedData.some(p => p.isCanceled) && (
                      <p className="text-red-600 dark:text-red-400">
                        <span className="font-semibold">{parsedData.filter(p => p.isCanceled).length}</span> transaksi dibatalkan (canceled).
                      </p>
                    )}
                    {parsedData.some(p => p.status === 'duplicate') && (
                      <p className="text-orange-600 dark:text-orange-400">
                        <span className="font-semibold">{parsedData.filter(p => p.status === 'duplicate').length}</span> transaksi duplikat (dilewati).
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <style>{`
                /* Custom Scrollbar for Import Table */
                .custom-scrollbar::-webkit-scrollbar {
                  width: 12px;
                  height: 12px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                  background: rgba(0, 0, 0, 0.05);
                  border-radius: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                  background-color: rgba(156, 163, 175, 0.5);
                  border-radius: 8px;
                  border: 2px solid transparent;
                  background-clip: content-box;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                  background-color: rgba(107, 114, 128, 0.8);
                }
                /* Dark mode scrollbar */
                @media (prefers-color-scheme: dark) {
                  .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                  }
                  .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(156, 163, 175, 0.4);
                  }
                  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: rgba(209, 213, 219, 0.6);
                  }
                }
              `}</style>

              <div
                ref={previewTableScrollRef}
                className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700 rounded-xl min-h-0 shadow-sm overscroll-contain touch-pan-x touch-pan-y custom-scrollbar"
              >
                <table className="w-full text-sm text-left relative min-w-max">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300 sticky top-0 z-10">
                  <tr>
                    <th className="p-4 w-4 bg-gray-50 dark:bg-gray-700">
                      <input 
                        type="checkbox" 
                        checked={parsedData.filter(p => !p.isCanceled).length > 0 && parsedData.filter(p => !p.isCanceled).every(p => p.selected)}
                        onChange={toggleSelectAll}
                        disabled={step === 'importing'}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 whitespace-nowrap bg-gray-50 dark:bg-gray-700">Date</th>
                    <th className="px-6 py-3 whitespace-nowrap bg-gray-50 dark:bg-gray-700">Type</th>
                    <th className="px-6 py-3 whitespace-nowrap bg-gray-50 dark:bg-gray-700">Price</th>
                    <th className="px-6 py-3 whitespace-nowrap bg-gray-50 dark:bg-gray-700">USDT</th>
                    <th className="px-6 py-3 whitespace-nowrap bg-gray-50 dark:bg-gray-700">Total IDR</th>
                    <th className="px-6 py-3 whitespace-nowrap bg-gray-50 dark:bg-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.map((tx) => (
                    <tr key={tx.id} className={`border-b transition-colors ${
                      tx.isCanceled 
                        ? 'bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/40' 
                        : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    } dark:border-gray-700`}>
                      <td className="p-4 whitespace-nowrap">
                        <input 
                          type="checkbox" 
                          checked={tx.selected}
                          onChange={() => toggleSelect(tx.id)}
                          disabled={step === 'importing' || tx.isCanceled}
                          className={`w-4 h-4 rounded border-gray-300 focus:ring-blue-500 ${
                            tx.isCanceled 
                              ? 'text-gray-400 cursor-not-allowed bg-gray-100' 
                              : 'text-blue-600'
                          }`}
                        />
                      </td>
                      <td className={`px-6 py-4 font-medium whitespace-nowrap ${
                        tx.isCanceled ? 'text-red-800 dark:text-red-300' : 'text-gray-900 dark:text-white'
                      }`}>
                        {tx.date.toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          tx.type === 'BUY' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap ${tx.isCanceled ? 'text-red-800 dark:text-red-300' : ''}`}>
                        {formatIDR(tx.price)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap ${tx.isCanceled ? 'text-red-800 dark:text-red-300' : ''}`}>
                        {tx.usdtAmount.toFixed(2)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap ${tx.isCanceled ? 'text-red-800 dark:text-red-300' : ''}`}>
                        {formatIDR(tx.fiatAmount)}
                      </td>
                      <td className="px-6 py-4">
                        {tx.status === 'success' && <Check className="w-5 h-5 text-green-500" />}
                        {tx.status === 'error' && (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                              <AlertCircle className="w-4 h-4" />
                              <span className="font-semibold text-xs">Gagal</span>
                            </div>
                            <span className="text-xs text-red-500 dark:text-red-400 break-words max-w-[200px] leading-tight">
                              {tx.error}
                            </span>
                          </div>
                        )}
                        {tx.status === 'duplicate' && (
                          <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-xs">Sudah ada</span>
                          </div>
                        )}
                        {tx.status === 'canceled' && (
                          <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                            <X className="w-4 h-4" />
                            <span className="text-xs font-semibold">Canceled</span>
                          </div>
                        )}
                        {tx.status === 'pending' && <span className="text-gray-400">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => scrollPreviewTable('left')}
                  disabled={step === 'importing'}
                  className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  title="Geser kiri"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollPreviewTable('right')}
                  disabled={step === 'importing'}
                  className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  title="Geser kanan"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
            disabled={step === 'importing'}
          >
            Cancel
          </button>
          
          {step === 'preview' && parsedData.length > 0 && (
            <button 
              onClick={handleImport}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 transition-colors shadow-lg shadow-blue-500/30"
            >
              Import {parsedData.filter(p => p.selected).length} Transactions
            </button>
          )}
          
          {step === 'importing' && (
             <button disabled className="px-6 py-2 text-sm font-medium text-white bg-blue-400 rounded-lg cursor-not-allowed flex items-center gap-2">
               <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
               </svg>
               Processing...
             </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
