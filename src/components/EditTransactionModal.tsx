"use client";
import { useState, useEffect } from "react";
import { formatIDR } from "@/lib/utils";
import { Transaction, ExchangeLabel } from "@/lib/types";

interface EditTransactionModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (txId: string, price: number, amount: number, fee: number, feeType: 'percent' | 'value', txTime: Date, label?: ExchangeLabel) => Promise<void>;
}

export default function EditTransactionModal({ 
  transaction, 
  isOpen, 
  onClose, 
  onSave 
}: EditTransactionModalProps) {
  const [price, setPrice] = useState(0);
  const [amount, setAmount] = useState(0);
  const [idr, setIdr] = useState(0);
  const [fee, setFee] = useState(0);
  const [feeType, setFeeType] = useState<'percent' | 'value'>('percent');
  const [transactionDate, setTransactionDate] = useState('');
  const [transactionTime, setTransactionTime] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<ExchangeLabel>('Binance');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (transaction) {
      setPrice(transaction.price_idr);
      setAmount(transaction.amount_usdt);
      setIdr(transaction.total_idr);
      setSelectedLabel(transaction.label || 'Binance');
      
      // Set date and time from transaction
      const txDate = new Date(transaction.tx_time);
      setTransactionDate(txDate.toISOString().slice(0, 10));
      setTransactionTime(txDate.toTimeString().slice(0, 5));
      
      // Try to extract fee from the difference if exists
      // Fee is always subtracted from total, so:
      // actual_total = base_total - fee
      // fee = base_total - actual_total
      const baseTotal = transaction.amount_usdt * transaction.price_idr;
      const difference = baseTotal - transaction.total_idr;
      
      if (difference > 1) {
        // Has a fee (fee was subtracted)
        setFee(difference);
        setFeeType('value');
      } else {
        // Check if exchange has default fee
        if (transaction.label === 'Tokocrypto') {
          setFee(0.0972);
          setFeeType('percent');
        } else if (transaction.label === 'Binance') {
          setFee(0.1);
          setFeeType('percent');
        } else {
          setFee(0);
          setFeeType('percent');
        }
      }
    }
  }, [transaction]);

  const calculateValues = (newPrice?: number, newAmount?: number, newFee?: number, newFeeType?: 'percent' | 'value') => {
    const p = newPrice ?? price;
    const a = newAmount ?? amount;
    const f = newFee ?? fee;
    const ft = newFeeType ?? feeType;
    
    const baseTotal = a * p;
    
    // Tokocrypto BUY: Special logic - IDR +0.075%, display that
    // Others: Standard fee calculation
    if (transaction?.type === 'BUY' && selectedLabel === 'Tokocrypto') {
      const idrIncrease = baseTotal * 0.075 / 100; // 0.075% increase
      setIdr(baseTotal + idrIncrease); // Show total with 0.075% increase
    } else {
      const feeAmount = ft === 'percent' ? (baseTotal * f / 100) : f;
      setIdr(baseTotal - feeAmount); // Fee deducted from received amount
    }
  };

  const handleSave = async () => {
    if (!transaction) return;
    setLoading(true);
    try {
      const transactionDateTime = new Date(`${transactionDate}T${transactionTime}:00`);
      await onSave(transaction.id!, price, amount, fee, feeType, transactionDateTime, selectedLabel);
      onClose();
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Gagal menyimpan perubahan');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 pb-24 md:pb-6 w-full max-w-md animate-slide-up my-8 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Edit {transaction.type === 'BUY' ? 'Pembelian' : 'Penjualan'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-gray-600 dark:text-gray-400">Tanggal</span>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="mt-1 w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600 dark:text-gray-400">Waktu</span>
              <input
                type="time"
                value={transactionTime}
                onChange={(e) => setTransactionTime(e.target.value)}
                className="mt-1 w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2"
              />
            </label>
          </div>
          
          {/* Harga */}
          <label className="block">
            <span className="text-sm text-gray-600 dark:text-gray-400">Harga (IDR/USDT)</span>
            <input
              type="number"
              value={price}
              onChange={(e) => {
                const newPrice = Number(e.target.value);
                setPrice(newPrice);
                if (newPrice > 0 && amount > 0) {
                  calculateValues(newPrice);
                }
              }}
              className="mt-1 w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2"
            />
          </label>

          {/* Amount USDT */}
          <label className="block">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {transaction.type === 'BUY' ? 'USDT Dibeli' : 'USDT Dijual'}
            </span>
            <input
              type="number"
              step="0.0001"
              value={amount}
              onChange={(e) => {
                const newAmount = Number(e.target.value);
                setAmount(newAmount);
                if (price > 0 && newAmount > 0) {
                  calculateValues(undefined, newAmount);
                }
              }}
              className="mt-1 w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2"
            />
          </label>

          {/* Fee */}
          <label className="block">
            <span className="text-sm text-gray-600 dark:text-gray-400">Fee</span>
            <div className="flex gap-2">
              <input
                type="number"
                value={fee}
                onChange={(e) => {
                  const newFee = Number(e.target.value);
                  setFee(newFee);
                  if (price > 0 && amount > 0) {
                    calculateValues(undefined, undefined, newFee);
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
                    if (price > 0 && amount > 0) {
                      calculateValues(undefined, undefined, undefined, 'percent');
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
                    if (price > 0 && amount > 0) {
                      calculateValues(undefined, undefined, undefined, 'value');
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

          {/* Exchange Label Selection */}
          <label className="block">
            <span className="text-sm text-gray-600 dark:text-gray-400">Platform Exchange</span>
            <div className="grid grid-cols-3 gap-2 mt-1">
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
                      if (price > 0 && amount > 0) {
                        calculateValues(undefined, undefined, 0.0972, 'percent');
                      }
                    } else if (label === 'Binance') {
                      setFee(0.1);
                      setFeeType('percent');
                      if (price > 0 && amount > 0) {
                        calculateValues(undefined, undefined, 0.1, 'percent');
                      }
                    } else {
                      // Reset fee to 0 for other exchanges
                      setFee(0);
                      setFeeType('percent');
                      if (price > 0 && amount > 0) {
                        calculateValues(undefined, undefined, 0, 'percent');
                      }
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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

          {/* Total IDR (Read-only) */}
          <div className="block">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Total IDR {(transaction?.type === 'BUY' && selectedLabel === 'Tokocrypto') ? '(Bayar Termasuk Fee)' : '(Diterima Setelah Fee)'}
            </span>
            <div className="mt-1 w-full border dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-2">
              {formatIDR(Math.round(idr))}
            </div>
          </div>

          {/* Preview */}
          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-gray-500 dark:text-gray-400">Harga:</span>
              <span className="font-medium dark:text-white">Rp {price.toLocaleString('id-ID')}/USDT</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-500 dark:text-gray-400">Amount:</span>
              <span className="font-medium dark:text-white">{amount.toFixed(4)} USDT</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-500 dark:text-gray-400">Subtotal:</span>
              <span className="font-medium dark:text-white">{formatIDR(Math.round(amount * price))}</span>
            </div>
            {(transaction?.type === 'BUY' && selectedLabel === 'Tokocrypto') ? (
              <>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500 dark:text-gray-400">IDR Fee (+0.075%):</span>
                  <span className="font-medium dark:text-white">
                    {formatIDR(Math.round((amount * price) * 0.075 / 100))}
                  </span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500 dark:text-gray-400">USDT Fee (-0.0222%):</span>
                  <span className="font-medium dark:text-white">
                    {(amount * 0.0222 / 100).toFixed(4)} USDT
                  </span>
                </div>
              </>
            ) : fee > 0 && (
              <div className="flex justify-between mb-1">
                <span className="text-gray-500 dark:text-gray-400">
                  Fee (dikurangi):
                </span>
                <span className="font-medium dark:text-white">
                  {feeType === 'percent' 
                    ? `${formatIDR(Math.round((amount * price) * fee / 100))} (${fee}%)`
                    : formatIDR(Math.round(fee))
                  }
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">Total:</span>
              <span className="font-semibold dark:text-white">{formatIDR(Math.round(idr))}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            disabled={loading}
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-medium hover:from-purple-700 hover:to-purple-800 transition-all disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
