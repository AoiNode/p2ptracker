"use client";
import { create } from "zustand";
import { supabase } from "@/lib/supabaseClient";
import { Session, SessionSale, Transaction, LotMatch, BuyLot, ExchangeLabel } from "@/lib/types";
import { createSession, processSellForSession, processSmartFIFOSell, computeSessionDashboard as calculateDashboardStats } from "@/lib/sessionManager";
import { fetchAllPages } from "@/lib/dataScale";

type State = {
  transactions: Transaction[];
  sessions: Session[];
  lotMatches: LotMatch[];
  buyLots: BuyLot[];
  sessionSales: SessionSale[];
  targetMonthly: number;
  stats: {
    totalProfit: number;
    totalSalesVolume: number;
    salesCount: number;
    totalBuyVolume: number;
    activeCapital: number;
    monthlyProfit: number; // New
    todayProfit: number;   // New
    // Server-computed dashboard totals (via get_dashboard_totals RPC).
    totalInvested: number;
    totalRealizedProfit: number;
    remainingUsdt: number;
    roi: number;
    // True once get_dashboard_totals has returned successfully at least once.
    // Components use this to decide between server numbers and the client-side
    // fallback (computeSessionDashboard), so a failed/pending RPC never blanks the UI.
    ready: boolean;
  };
};

type Actions = {
  addBuySession: (price_idr: number, total_idr: number, dt?: Date, label?: ExchangeLabel, base_idr?: number) => Promise<void>;
  addBuySessionSmart: (price_idr: number, total_idr: number, dt?: Date, label?: ExchangeLabel, base_idr?: number, refresh?: boolean) => Promise<void>;
  addSellSession: (session_id: string, price_idr: number, sold_usdt: number, dt?: Date, label?: ExchangeLabel) => Promise<void>;
  addSmartSell: (sold_usdt: number, price_idr: number, dt?: Date, fee?: number, feeType?: 'percent' | 'value', label?: ExchangeLabel, refresh?: boolean) => Promise<void>;
  fetchAllSessions: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchDashboardStats: () => Promise<void>; // New action
  fetchDashboardTotals: () => Promise<void>; // Server-side dashboard totals (WIB-aware)
  getActiveSessions: () => Session[];
  setTargetMonthly: (target: number) => Promise<void>;
};

