export type TxType = 'BUY'|'SELL';
export type ExchangeLabel = 'Binance' | 'Bybit' | 'OKX' | 'Bitget' | 'Tokocrypto' | 'Other';

export interface Transaction {
  id?: string;
  user_id?: string;
  created_at?: string;  // When the record was created in database
  tx_time: string;      // Transaction date/time chosen by user
  type: 'BUY' | 'SELL';
  price_idr: number;
  amount_usdt: number;
  total_idr: number;
  fee_idr: number;
  session_id?: string;
  label?: ExchangeLabel;
  // Enriched fields from RPC
  profit_idr?: number;
  session_count?: number;
  status?: string;
  session_details?: Array<{
    session_date: string;
    sold_usdt: number;
    avg_cost: number;
    profit_idr: number;
    cost_idr: number;
  }>;
}

// Session-based types (replacing BuyLot)
export interface Session {
  id?: string;
  user_id?: string;
  created_at: string;
  price_idr?: number;
  total_invest_idr: number;
  total_usdt: number;
  avg_cost: number;
  remaining_usdt: number;
  realized_profit_idr: number;
  status: 'active' | 'closed';
}

export interface SessionSale {
  id?: string;            // uuid
  session_id: string;
  tx_id?: string;         // reference to transaction
  sold_usdt: number;
  proceeds_idr: number;
  cost_idr: number;
  profit_idr: number;
  created_at?: string;
}

// Legacy types (kept for migration compatibility)
export interface BuyLot {
  lot_id?: string;        // uuid from DB
  tx_id?: string;         // link to transaction id
  created_at: string;
  initial_usdt: number;
  remaining_usdt: number;
  avg_cost_idr_per_usdt: number;
  total_cost_idr: number;
}

export interface LotMatch {
  id?: string;            // uuid
  sell_tx_id: string;
  lot_id: string;
  matched_usdt: number;
  cost_idr: number;
  proceeds_idr: number;
  fee_idr: number;
  realized_pl_idr: number;
}
