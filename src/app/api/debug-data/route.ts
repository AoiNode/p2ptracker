
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Count Sessions
    const { count: sessionCount, error: sessionError } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // 2. Count Transactions
    const { count: txCount, error: txError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // 3. Count Session Sales (Backend View)
    // We need to join with sessions to filter by user_id since session_sales doesn't have user_id
    const { data: salesData, error: salesError } = await supabase
      .from('session_sales')
      .select('id, session_id, profit_idr, created_at')
      .match({}) // No filter yet
      
    // Filter manually for safety or use join syntax if possible in JS client
    // Actually, let's just get all sales for the user's sessions
    const { data: userSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', user.id);
      
    const sessionIds = userSessions?.map(s => s.id) || [];
    
    // Use chunks if sessionIds is too large
    const chunkSize = 1000;
    let userSales: any[] = [];
    let userSalesError = null;

    for (let i = 0; i < sessionIds.length; i += chunkSize) {
      const chunk = sessionIds.slice(i, i + chunkSize);
      const { data: chunkSales, error: chunkError } = await supabase
        .from('session_sales')
        .select('*')
        .in('session_id', chunk);
        
      if (chunkError) {
        userSalesError = chunkError;
        break;
      }
      if (chunkSales) {
        userSales = [...userSales, ...chunkSales];
      }
    }

    const totalProfit = userSales?.reduce((sum, s) => sum + (s.profit_idr || 0), 0) || 0;

    return NextResponse.json({
      success: true,
      user_id: user.id,
      counts: {
        sessions: sessionCount,
        transactions: txCount,
        session_sales: userSales?.length || 0
      },
      financials: {
        total_profit_backend: totalProfit,
        sample_sales: userSales?.slice(0, 3)
      },
      errors: {
        session: sessionError,
        tx: txError,
        sales: userSalesError
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
