"use client";
import { Transaction } from "@/lib/types";
import { formatIDR } from "@/lib/utils";
import Link from "next/link";
import { ArrowUpRight, ArrowDownLeft, Clock } from "lucide-react";

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export default function RecentTransactions({ transactions }: RecentTransactionsProps) {
  // Get only 5 most recent transactions
  const recentTxs = transactions
    .sort((a, b) => new Date(b.tx_time).getTime() - new Date(a.tx_time).getTime())
    .slice(0, 5);

  if (recentTxs.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 text-center border border-gray-100 dark:border-gray-700">
        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-gray-900 dark:text-white font-medium mb-1">Belum ada transaksi</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Mulai trading untuk melihat riwayat</p>
        <Link 
          href="/transaksi/new" 
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Tambah Transaksi
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {recentTxs.map((tx) => (
          <div key={tx.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  tx.type === 'BUY' 
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' 
                    : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'
                }`}>
                  {tx.type === 'BUY' ? (
                    <ArrowDownLeft className="w-6 h-6" />
                  ) : (
                    <ArrowUpRight className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {tx.type === 'BUY' ? 'Pembelian USDT' : 'Penjualan USDT'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(tx.tx_time).toLocaleString('id-ID', { 
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-bold ${
                  tx.type === 'BUY' 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {tx.type === 'BUY' ? '-' : '+'}{formatIDR(tx.total_idr)}
                </div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-2 py-0.5 rounded-md inline-block mt-1">
                  {tx.amount_usdt.toFixed(2)} USDT
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Link 
        href="/transaksi"
        className="block p-4 text-center text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors border-t border-gray-100 dark:border-gray-700"
      >
        Lihat Semua Transaksi
      </Link>
    </div>
  );
}
