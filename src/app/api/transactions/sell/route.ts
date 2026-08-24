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
    const sold = Number(body.sold_usdt);
    const txTime = String(body.tx_time || "");
    const fee = Number(body.fee_idr || 0);
    const label = String(body.label || "Binance");

    if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    if (!Number.isFinite(sold) || sold <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    if (!Number.isFinite(fee) || fee < 0) return NextResponse.json({ error: "Invalid fee" }, { status: 400 });
    if (!txTime || !Number.isFinite(Date.parse(txTime))) return NextResponse.json({ error: "Invalid tx_time" }, { status: 400 });

    const args = {
      p_user_id: user.id,
      p_price: price,
      p_sold_usdt: sold,
      p_tx_time: txTime,
      p_label: label,
      p_fee_idr: fee
    };
    let { data, error } = await supabase.rpc("process_sell_transaction_v2", args);

    // Keep writes available while the v2 migration rolls out. The existing v1
    // function is still atomic; v2 additionally enforces historical FIFO cutoff.
    if (error?.code === "PGRST202") {
      ({ data, error } = await supabase.rpc("process_sell_transaction", args));
    }

    if (error) {
      const message = error.message || "Gagal menyimpan SELL";
      const status = /tidak cukup|invalid/i.test(message) ? 400 : 500;
      return NextResponse.json({ error: message }, { status });
    }
    if (data?.success === false) {
      return NextResponse.json({ error: data.error || "SELL ditolak" }, { status: 400 });
    }
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
