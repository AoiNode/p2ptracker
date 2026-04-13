import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
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

    const { data: txRows, error: txErr } = await supabase
      .from("transactions")
      .select("id, tx_time, type, price_idr, amount_usdt, total_idr, fee_idr, session_id, label")
      .eq("user_id", user.id)
      .order("tx_time", { ascending: false })
      .limit(50);

    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

    const sellTxIds = (txRows || []).filter(t => t.type === "SELL").map(t => t.id).filter(Boolean);

    const { data: salesRows, error: salesErr } = await supabase
      .from("session_sales")
      .select("id, tx_id, session_id, sold_usdt, proceeds_idr, cost_idr, profit_idr, created_at")
      .in("tx_id", sellTxIds.length > 0 ? sellTxIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false })
      .limit(200);

    if (salesErr) return NextResponse.json({ error: salesErr.message }, { status: 500 });

    const byTx: Record<string, { profit: number; count: number }> = {};
    for (const row of salesRows || []) {
      const key = String(row.tx_id);
      if (!byTx[key]) byTx[key] = { profit: 0, count: 0 };
      byTx[key].profit += Number(row.profit_idr || 0);
      byTx[key].count += 1;
    }

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email },
      counts: {
        tx_total: (txRows || []).length,
        sell_tx_total: sellTxIds.length,
        sales_rows: (salesRows || []).length
      },
      latest_transactions: txRows || [],
      latest_session_sales: salesRows || [],
      sell_profit_by_tx: byTx
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
