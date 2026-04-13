import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processSmartFIFOSell } from "@/lib/sessionManager";

type SessionRow = {
  id: string;
  created_at: string;
  avg_cost: number;
  remaining_usdt: number;
  realized_profit_idr: number;
  status: "active" | "closed";
};

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const price_idr = Number(body.price_idr);
    const sold_usdt = Number(body.sold_usdt);
    const tx_time = String(body.tx_time);
    const fee_idr = Number(body.fee_idr || 0);
    const label = String(body.label || "Binance");

    if (!Number.isFinite(price_idr) || price_idr <= 0) return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    if (!Number.isFinite(sold_usdt) || sold_usdt <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    if (!Number.isFinite(fee_idr) || fee_idr < 0) return NextResponse.json({ error: "Invalid fee" }, { status: 400 });
    if (!tx_time) return NextResponse.json({ error: "Invalid tx_time" }, { status: 400 });

    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("id, created_at, avg_cost, remaining_usdt, realized_profit_idr, status")
      .eq("user_id", user.id)
      .gt("remaining_usdt", 0.00000001)
      .order("created_at", { ascending: true });

    if (sessionsError) return NextResponse.json({ error: sessionsError.message }, { status: 500 });
    if (!sessions || sessions.length === 0) return NextResponse.json({ error: "Tidak ada sesi aktif untuk dijual" }, { status: 400 });

    const totalAvailable = (sessions as SessionRow[]).reduce((sum, s) => sum + Number(s.remaining_usdt || 0), 0);
    if (totalAvailable + 0.00000001 < sold_usdt) {
      return NextResponse.json({ error: `USDT tidak cukup. Tersedia: ${totalAvailable.toFixed(4)}` }, { status: 400 });
    }

    const result = processSmartFIFOSell(
      sessions as any,
      sold_usdt,
      price_idr,
      tx_time,
      fee_idr
    );

    const totalProceeds = sold_usdt * price_idr;
    const netProceeds = totalProceeds - fee_idr;

    const { data: txInsert, error: txErr } = await supabase
      .from("transactions")
      .insert([{
        user_id: user.id,
        tx_time,
        type: "SELL",
        price_idr,
        amount_usdt: sold_usdt,
        total_idr: netProceeds,
        fee_idr,
        label
      }])
      .select("id")
      .single();

    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });
    const txId = String(txInsert.id);

    for (const { session, sale } of result.affectedSessions) {
      const { error: sessionErr } = await supabase
        .from("sessions")
        .update({
          remaining_usdt: session.remaining_usdt,
          realized_profit_idr: session.realized_profit_idr,
          status: session.status
        })
        .eq("id", session.id);

      if (sessionErr) return NextResponse.json({ error: sessionErr.message }, { status: 500 });

      const { error: saleErr } = await supabase
        .from("session_sales")
        .insert([{
          session_id: sale.session_id,
          tx_id: txId,
          sold_usdt: sale.sold_usdt,
          proceeds_idr: sale.proceeds_idr,
          cost_idr: sale.cost_idr,
          profit_idr: sale.profit_idr,
          created_at: tx_time
        }]);

      if (saleErr) return NextResponse.json({ error: saleErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      tx_id: txId,
      total_profit: result.totalProfit
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

