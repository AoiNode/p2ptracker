"use client";
import { create } from "zustand";
import { supabase } from "@/lib/supabaseClient";
import { Session, SessionSale, Transaction, LotMatch, BuyLot, ExchangeLabel } from "@/lib/types";
import { createSession, processSellForSession, processSmartFIFOSell, computeSessionDashboard as calculateDashboardStats } from "@/lib/sessionManager";

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
  };
};

type Actions = {
  addBuySession: (price_idr: number, total_idr: number, dt?: Date, label?: ExchangeLabel, base_idr?: number) => Promise<void>;
  addBuySessionSmart: (price_idr: number, total_idr: number, dt?: Date, label?: ExchangeLabel, base_idr?: number) => Promise<void>;
  addSellSession: (session_id: string, price_idr: number, sold_usdt: number, dt?: Date, label?: ExchangeLabel) => Promise<void>;
  addSmartSell: (sold_usdt: number, price_idr: number, dt?: Date, fee?: number, feeType?: 'percent' | 'value', label?: ExchangeLabel) => Promise<void>;
  fetchAllSessions: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchDashboardStats: () => Promise<void>; // New action
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
    todayProfit: 0
  },
  
  fetchStats: async () => {
    const { sessions, transactions, sessionSales } = get();
    const totalProfit = sessionSales.reduce((sum, sale) => sum + sale.profit_idr, 0);
    const totalSalesVolume = transactions
      .filter(t => t.type === 'SELL')
      .reduce((sum, t) => sum + t.total_idr, 0);
    const totalBuyVolume = transactions
      .filter(t => t.type === 'BUY')
      .reduce((sum, t) => sum + t.total_idr, 0);
    const activeCapital = sessions.reduce((sum, s) => sum + (s.remaining_usdt * s.avg_cost), 0);

    set(state => ({
      stats: {
        ...state.stats,
        totalProfit,
        totalSalesVolume,
        salesCount: sessionSales.length,
        totalBuyVolume,
        activeCapital
      }
    }));
  },

  fetchDashboardStats: async () => {
    const { sessions, sessionSales, targetMonthly } = get();
    const dashboardData = calculateDashboardStats(sessions, sessionSales, targetMonthly);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayProfit = sessionSales
      .filter(sale => {
        const anySale = sale as any;
        const dateSource = anySale.created_at || anySale.transactions?.tx_time;
        if (!dateSource) return false;
        const saleDate = new Date(dateSource);
        return saleDate >= today && saleDate < tomorrow;
      })
      .reduce((sum, sale) => sum + sale.profit_idr, 0);

    set(state => ({
      stats: {
        ...state.stats,
        monthlyProfit: dashboardData.monthlyProfit,
        todayProfit
      }
    }));
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

  addBuySessionSmart: async (price_idr: number, total_idr: number, dt?: Date, label?: ExchangeLabel, base_idr?: number) => {
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
      // ALWAYS create a NEW unique session for each BUY transaction
      // This ensures 1-to-1 mapping and avoids confusion when viewing history
      const session = {
        created_at: tx_time,
        user_id: user.id,
        price_idr: price_idr,
        total_invest_idr: total_idr,
        total_usdt: amount_usdt,
        avg_cost: price_idr,
        remaining_usdt: amount_usdt,
        realized_profit_idr: 0,
        status: 'active'
      };
      
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .insert([session])
        .select()
        .single();
        
      if (sessionError) throw sessionError;
      const sessionId = sessionData.id;
      
      // Insert transaction with the newly created session_id
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .insert([{ ...newTx, session_id: sessionId }])
        .select()
        .single();
        
      if (txError) throw txError;
      
      // Refresh all data
      await get().fetchAllSessions();
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

  addSmartSell: async (sold_usdt: number, price_idr: number, dt = new Date(), fee = 0, feeType: 'percent' | 'value' = 'percent', label?: ExchangeLabel) => {
    const s = get();
    const tx_time = dt.toISOString();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    // Calculate fee
    const total_proceeds = sold_usdt * price_idr;
    const fee_idr = feeType === 'percent' ? (total_proceeds * fee / 100) : fee;
    
    // Fee is always subtracted from proceeds for SELL (all exchanges)
    const net_proceeds = total_proceeds - fee_idr;

    // Prefer atomic server-side RPC to prevent partial writes that can zero-out profit views.
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('process_sell_transaction', {
        p_user_id: user.id,
        p_price: price_idr,
        p_sold_usdt: sold_usdt,
        p_tx_time: tx_time,
        p_label: label || 'Binance',
        p_fee_idr: fee_idr
      });

      if (!rpcError && rpcData?.success) {
        await get().fetchAllSessions();
        await get().fetchDashboardStats();
        return;
      }

      // If RPC exists but returns business error, surface it clearly.
      if (!rpcError && rpcData && rpcData.success === false) {
        throw new Error(rpcData.error || 'SELL RPC gagal memproses transaksi');
      }
    } catch (rpcFallbackError: any) {
      // Fallback to legacy client-side flow below for environments where RPC is not installed yet.
      console.warn('Falling back to client-side smart sell flow:', rpcFallbackError?.message || rpcFallbackError);
    }
    
    try {
      // Process FIFO sell across multiple sessions (sort by date first to ensure proper FIFO)
    const sortedSessions = [...s.sessions].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const result = processSmartFIFOSell(
      sortedSessions,
      sold_usdt,
      price_idr,
      tx_time,
      fee_idr
    );

      // Create single SELL transaction
      const { data: txInsert, error: txErr } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          tx_time,
          type: 'SELL',
          price_idr,
          amount_usdt: sold_usdt,
          total_idr: net_proceeds,
          fee_idr,
          label: label || 'Binance'
        })
        .select("id")
        .single();
      
      if (txErr) throw txErr;
      const sell_tx_id = txInsert.id as string;

      // Update all affected sessions in database
      for (const { session, sale } of result.affectedSessions) {
        // Update session
        const { error: sessionErr } = await supabase
          .from("sessions")
          .update({
            remaining_usdt: session.remaining_usdt,
            realized_profit_idr: session.realized_profit_idr,
            status: session.status
          })
          .eq("id", session.id!);
        
        if (sessionErr) throw sessionErr;

        // Insert session_sale with tx_id
        const { error: saleErr } = await supabase
          .from("session_sales")
          .insert({
            session_id: sale.session_id,
            tx_id: sell_tx_id,
            sold_usdt: sale.sold_usdt,
            proceeds_idr: sale.proceeds_idr,
            cost_idr: sale.cost_idr,
            profit_idr: sale.profit_idr
          });
        
        if (saleErr) throw saleErr;
      }

      // Update local state
      const updatedSessions = s.sessions.map(sess => {
        const affected = result.affectedSessions.find(a => a.session.id === sess.id);
        return affected ? affected.session : sess;
      });

      const newSales = result.affectedSessions.map(a => ({
        ...a.sale,
        tx_id: sell_tx_id
      }));

      set({
        transactions: [
          {
            id: sell_tx_id,
            tx_time,
            type: 'SELL' as const,
            price_idr,
            amount_usdt: sold_usdt,
            total_idr: net_proceeds,
            fee_idr
          },
          ...s.transactions
        ],
        sessions: updatedSessions,
        sessionSales: [...newSales, ...s.sessionSales]
      });

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
    
    // Build query for sessions - Strategy: 
    // 1. Get ALL sessions where remaining_usdt > 0 (Active sessions from ANY time)
    // 2. Get closed sessions only from the last 90 days (Recent history)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysAgoStr = ninetyDaysAgo.toISOString();

    const { data: sessions } = await supabase.from("sessions")
      .select("*")
      .eq('user_id', user.id)
      .or(`remaining_usdt.gt.0.00000001,created_at.gt.${ninetyDaysAgoStr}`)
      .order("created_at", { ascending: true })
      .limit(10000); 
    
    // Build query for transactions - limited to last 1000 for performance, 
    // but ensured to cover the active session range
    const { data: txs } = await supabase.from("transactions")
      .select("*")
      .eq('user_id', user.id)
      .order("tx_time", { ascending: false })
      .limit(50000); // Increased from 5000 to 50000 for full export support
    
    // Fetch session_sales by transaction ids (more robust than relation-name joins across environments)
    const txIds = (txs || []).map((t: Transaction) => t.id).filter(Boolean) as string[];
    let sales: SessionSale[] = [];
    
    if (txIds.length > 0) {
      const { data: salesData, error: salesError } = await supabase.from("session_sales")
        .select("*")
        .in('tx_id', txIds)
        .order("created_at", { ascending: false })
        .limit(50000); // Increased from 10000 to 50000
      
      if (salesError) {
        console.error('Failed to fetch session_sales:', salesError);
      }
      sales = salesData || [];
    }

    set({
      transactions: txs || [],
      sessions: sessions || [],
      sessionSales: sales || []
    });
    
    // Also fetch stats for accuracy
    await get().fetchStats();
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
  const { sessions, transactions, sessionSales, targetMonthly } = useSessionStore.getState();
  const dashboardData = calculateDashboardStats(sessions, sessionSales, targetMonthly);
  
  // Calculate total sell from transactions
  const totalSell = transactions
    .filter(t => t.type === 'SELL')
    .reduce((sum, t) => sum + t.total_idr, 0);

  // Calculate saldo akhir (ending balance)
  const saldoAkhir = dashboardData.totalInvestedIDR + dashboardData.totalRealizedProfit;
  
  // Count active sessions
  // Fixed: use remaining_usdt > 0.00000001 check to match sessionManager and ensure sessions with residue stay active
  const activeSessionsCount = sessions.filter((s: Session) => s.status === 'active' || s.remaining_usdt > 0.00000001).length;
  
  // Calculate today's profit
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const todayProfit = sessionSales
    .filter(sale => {
      const anySale = sale as any;
      const dateSource = anySale.created_at || anySale.transactions?.tx_time;
      if (!dateSource) return false;
      const saleDate = new Date(dateSource);
      return saleDate >= today && saleDate < tomorrow;
    })
    .reduce((sum, sale) => sum + sale.profit_idr, 0);

  return {
    totalBuy: dashboardData.totalInvestedIDR,
    totalSell,
    monthlyPL: dashboardData.monthlyProfit,
    todayPL: todayProfit,
    roi: dashboardData.roi,
    saldoAkhir,
    targetMonthly,
    progress: dashboardData.monthlyTargetAchievement,
    capitalUSDT: dashboardData.totalRemainingUSDT,
    activeSessionsCount
  };
}
