"use client";
import { useEffect, useState } from "react";
import { useSessionStore } from "@/stores/useSessionStore";
import PageWrapper from "@/components/PageWrapper";
import { formatIDR } from "@/lib/utils";
import Link from "next/link";
import { Clock, TrendingUp, TrendingDown, MoreHorizontal, ArrowRight, Layers } from "lucide-react";

export default function SessionsPage() {
  const sessions = useSessionStore(s => s.sessions);
  const fetchAllSessions = useSessionStore(s => s.fetchAllSessions);
  const [loading, setLoading] = useState(true);
  
  // Filter to only show active sessions
  const activeSessions = sessions.filter(s => s.status === 'active' || !s.status);

  useEffect(() => {
    fetchAllSessions().then(() => setLoading(false));
  }, [fetchAllSessions]);

  return (
    <PageWrapper>
      <main className="pb-32 px-4 pt-6 dark:bg-gray-900 min-h-screen">
        <div className="flex justify-between items-center mb-6 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sesi P2P Aktif</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Kelola investasi yang sedang berjalan
            </p>
          </div>
          <Link 
            href="/sessions/history" 
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Clock className="w-4 h-4" />
            Riwayat
          </Link>
        </div>

        {/* Session List */}
        {!loading && activeSessions.length > 0 && (
          <div className="space-y-4">
            {activeSessions.map((sess) => {
              const roi = sess.remaining_usdt > 0 
                ? (sess.realized_profit_idr / sess.total_invest_idr) * 100 
                : ((sess.realized_profit_idr - (sess.total_invest_idr - sess.total_invest_idr * (sess.remaining_usdt/sess.total_usdt))) / sess.total_invest_idr) * 100;
              
              const progress = ((sess.total_usdt - sess.remaining_usdt) / sess.total_usdt * 100);
              const isProfit = sess.realized_profit_idr >= 0;

              return (
                <Link 
                  key={sess.id}
                  href={`/sessions/${sess.id}`}
                  className="block group"
                >
                  <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                          <Layers className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              Sesi #{sess.id?.slice(0, 8)}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                              Aktif
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {new Date(sess.created_at).toLocaleDateString('id-ID', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="p-2 rounded-full text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Investasi</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{formatIDR(sess.total_invest_idr)}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Profit Realisasi</p>
                        <div className={`font-semibold flex items-center gap-1 ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {formatIDR(sess.realized_profit_idr)}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                        <span>Progress Penjualan</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{progress.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs mt-2 text-gray-500 dark:text-gray-400">
                        <span>Total: {sess.total_usdt.toFixed(2)} USDT</span>
                        <span>Sisa: {sess.remaining_usdt.toFixed(2)} USDT</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {loading && (
          <div className="space-y-4">
             {[1, 2].map((i) => (
               <div key={i} className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm animate-pulse h-64" />
             ))}
          </div>
        )}
      
        {!loading && activeSessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 text-center">
            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-6">
              <Layers className="w-10 h-10 text-blue-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Tidak ada sesi aktif</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-6">
              Mulai trading P2P dengan menambahkan transaksi pembelian baru.
            </p>
            <Link 
              href="/transaksi/new"
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
            >
              Mulai Trading Baru
            </Link>
          </div>
        )}
      </main>
    </PageWrapper>
  );
}
