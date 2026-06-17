import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        {
          status: "error",
          error: "Missing Supabase env vars",
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Simple query to keep Supabase alive — touches the database
    const { data, error } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        {
          status: "error",
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "ok",
      message: "Supabase keepalive ping successful",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        error: error?.message || "Unknown error",
        stack:
          process.env.NODE_ENV === "development" ? error?.stack : undefined,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
