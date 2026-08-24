import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const price = Number(body.price_idr);
    const total = Number(body.total_idr);
    const amount = Number(body.amount_usdt);
    const txTime = String(body.tx_time || "");
    const label = String(body.label || "Binance");

    if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    if (!Number.isFinite(total) || total <= 0) return NextResponse.json({ error: "Invalid total" }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    if (!txTime || !Number.isFinite(Date.parse(txTime))) return NextResponse.json({ error: "Invalid tx_time" }, { status: 400 });

    const args = {
      p_user_id: user.id,
      p_price: price,
      p_amount_usdt: amount,
      p_total_idr: total,
      p_tx_time: txTime,
      p_label: label
    };
    let { data, error } = await supabase.rpc("process_buy_transaction_v2", args);

    // Backward-compatible deploy order: existing installations already have the
    // atomic v1 RPC. The v2 migration can be applied before or after this app build.
    if (error?.code === "PGRST202") {
      ({ data, error } = await supabase.rpc("process_buy_transaction", args));
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