export const useSessionStore = create<State & Actions>((set, get) => ({
  transactions: [],
  sessions: [],
  sessionSales: [],
  lotMatches: [],
  buyLots: [],
  targetMonthly: 3000000,
  stats: {
    totalProfit: 0,
    totalSalesVolume: 0,
    salesCount: 0,
    totalBuyVolume: 0,
    activeCapital: 0,
    monthlyProfit: 0,
    todayProfit: 0,
    totalInvested: 0,
    totalRealizedProfit: 0,
    remainingUsdt: 0,
    roi: 0,
    ready: false
  },
  
  fetchStats: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Call RPC function for stats
    const { data, error } = await supabase.rpc('get_user_stats', { target_user_id: user.id });
    
    if (!error && data) {
      set(state => ({
        stats: {
          ...state.stats, // Keep existing stats
          totalProfit: data.total_profit || 0,
          totalSalesVolume: data.total_sales_volume || 0,
          salesCount: data.sales_count || 0,
          totalBuyVolume: data.total_buy_volume || 0,
          activeCapital: data.active_capital || 0
        }
      }));
    } else {
      console.warn("Failed to fetch server-side stats", error);
    }
  },

  fetchDashboardStats: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Call RPC function for dashboard stats
    const { data, error } = await supabase.rpc('get_monthly_stats', { target_user_id: user.id });
    
    if (!error && data) {
      set(state => ({
        stats: {
          ...state.stats, // Keep existing stats
          monthlyProfit: data.monthly_profit || 0,
          todayProfit: data.today_profit || 0
        }
      }));
    } else {
      console.warn("Failed to fetch dashboard stats", error);
    }
  },

  // Server-side dashboard totals via get_dashboard_totals RPC.
  // Postgres aggregates directly from base tables using WIB (Asia/Jakarta) day/month
  // boundaries, so numbers match the old client-side computeSessionDashboard exactly
  // but without downloading every row. On success, stats.ready flips true and the UI
  // switches from the client fallback to these server numbers.
  fetchDashboardTotals: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.rpc('get_dashboard_totals', { target_user_id: user.id });

    if (!error && data) {
      set(state => ({
        stats: {
          ...state.stats,
          totalInvested: data.total_invested || 0,
          totalRealizedProfit: data.total_realized_profit || 0,
          remainingUsdt: data.remaining_usdt || 0,
          monthlyProfit: data.monthly_profit || 0,
          todayProfit: data.today_profit || 0,
          roi: data.roi || 0,
          ready: true
        }
      }));
    } else {
      // Leave stats.ready as-is (likely false) so the UI keeps using the client
      // fallback instead of showing zeros. RPC not deployed yet == graceful degrade.
      console.warn("Failed to fetch dashboard totals", error);
    }
  },
  
  setTargetMonthly: async (target: number) => {
    set({ targetMonthly: target });
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    try {
      // Save to database
      await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          setting_key: 'monthly_target',
          setting_value: target.toString()
        }, {
          onConflict: 'user_id,setting_key'
        });
    } catch (error) {
      console.error('Error saving monthly target:', error);
    }
  },

  addBuySessionSmart: async (price_idr: number, total_idr: number, dt?: Date, label?: ExchangeLabel, base_idr?: number, refresh = true) => {
    const tx_time = (dt || new Date()).toISOString();
    // For Tokocrypto BUY: calculate from base_idr and reduce by 0.0222%
    // For others: use total_idr as usual
    let amount_usdt;
    if (base_idr && label === 'Tokocrypto') {
      const baseUsdt = base_idr / price_idr;
      amount_usdt = baseUsdt * (1 - 0.0222 / 100); // Reduce by 0.0222%
    } else {
      amount_usdt = total_idr / price_idr;
    }
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    // Create transaction
    const newTx: Transaction = {
      tx_time,
      type: 'BUY',
      price_idr,
      amount_usdt,
      total_idr,
      fee_idr: 0,
      user_id: user.id,
      label: label || 'Binance'
    };
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('User not authenticated');

      const res = await fetch('/api/transactions/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          price_idr,
          total_idr,
          amount_usdt,
          tx_time,
          label: label || 'Binance'
        })
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Gagal menyimpan BUY');

      if (refresh) await get().fetchAllSessions();
    } catch (error) {
      console.error('Error adding buy session:', error);
      throw error;
    }
  },
  
  // Keep old function for compatibility
  addBuySession: async (price_idr: number, total_idr: number, dt?: Date, label?: ExchangeLabel, base_idr?: number) => {
    // Call the smart version with optional base_idr
    return get().addBuySessionSmart(price_idr, total_idr, dt, label, base_idr);
  },

  addSellSession: async (session_id: string, price_idr: number, sold_usdt: number, dt = new Date()) => {
    const total_idr = Math.round(price_idr * sold_usdt * 100) / 100;
    const tx: Transaction = {
      tx_time: dt.toISOString(),
      type: 'SELL',
      price_idr,
      amount_usdt: sold_usdt,
      total_idr,
      fee_idr: 0
    };

    const s = get();
    const session = s.sessions.find((sess: Session) => sess.id === session_id);
    
    if (!session) throw new Error("Session not found");
    
    // Process sell against session
    const { updatedSession, sale } = processSellForSession(tx, session, sold_usdt);

    // Insert SELL transaction
    const { data: txInsert, error: txErr } = await supabase.from("transactions").insert({
      tx_time: tx.tx_time,
      type: tx.type,
      price_idr: tx.price_idr,
      amount_usdt: tx.amount_usdt,
      total_idr: tx.total_idr,
      fee_idr: tx.fee_idr ?? 0
    }).select("id").single();
    
    if (txErr) throw txErr;
    const sell_tx_id = txInsert.id as string;

    // Update sale with tx_id
    sale.tx_id = sell_tx_id;

    // Update session in DB
    await supabase.from("sessions").update({
      remaining_usdt: updatedSession.remaining_usdt,
      realized_profit_idr: updatedSession.realized_profit_idr,
      status: updatedSession.status
    }).eq("id", session_id);

    // Insert session_sale
    await supabase.from("session_sales").insert({
      session_id: sale.session_id,
      tx_id: sale.tx_id,
      sold_usdt: sale.sold_usdt,
      proceeds_idr: sale.proceeds_idr,
      cost_idr: sale.cost_idr,
      profit_idr: sale.profit_idr
    });

    // Update local state
    const updatedSessions = s.sessions.map((sess: Session) => 
      sess.id === session_id ? updatedSession : sess
    );

    set({
      transactions: [{ ...tx, id: sell_tx_id }, ...s.transactions],
      sessions: updatedSessions,
      sessionSales: [sale, ...s.sessionSales]
    });
  },

  addSmartSell: async (sold_usdt: number, price_idr: number, dt = new Date(), fee = 0, feeType: 'percent' | 'value' = 'percent', label?: ExchangeLabel, refresh = true) => {
    const tx_time = dt.toISOString();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    // Calculate fee
    const total_proceeds = sold_usdt * price_idr;
    const fee_idr = feeType === 'percent' ? (total_proceeds * fee / 100) : fee;
    
    // Fee is always subtracted from proceeds for SELL (all exchanges)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('User not authenticated');

      const res = await fetch('/api/transactions/sell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          price_idr,
          sold_usdt,
          tx_time,
          fee_idr,
          label: label || 'Binance'
        })
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Gagal menyimpan SELL');

      if (refresh) {
        await get().fetchAllSessions();
        await get().fetchDashboardStats();
      }
      return;

    } catch (error: any) {
      console.error('Error in addSmartSell:', error);
      throw error;
    }
  },

  fetchAllSessions: async () => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Load monthly target for this user
    const { data: settingsData } = await supabase
      .from('user_settings')
      .select('*')
      .eq('setting_key', 'monthly_target')
      .eq('user_id', user.id)
      .single();
    
    if (settingsData) {
      set({ targetMonthly: parseInt(settingsData.setting_value) });
    }
    
    // Load ALL sessions for the user (no time window).
    // Rationale: the dashboard computes Total Profit & ROI from
    // SUM(sessions.realized_profit_idr). The old 90-day window excluded old
    // closed sessions, so realized profit from those (e.g. an old BUY lot that a
    // recent FIFO SELL drew down) was silently dropped -> statistik undercounted
    // and profit "disappeared" after a refetch. Personal-scale data (<10k rows)
    // makes a full load safe.
    // PostgREST commonly caps each response at 1,000 rows even when .limit(10000)
    // is requested. Explicit pagination prevents sessions/USDT from disappearing
    // once an account grows beyond that cap.
    const [sessions, txs, sales] = await Promise.all([
      fetchAllPages<Session>((from, to) => supabase.from("sessions")
        .select("*")
        .eq('user_id', user.id)
        .order("created_at", { ascending: true })
        .range(from, to)),
      fetchAllPages<Transaction>((from, to) => supabase.from("transactions")
        .select("*")
        .eq('user_id', user.id)
        .order("tx_time", { ascending: false })
        .range(from, to)),
      fetchAllPages<SessionSale>((from, to) => supabase.from("session_sales")
        .select(`
          *,
          sessions!inner ( user_id ),
          transactions!session_sales_tx_id_fkey (
            id, price_idr, amount_usdt, total_idr, tx_time, type
          )
        `)
        .eq('sessions.user_id', user.id)
        .order("created_at", { ascending: false })
        .range(from, to))
    ]);

    set({ transactions: txs, sessions, sessionSales: sales });
    
    // Also fetch server-side stats/totals for accuracy.
    // fetchStats() feeds the legacy stats fields; fetchDashboardTotals() feeds the
    // WIB-aware server totals the dashboard/statistik pages now prefer.
    await Promise.all([
      get().fetchStats(),
      get().fetchDashboardTotals()
    ]);
  },

  getActiveSessions: () => {
    const { sessions } = get();
    // Filter active sessions and sort by created_at (oldest first for FIFO)
    return sessions
      .filter((s: Session) => (s.status === 'active' || s.remaining_usdt > 0.00000001))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
}));

