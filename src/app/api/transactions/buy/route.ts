import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    const total_idr = Number(body.total_idr);
    const amount_usdt = Number(body.amount_usdt);
    const tx_time = String(body.tx_time);
    const label = String(body.label || "Binance");

    if (!Number.isFinite(price_idr) || price_idr <= 0) return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    if (!Number.isFinite(total_idr) || total_idr <= 0) return NextResponse.json({ error: "Invalid total" }, { status: 400 });
    if (!Number.isFinite(amount_usdt) || amount_usdt <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    if (!tx_time) return NextResponse.json({ error: "Invalid tx_time" }, { status: 400 });

    const session = {
      created_at: tx_time,
      user_id: user.id,
      price_idr,
      total_invest_idr: total_idr,
      total_usdt: amount_usdt,
      avg_cost: price_idr,
      remaining_usdt: amount_usdt,
      realized_profit_idr: 0,
      status: "active"
    };

    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .insert([session])
      .select("id")
      .single();

    if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });

    const { data: txData, error: txError } = await supabase
      .from("transactions")
      .insert([{
        user_id: user.id,
        tx_time,
        type: "BUY",
        price_idr,
        amount_usdt,
        total_idr,
        fee_idr: 0,
        session_id: sessionData.id,
        label
      }])
      .select("id")
      .single();

    if (txError) return NextResponse.json({ error: txError.message }, { status: 500 });

    return NextResponse.json({ success: true, tx_id: txData.id, session_id: sessionData.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

