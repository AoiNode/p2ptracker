"use client";
import { useEffect, useState } from "react";
import { useSessionStore } from "@/stores/useSessionStore";
import PageWrapper from "@/components/PageWrapper";
import { formatIDR } from "@/lib/utils";
import Link from "next/link";
import { Calendar, Filter, Search, X, Layers, ArrowRight, TrendingUp, TrendingDown, Clock, CheckCircle2 } from "lucide-react";

export default function SessionHistoryPage() {
  const sessions = useSessionStore(s => s.sessions);
  const fetchAllSessions = useSessionStore(s => s.fetchAllSessions);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAllSessions().finally(() => setLoading(false));
  }, [fetchAllSessions]);

  const filteredSessions = sessions.filter(sess => {
    if (filter !== 'all' && sess.status !== filter) return false;
    
    const sessDate = new Date(sess.created_at);
    sessDate.setHours(0, 0, 0, 0);
    
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (sessDate < start) return false;
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (sessDate > end) return false;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const idMatch = (sess.id || '').toLowerCase().includes(query);
      if (!idMatch) return false;
    }

    return true;
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const totalInvested = sessions.reduce((sum, s) => sum + s.total_invest_idr, 0);
  const totalRealized = sessions.reduce((sum, s) => sum + s.realized_profit_idr, 0);
  const totalROI = totalInvested > 0 ? (totalRealized / totalInvested) * 100 : 0;

  return (
    <PageWrapper>
      <main className="pb-32 px-4 pt-6 dark:bg-gray-900 min-h-screen">
        {/* Header Section */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Riwayat Aktivitas</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Pantau performa semua sesi transaksi
            </p>
          </div>
          <Link 
            href="/sessions" 
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            Kembali
          </Link>
        </div>

        {/* Summary Stats Card */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mb-8">
          <div className="grid grid-cols-3 gap-4 divide-x divide-gray-100 dark:divide-gray-700">
            <div className="text-center px-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Sesi</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{sessions.length}</p>
            </div>
            <div className="text-center px-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Profit</p>
              <p className={`text-2xl font-bold ${totalRealized >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatIDR(totalRealized)}
              </p>
            </div>
            <div className="text-center px-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">ROI</p>
              <p className={`text-2xl font-bold ${totalROI >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {totalROI.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 mb-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex p-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl w-full md:w-auto">
              {(['all', 'active', 'closed'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filter === tab 
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {tab === 'all' ? 'Semua' : tab === 'active' ? 'Aktif' : 'Selesai'}
                </button>
              ))}
            </div>
            
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari ID Sesi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5">
            <Calendar className="w-4 h-4 text-gray-500" />
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none text-sm text-gray-600 dark:text-gray-300 focus:ring-0 p-0 w-full"
            />
            <span className="text-gray-400">-</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none text-sm text-gray-600 dark:text-gray-300 focus:ring-0 p-0 w-full"
            />
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="ml-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Session List */}
        {!loading && filteredSessions.length > 0 ? (
          <div className="space-y-3">
            {filteredSessions.map((sess) => {
              const isActive = sess.status === 'active';
              const isProfit = sess.realized_profit_idr >= 0;
              
              return (
                <Link 
                  key={sess.id}
                  href={`/sessions/${sess.id}`}
                  className="block group"
                >
                  <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          isActive 
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {isActive ? <Layers className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-gray-900 dark:text-white">
                              Sesi #{sess.id ? sess.id.slice(0, 8) : 'Unknown'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isActive 
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {isActive ? 'Active' : 'Closed'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(sess.created_at).toLocaleDateString('id-ID', { 
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className={`font-bold ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {formatIDR(sess.realized_profit_idr)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Invest: {formatIDR(sess.total_invest_idr)}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          !loading && (
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-gray-900 dark:text-white font-medium mb-1">Tidak ada sesi ditemukan</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Coba ubah filter pencarian Anda</p>
              <button 
                onClick={() => { setFilter('all'); setStartDate(''); setEndDate(''); setSearchQuery(''); }}
                className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline"
              >
                Reset Filter
              </button>
            </div>
          )
        )}

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm animate-pulse h-24" />
            ))}
          </div>
        )}
      </main>
    </PageWrapper>
  );
}
