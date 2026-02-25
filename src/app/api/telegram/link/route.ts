import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Get Supabase client with service role
 */
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(url, key);
}

/**
 * POST /api/telegram/link
 * Generate linking code for current user
 */
export async function POST(request: NextRequest) {
  try {
    // Get user ID from request headers (passed from the client)
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header is required' },
        { status: 401 }
      );
    }

    // Extract token from Bearer header
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return NextResponse.json(
        { error: 'Invalid authorization header format' },
        { status: 401 }
      );
    }

    // Verify the token and get user ID
    const supabase = getSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Invalid token:', userError);
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const userId = user.id;
    console.log('Authenticated user ID:', userId);
    
    // Pastikan userId adalah UUID yang valid
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      console.error('Invalid UUID format for user_id:', userId);
      return NextResponse.json(
        { error: 'Invalid user ID format' },
        { status: 400 }
      );
    }

    // Generate random 6-digit code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Store linking code in database (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    console.log('Inserting code to database:', { userId, code, expiresAt });
    
    // Gunakan service role client untuk bypass RLS
    const serviceClient = getSupabaseClient();
    
    const { data, error } = await serviceClient
      .from('telegram_linking_codes')
      .insert({
        user_id: userId,
        code,
        expires_at: expiresAt,
      })
      .select();
      
    console.log('Insert result:', { data, error });

    if (error) {
      console.error('Error storing linking code:', error);
      return NextResponse.json(
        { error: 'Failed to generate linking code' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      code,
      expiresAt,
    });
  } catch (error) {
    console.error('Error in link endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/telegram/link
 * Get linked Telegram account for current user
 */
export async function GET(request: NextRequest) {
  try {
    // Get user ID from request headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header is required' },
        { status: 401 }
      );
    }

    // Extract token from Bearer header
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return NextResponse.json(
        { error: 'Invalid authorization header format' },
        { status: 401 }
      );
    }

    // Verify the token and get user ID
    const supabase = getSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Invalid token:', userError);
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Get linked Telegram account
    const { data: linkedAccount, error: linkError } = await supabase
      .from('telegram_users')
      .select('telegram_user_id, telegram_username, telegram_first_name, connected_at')
      .eq('user_id', userId)
      .single();

    if (linkError) {
      // No linked account found
      if (linkError.code === 'PGRST116') {
        return NextResponse.json({
          success: true,
          linked: false,
        });
      }
      console.error('Error fetching linked account:', linkError);
      return NextResponse.json(
        { error: 'Failed to fetch linked account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      linked: true,
      account: {
        telegram_user_id: linkedAccount.telegram_user_id,
        telegram_username: linkedAccount.telegram_username,
        telegram_first_name: linkedAccount.telegram_first_name,
        connected_at: linkedAccount.connected_at,
      },
    });
  } catch (error) {
    console.error('Error in GET link endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/telegram/link
 * Unlink Telegram account for current user
 */
export async function DELETE(request: NextRequest) {
  try {
    // Get user ID from request headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header is required' },
        { status: 401 }
      );
    }

    // Extract token from Bearer header
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return NextResponse.json(
        { error: 'Invalid authorization header format' },
        { status: 401 }
      );
    }

    // Verify the token and get user ID
    const supabase = getSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Invalid token:', userError);
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Delete linked Telegram account
    const { error: deleteError } = await supabase
      .from('telegram_users')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error unlinking account:', deleteError);
      return NextResponse.json(
        { error: 'Failed to unlink account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Account unlinked successfully',
    });
  } catch (error) {
    console.error('Error in DELETE link endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
