import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Fix transactions without user_id
    const { data: txsWithoutUser, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .is('user_id', null);

    if (fetchError) {
      console.error('Error fetching transactions:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (txsWithoutUser && txsWithoutUser.length > 0) {
      // Update all transactions without user_id to current user
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ user_id: user.id })
        .is('user_id', null);

      if (updateError) {
        console.error('Error updating transactions:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    // Fix sessions without user_id
    const { data: sessionsWithoutUser, error: sessionFetchError } = await supabase
      .from('sessions')
      .select('*')
      .is('user_id', null);

    if (sessionFetchError) {
      console.error('Error fetching sessions:', sessionFetchError);
      return NextResponse.json({ error: sessionFetchError.message }, { status: 500 });
    }

    if (sessionsWithoutUser && sessionsWithoutUser.length > 0) {
      // Update all sessions without user_id to current user
      const { error: updateSessionError } = await supabase
        .from('sessions')
        .update({ user_id: user.id })
        .is('user_id', null);

      if (updateSessionError) {
        console.error('Error updating sessions:', updateSessionError);
        return NextResponse.json({ error: updateSessionError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Fixed ${txsWithoutUser?.length || 0} transactions and ${sessionsWithoutUser?.length || 0} sessions`,
      transactionsFixed: txsWithoutUser?.length || 0,
      sessionsFixed: sessionsWithoutUser?.length || 0
    });

  } catch (error: any) {
    console.error('Error in fix-transactions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
