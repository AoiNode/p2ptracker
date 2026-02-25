import { Session, SessionSale, Transaction } from "./types";

export interface DashboardData {
  totalInvestedIDR: number;
  totalRemainingUSDT: number;
  avgCost: number;
  totalRealizedProfit: number;
  monthlyProfit: number;
  roi: number;
  monthlyTarget: number;
  monthlyTargetAchievement: number;
}

/**
 * Create a new session from a BUY transaction
 */
export function createSession(tx: Transaction): Session {
  if (tx.type !== 'BUY') throw new Error('createSession requires BUY tx');
  
  const session: Session = {
    created_at: tx.tx_time,
    total_invest_idr: tx.total_idr + (tx.fee_idr || 0),
    total_usdt: tx.amount_usdt,
    avg_cost: tx.price_idr,
    remaining_usdt: tx.amount_usdt,
    realized_profit_idr: 0,
    status: 'active'
  };
  
  return session;
}

/**
 * Process a SELL transaction against a specific session
 */
export function processSellForSession(
  sell: Transaction,
  session: Session,
  sold_usdt: number
): { updatedSession: Session, sale: SessionSale } {
  if (sell.type !== 'SELL') throw new Error('processSellForSession requires SELL tx');
  if (!session.id) throw new Error('Session must have an ID');
  
  // Validate sufficient USDT in session
  if (sold_usdt > session.remaining_usdt) {
    throw new Error(`Insufficient USDT in session. Available: ${session.remaining_usdt}, Requested: ${sold_usdt}`);
  }
  
  // Calculate profit
  const proceeds_idr = round2(sold_usdt * sell.price_idr);
  const cost_idr = round2(sold_usdt * session.avg_cost);
  const profit_idr = round2(proceeds_idr - cost_idr - (sell.fee_idr || 0));
  
  // Create session sale record
  const sale: SessionSale = {
    session_id: session.id,
    tx_id: '', // will be filled after transaction insert
    sold_usdt: sold_usdt,
    proceeds_idr: proceeds_idr,
    cost_idr: cost_idr,
    profit_idr: profit_idr,
    created_at: sell.tx_time
  };
  
  // Update session
  const updatedSession = {
    ...session,
    remaining_usdt: round8(session.remaining_usdt - sold_usdt),
    realized_profit_idr: round2(session.realized_profit_idr + profit_idr),
    status: (session.remaining_usdt - sold_usdt <= 0.00000001) ? 'closed' as const : 'active' as const
  };
  
  return { updatedSession, sale };
}

/**
 * Get active sessions that have USDT available for selling
 */
export function getActiveSessions(sessions: Session[]): Session[] {
  return sessions.filter(s => s.status === 'active' || !s.status || s.remaining_usdt > 0);
}

/**
 * Calculate total statistics from sessions
 */
export function computeSessionDashboard(sessions: Session[], sessionSales: SessionSale[], targetMonthly = 3000000): DashboardData {
  // Calculate total balances
  const totalInvestedIDR = sessions.reduce((sum, s) => sum + s.total_invest_idr, 0);
  const totalRemainingUSDT = sessions.reduce((sum, s) => sum + s.remaining_usdt, 0);
  const avgCost = totalRemainingUSDT > 0 ? totalInvestedIDR / totalRemainingUSDT : 0;
  const totalRealizedProfit = sessions.reduce((sum, s) => sum + s.realized_profit_idr, 0);
  
  // Calculate monthly profit (sales from current month only)
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const startOfMonth = new Date(currentYear, currentMonth, 1);
  const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
  
  const monthlyProfit = sessionSales
    .filter(sale => {
      const anySale = sale as any;
      const dateSource = anySale.created_at || anySale.transactions?.tx_time;
      if (!dateSource) return false;
      const saleDate = new Date(dateSource);
      return saleDate >= startOfMonth && saleDate <= endOfMonth;
    })
    .reduce((sum, sale) => sum + sale.profit_idr, 0);
  
  return {
    totalInvestedIDR,
    totalRemainingUSDT,
    avgCost,
    totalRealizedProfit,
    monthlyProfit,
    roi: totalInvestedIDR > 0 ? (totalRealizedProfit / totalInvestedIDR) * 100 : 0,
    monthlyTarget: targetMonthly,
    monthlyTargetAchievement: monthlyProfit > targetMonthly ? 100 : (monthlyProfit / targetMonthly) * 100
  };
}

