"use client";
import { create } from "zustand";
import { supabase } from "@/lib/supabaseClient";
import { BuyLot, LotMatch, Transaction } from "@/lib/types";
import { createBuyLot, matchSellFIFO } from "@/lib/lotManager";

type State = {
  transactions: Transaction[];
  buyLots: BuyLot[];
  lotMatches: LotMatch[];
  targetMonthly: number;
};

type Actions = {
  addBuy: (price_idr:number, total_idr:number, dt?: Date)=>Promise<void>;
  addSell: (price_idr:number, amount_usdt:number, dt?: Date)=>Promise<void>;
  fetchAll: ()=>Promise<void>;
};

function calcUSDT(total_idr:number, price:number){ return Math.round((total_idr / price) * 1e8)/1e8 }

export const useTransactionStore = create<State & Actions>((set, get)=>({
  transactions: [],
  buyLots: [],
  lotMatches: [],
  targetMonthly: 3_000_000,

  addBuy: async (price_idr, total_idr, dt=new Date())=>{
    const amount_usdt = calcUSDT(total_idr, price_idr);
    const tx: Transaction = {
      tx_time: dt.toISOString(),
      type: 'BUY',
      price_idr,
      amount_usdt,
      total_idr,
      fee_idr: 0
    };
    const lot = createBuyLot(tx);

    // Insert tx, get id
    const { data: txInsert, error: txErr } = await supabase.from("transactions").insert({
      tx_time: tx.tx_time,
      type: tx.type,
      price_idr: tx.price_idr,
      amount_usdt: tx.amount_usdt,
      total_idr: tx.total_idr,
      fee_idr: tx.fee_idr ?? 0
    }).select("id").single();
    if (txErr) throw txErr;
    const tx_id = txInsert.id as string;

    // Insert lot with tx_id
    const { data: lotIns, error: lotErr } = await supabase.from("buy_lots").insert({
      tx_id,
      created_at: tx.tx_time,
      initial_usdt: lot.initial_usdt,
      remaining_usdt: lot.remaining_usdt,
      avg_cost_idr_per_usdt: lot.avg_cost_idr_per_usdt,
      total_cost_idr: lot.total_cost_idr
    }).select("*").single();
    if (lotErr) throw lotErr;

    // update local cache (prepend)
    set(s=>({ 
      transactions: [{...tx, id: tx_id}, ...s.transactions],
      buyLots: [{...lot, lot_id: lotIns.lot_id, tx_id}, ...s.buyLots],
    }));
  },

  addSell: async (price_idr, amount_usdt, dt=new Date())=>{
    const total_idr = Math.round(price_idr * amount_usdt * 100)/100;
    const tx: Transaction = {
      tx_time: dt.toISOString(),
      type: 'SELL',
      price_idr,
      amount_usdt,
      total_idr,
      fee_idr: 0
    };

    const s = get();
    if (s.buyLots.length === 0) throw new Error("Tidak ada inventory untuk dijual");

    // We need lot ids (from DB), so ensure buyLots are from DB with lot_id set
    const { matches, updatedLots } = matchSellFIFO(tx, s.buyLots.map(l=>({...l})));

    // Insert SELL tx to DB, get its id
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

    // Update matches to include sell_tx_id then insert
    const matchesWithSell = matches.map(m => ({...m, sell_tx_id}));

    // Update remaining_usdt for each affected lot
    for (const lot of updatedLots) {
      if (!lot.lot_id) continue;
      await supabase.from("buy_lots").update({ remaining_usdt: lot.remaining_usdt }).eq("lot_id", lot.lot_id);
    }

    // Insert lot_matches
    if (matchesWithSell.length){
      await supabase.from("lot_matches").insert(matchesWithSell);
    }

    // Update local store
    set({
      transactions: [{...tx, id: sell_tx_id}, ...s.transactions],
      buyLots: updatedLots,
      lotMatches: [...matchesWithSell, ...s.lotMatches]
    });
  },

  fetchAll: async ()=>{
    const { data: txs } = await supabase.from("transactions").select("*").order("tx_time", { ascending: false });
    const { data: lots } = await supabase.from("buy_lots").select("*");
    const { data: matches } = await supabase.from("lot_matches").select("*");
    set({
      transactions: txs || [],
      buyLots: lots || [],
      lotMatches: matches || []
    });
  },
}));

export function computeDashboard(){
  const { transactions, lotMatches, targetMonthly } = useTransactionStore.getState();
  const buys = transactions.filter(t=>t.type==='BUY');
  const sells = transactions.filter(t=>t.type==='SELL');

  const totalBuy = buys.reduce((a,b)=>a+b.total_idr,0);
  const totalSell = sells.reduce((a,b)=>a+b.total_idr,0);
  const realized = lotMatches.reduce((a,b)=>a+b.realized_pl_idr,0);

  const monthlyPL = realized; // could filter by current month
  const roi = totalBuy ? (realized/totalBuy)*100 : 0;
  const saldoAkhir = totalBuy + realized;
  const progress = targetMonthly ? (saldoAkhir/targetMonthly)*100 : 0;

  return { totalBuy, totalSell, monthlyPL, roi, saldoAkhir, targetMonthly, progress };
}
