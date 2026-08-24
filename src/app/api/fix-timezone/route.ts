import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Legacy one-off repair endpoint. It is deliberately disabled by default and,
// when explicitly enabled, derives ownership from the bearer token only.
export async function POST(req: NextRequest) {
  if (process.env.ENABLE_LEGACY_REPAIR_ENDPOINTS !== "true") {
    return NextResponse.json({ error: "Repair endpoint disabled" }, { status: 404 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const start = "2025-10-19T16:00:00Z";
    const end = "2025-10-20T00:00:00Z";
    const { data: txs, error: txError } = await supabase.from("transactions")
      .select("id,tx_time").eq("user_id", user.id).gte("tx_time", start).lt("tx_time", end);
    if (txError) throw txError;

    let transactionsFixed = 0;
    for (const tx of txs || []) {
      const date = new Date(tx.tx_time);
      if (date.getUTCHours() < 16) continue;
      date.setUTCDate(date.getUTCDate() + 1);
      const { error } = await supabase.from("transactions").update({ tx_time: date.toISOString() })
        .eq("id", tx.id).eq("user_id", user.id);
      if (error) throw error;
      transactionsFixed++;
    }

    const { data: sessions, error: sessionError } = await supabase.from("sessions")
      .select("id,created_at").eq("user_id", user.id).gte("created_at", start).lt("created_at", end);
    if (sessionError) throw sessionError;

    let sessionsFixed = 0;
    for (const session of sessions || []) {
      const date = new Date(session.created_at);
      if (date.getUTCHours() < 16) continue;
      date.setUTCDate(date.getUTCDate() + 1);
      const { error } = await supabase.from("sessions").update({ created_at: date.toISOString() })
        .eq("id", session.id).eq("user_id", user.id);
      if (error) throw error;
      sessionsFixed++;
    }

    return NextResponse.json({ success: true, transactionsFixed, sessionsFixed });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Repair failed" }, { status: 500 });
  }
}