// Helper functions
function round2(n: number): number { 
  return Math.round(n * 100) / 100;
}

function round8(n: number): number { 
  return Math.round(n * 1e8) / 1e8;
}

/**
 * Process a smart FIFO sell across multiple sessions
 * Returns array of affected sessions and their corresponding sales
 */
export function processSmartFIFOSell(
  sessions: Session[],
  totalUsdtToSell: number,
  sellPrice: number,
  sellTime: string,
  feeIdr: number = 0
): {
  affectedSessions: Array<{ session: Session; sale: SessionSale }>;
  totalProfit: number;
  totalProceeds: number;
  totalCost: number;
} {
  // Get active sessions sorted by created_at (FIFO)
  const activeSessions = sessions
    .filter(s => s.remaining_usdt > 0 && s.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (activeSessions.length === 0) {
    throw new Error('Tidak ada sesi aktif dengan USDT tersisa');
  }

  const totalAvailable = activeSessions.reduce((sum, s) => sum + s.remaining_usdt, 0);
  if (totalAvailable < totalUsdtToSell) {
    throw new Error(`USDT tidak mencukupi. Tersedia: ${totalAvailable.toFixed(4)}, Diminta: ${totalUsdtToSell}`);
  }

  const affectedSessions: Array<{ session: Session; sale: SessionSale }> = [];
  let remainingToSell = totalUsdtToSell;
  let totalProfit = 0;
  let totalProceeds = 0;
  let totalCost = 0;
  let proportionalFeeUsed = 0;

  for (const session of activeSessions) {
    if (remainingToSell <= 0) break;

    const usdtFromThisSession = Math.min(remainingToSell, session.remaining_usdt);
    
    // Calculate proportional fee for this portion
    const proportionalFee = round2((usdtFromThisSession / totalUsdtToSell) * feeIdr);
    proportionalFeeUsed += proportionalFee;
    
    // Calculate profit for this portion
    const proceeds = round2(usdtFromThisSession * sellPrice);
    const cost = round2(usdtFromThisSession * session.avg_cost);
    const profit = round2(proceeds - cost - proportionalFee);

    // Create sale record (tx_id will be filled later)
    const sale: SessionSale = {
      session_id: session.id!,
      tx_id: '', // will be filled after transaction insert
      sold_usdt: usdtFromThisSession,
      proceeds_idr: proceeds,
      cost_idr: cost,
      profit_idr: profit,
      created_at: sellTime
    };

    // Update session
    const updatedSession = {
      ...session,
      remaining_usdt: round8(session.remaining_usdt - usdtFromThisSession),
      realized_profit_idr: round2(session.realized_profit_idr + profit),
      status: (session.remaining_usdt - usdtFromThisSession <= 0.00000001) ? 'closed' as const : 'active' as const
    };

    affectedSessions.push({ session: updatedSession, sale });
    
    remainingToSell = round8(remainingToSell - usdtFromThisSession);
    totalProfit += profit;
    totalProceeds += proceeds;
    totalCost += cost;
  }

  // Adjust last sale if there's any rounding difference in fee
  const feeDifference = feeIdr - proportionalFeeUsed;
  if (feeDifference !== 0 && affectedSessions.length > 0) {
    const lastItem = affectedSessions[affectedSessions.length - 1];
    lastItem.sale.profit_idr = round2(lastItem.sale.profit_idr - feeDifference);
    totalProfit = round2(totalProfit - feeDifference);
  }

  return {
    affectedSessions,
    totalProfit: round2(totalProfit),
    totalProceeds: round2(totalProceeds),
    totalCost: round2(totalCost)
  };
}
