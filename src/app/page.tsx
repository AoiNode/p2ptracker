"use client";
import { useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import ProfitCard from "@/components/ProfitCard";
import PageWrapper from "@/components/PageWrapper";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useSessionStore, computeSessionDashboard } from "@/stores/useSessionStore";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { BarChart3, Layers, ArrowRight } from "lucide-react";

// Lazy load non-critical components
const RecentTransactions = dynamic(() => import("@/components/RecentTransactions"), {
  loading: () => <LoadingSpinner size="medium" />,
  ssr: false
});
const InstallPWA = dynamic(() => import("@/components/InstallPWA"), { ssr: false });

export default function HomePage(){
  const { user } = useAuth();
  const fetchAllSessions = useSessionStore(s => s.fetchAllSessions);
  const fetchStats = useSessionStore(s => s.fetchStats);
  const sessions = useSessionStore(s => s.sessions);
  const transactions = useSessionStore(s => s.transactions);
  const stats = useSessionStore(s => s.stats); // Use server-side stats
  const s = computeSessionDashboard();
  
  useEffect(() => {
    if (user) {
      fetchAllSessions();
      fetchStats(); // Ensure stats are fetched
    }
  }, [user, fetchAllSessions, fetchStats]);

  const activeSessionsCount = sessions.filter(sess => sess.status === 'active').length;
  
  // Use server-side stats for Dashboard if available
  const dashboardMonthlyPL = stats.totalProfit > 0 ? stats.totalProfit : s.monthlyPL;
  // Note: monthlyPL in store might be total profit, need to check if it's filtered by month
  // Actually s.monthlyPL is calculated in computeSessionDashboard based on current month
  // But stats.totalProfit is ALL TIME.
  // We need daily stats for monthly filtering in dashboard too.
  
  // For now, let's trust s.monthlyPL because it filters by month in client side correctly
  // IF the data is loaded. Since we increased limit to 10000, client side data should be correct now.
  // The issue user reported "dashboard history not showing profit" might be due to 
  // missing session_sales data in client store.
  
  // Let's rely on the fix in useSessionStore (limit 10000) for now.
  // If we want to use server side for monthly, we need get_monthly_stats RPC.
  
  return (
    <PageWrapper>
      <main className="pb-32 px-4 pt-6 dark:bg-gray-900 min-h-screen">
        {/* Main Card */}
        <div className="mb-6">
          <ProfitCard 
            title="Profit Bulan Ini"
            monthlyPL={s.monthlyPL}
            todayPL={s.todayPL}
            capitalIDR={s.totalBuy}
            capitalUSDT={s.capitalUSDT}
            roi={s.roi}
            saldoAkhir={s.saldoAkhir}
            targetBulanan={s.targetMonthly}
            progress={s.progress}
          />
        </div>
        
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Link 
            href="/statistik"
            className="group relative overflow-hidden bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-300"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <BarChart3 className="w-16 h-16 text-blue-500" />
            </div>
            <div className="relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-1">Statistik</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Analisa performa trading</p>
            </div>
          </Link>
          
          <Link 
            href="/sessions"
            className="group relative overflow-hidden bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-300"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Layers className="w-16 h-16 text-purple-500" />
            </div>
            <div className="relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <Layers className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-1">Sesi Aktif</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{activeSessionsCount} sesi sedang berjalan</p>
            </div>
          </Link>
        </div>
        
        {/* Recent Transactions */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Transaksi Terbaru</h2>
            <Link href="/transaksi" className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:gap-2 transition-all">
              Lihat Semua <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <Suspense fallback={<LoadingSpinner size="medium" />}>
            <RecentTransactions transactions={transactions} />
          </Suspense>
        </div>

        <InstallPWA />
      </main>
    </PageWrapper>
  );
}
