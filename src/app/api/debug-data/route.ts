
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
    // We need to fetch ALL sales without limit. Supabase API has max limit, so we must paginate.
    
    // First, get all user sessions
    let allSessionIds: string[] = [];
    let sessionPage = 0;
    const sessionPageSize = 1000;
    
    while (true) {
      const { data: sessions, error: sessionError } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', user.id)
        .range(sessionPage * sessionPageSize, (sessionPage + 1) * sessionPageSize - 1);
        
      if (sessionError) throw sessionError;
      if (!sessions || sessions.length === 0) break;
      
      allSessionIds = [...allSessionIds, ...sessions.map(s => s.id)];
      if (sessions.length < sessionPageSize) break;
      sessionPage++;
    }

    // Now fetch sales for these sessions in chunks
    // Use chunks if sessionIds is too large
    const chunkSize = 1000;
    let userSales: any[] = [];
    let userSalesError = null;

    for (let i = 0; i < allSessionIds.length; i += chunkSize) {
      const chunk = allSessionIds.slice(i, i + chunkSize);
      
      // Fetch sales for this chunk of sessions, handling pagination if sales > 1000 per chunk
      // Since one session could have multiple sales, but usually not > 1000 per session
      // However, total sales for 1000 sessions could be > 1000.
      // So we need to paginate sales fetch too, OR just trust that 1000 sessions won't blow up 
      // the response limit if we select minimal fields.
      
      // Better approach: fetch sales using range/pagination for the whole set is hard without session_id filter.
      // So let's stick to chunking session_ids, but be aware of response size.
      // If we select minimal fields, we might fit more.
      
      // To be safe against 1000-row limit per request:
      let salesPage = 0;
      while(true) {
          const { data: chunkSales, error: chunkError } = await supabase
            .from('session_sales')
            .select('id, profit_idr, created_at') // Select minimal fields
            .in('session_id', chunk)
            .range(salesPage * 1000, (salesPage + 1) * 1000 - 1);
            
          if (chunkError) {
            userSalesError = chunkError;
            break;
          }
          
          if (!chunkSales || chunkSales.length === 0) break;
          
          userSales = [...userSales, ...chunkSales];
          
          if (chunkSales.length < 1000) break;
          salesPage++;
      }
      if (userSalesError) break;
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
