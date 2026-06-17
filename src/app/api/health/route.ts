import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        {
          ok: false,
          db: { ok: false, error: "Missing Supabase env vars" },
          timestamp,
        },
        {
          status: 500,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const start = Date.now();
    const { error } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true });
    const latencyMs = Date.now() - start;

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          db: { ok: false, error: error.message },
          timestamp,
        },
        {
          status: 500,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        db: { ok: true, latencyMs },
        timestamp,
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        db: { ok: false, error: error?.message || "Unknown error" },
        timestamp,
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
