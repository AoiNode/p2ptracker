import { BuyLot, LotMatch, Transaction } from "./types";
import dayjs from "dayjs";

export function createBuyLot(tx: Transaction): BuyLot {
  if (tx.type !== 'BUY') throw new Error('createBuyLot requires BUY tx');
  const lot: BuyLot = {
    created_at: tx.tx_time,
    initial_usdt: tx.amount_usdt,
    remaining_usdt: tx.amount_usdt,
    avg_cost_idr_per_usdt: tx.price_idr,
    total_cost_idr: tx.total_idr + (tx.fee_idr || 0),
  };
  return lot;
}

export function matchSellFIFO(sell: Transaction, lots: BuyLot[]): { matches: LotMatch[], updatedLots: BuyLot[] } {
  if (sell.type !== 'SELL') throw new Error('matchSellFIFO requires SELL tx');
  let toSell = sell.amount_usdt;
  const updated = lots.map(l=>({...l})).sort((a,b)=>dayjs(a.created_at).valueOf()-dayjs(b.created_at).valueOf());
  const matches: LotMatch[] = [];

  for(const lot of updated){
    if (toSell <= 0) break;
    if (lot.remaining_usdt <= 0) continue;

    const take = Math.min(toSell, lot.remaining_usdt);
    const proceeds = round2(take * sell.price_idr);
    const cost = round2(take * lot.avg_cost_idr_per_usdt);
    const realized = round2(proceeds - cost - (sell.fee_idr || 0));

    matches.push({
      sell_tx_id: "", // will fill after we insert SELL tx and know its id
      lot_id: lot.lot_id!, // expect from DB after fetch
      matched_usdt: take,
      cost_idr: cost,
      proceeds_idr: proceeds,
      fee_idr: sell.fee_idr || 0,
      realized_pl_idr: realized
    });
    lot.remaining_usdt = round8(lot.remaining_usdt - take);
    toSell = round8(toSell - take);
  }

  if (toSell > 0) {
    throw new Error(`Not enough inventory. Unmatched ${toSell} USDT`);
  }

  return { matches, updatedLots: updated };
}

function round2(n:number){ return Math.round(n*100)/100 }
function round8(n:number){ return Math.round(n*1e8)/1e8 }