export function computeSessionDashboard() {
  const { sessions, transactions, sessionSales, targetMonthly, stats } = useSessionStore.getState();
  const dashboardData = calculateDashboardStats(sessions, sessionSales, targetMonthly);

  // Calculate total sell from transactions (kept client-side; cheap and only used for display)
  const totalSell = transactions
    .filter(t => t.type === 'SELL')
    .reduce((sum, t) => sum + t.total_idr, 0);

  // Count active sessions
  // Fixed: use remaining_usdt > 0.00000001 check to match sessionManager and ensure sessions with residue stay active
  const activeSessionsCount = sessions.filter((s: Session) => s.status === 'active' || s.remaining_usdt > 0.00000001).length;

  // --- CLIENT-SIDE FALLBACK (used until server totals are ready) ---
  // Today's profit computed on the device's local day boundary.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const clientTodayProfit = sessionSales
    .filter(sale => {
      const anySale = sale as any;
      const dateSource = anySale.created_at || anySale.transactions?.tx_time;
      if (!dateSource) return false;
      const saleDate = new Date(dateSource);
      return saleDate >= today && saleDate < tomorrow;
    })
    .reduce((sum, sale) => sum + sale.profit_idr, 0);

  // --- SOURCE SELECTION ---
  // Prefer the server-computed totals (get_dashboard_totals RPC) once ready: they
  // aggregate every row in Postgres using WIB boundaries, so nothing is dropped by a
  // client fetch window and it scales regardless of transaction count. If the RPC
  // hasn't returned yet (or failed / not deployed), transparently fall back to the
  // client math so the UI never shows zeros or goes blank.
  const useServer = stats.ready;

  const totalBuy       = useServer ? stats.totalInvested       : dashboardData.totalInvestedIDR;
  const realizedProfit = useServer ? stats.totalRealizedProfit : dashboardData.totalRealizedProfit;
  const monthlyPL      = useServer ? stats.monthlyProfit       : dashboardData.monthlyProfit;
  const todayPL        = useServer ? stats.todayProfit         : clientTodayProfit;
  const roi            = useServer ? stats.roi                 : dashboardData.roi;
  const capitalUSDT    = useServer ? stats.remainingUsdt       : dashboardData.totalRemainingUSDT;

  // Saldo akhir (ending balance) = modal + profit terealisasi.
  const saldoAkhir = totalBuy + realizedProfit;

  // Monthly target achievement recomputed from the chosen monthlyPL for consistency.
  const progress = targetMonthly > 0
    ? (monthlyPL >= targetMonthly ? 100 : (monthlyPL / targetMonthly) * 100)
    : 0;

  return {
    totalBuy,
    totalSell,
    monthlyPL,
    todayPL,
    roi,
    saldoAkhir,
    targetMonthly,
    progress,
    capitalUSDT,
    activeSessionsCount
  };
}
