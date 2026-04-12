
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { excelData, fileName, chatId, skipCleaning } = body;

    if (!excelData || !chatId) {
      console.error('Missing required data:', { hasExcel: !!excelData, chatId });
      return NextResponse.json({ error: 'Data Excel atau Chat ID tidak ditemukan' }, { status: 400 });
    }

    if (!TELEGRAM_BOT_TOKEN) {
      console.error('TELEGRAM_BOT_TOKEN is not configured');
      return NextResponse.json({ error: 'Konfigurasi Bot Telegram (Token) belum diset di server' }, { status: 500 });
    }

    // 2. Send Excel to Telegram
    console.log(`Sending archive to Telegram chat ${chatId}...`);
    const buffer = Buffer.from(excelData, 'base64');
    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    formData.append('chat_id', chatId.toString());
    formData.append('document', blob, fileName || 'rekap_p2p.xlsx');
    formData.append('caption', `📊 *Tutup Buku Bulanan*\nUser: ${user.email}\nTanggal: ${new Date().toLocaleDateString('id-ID')}`);

    const teleRes = await fetch(`${TELEGRAM_API_URL}${TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    const teleResult = await teleRes.json();
    if (!teleResult.ok) {
      console.error('Telegram API error:', teleResult);
      return NextResponse.json({ error: `Gagal mengirim ke Telegram: ${teleResult.description}` }, { status: 500 });
    }

    // 3. ARCHIVE DATA (Run RPC)
    console.log(`Cleaning up closed data for user ${user.id}...`);
    
    if (skipCleaning) {
      return NextResponse.json({ success: true, message: 'File dikirim, pembersihan dilewati.' });
    }

    // Call the new V2 RPC with SECURITY DEFINER
    const { data: archiveData, error: archiveError } = await supabase.rpc('archive_closed_data_v2', {
      target_user_id: user.id
    });

    if (archiveError) {
      console.error('Archive RPC error:', archiveError);
      // Special case: if file sent but cleaning failed
      return NextResponse.json({ 
        success: false, 
        error: `File terkirim, tapi gagal membersihkan database: ${archiveError.message}. Anda bisa mencoba 'Hanya Bersihkan Data' di menu Settings.`,
        partialSuccess: true 
      }, { status: 500 });
    }

    console.log('Monthly closing completed successfully:', archiveData);
    return NextResponse.json({ 
      success: true, 
      archiveStats: archiveData 
    });

  } catch (error: any) {
    console.error('Closing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
