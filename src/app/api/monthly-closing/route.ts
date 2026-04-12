
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

    const { excelData, fileName, chatId } = await req.json();

    if (!excelData || !chatId) {
      return NextResponse.json({ error: 'Missing data or chatId' }, { status: 400 });
    }

    // 2. Send Excel to Telegram
    // excelData is expected to be a base64 string from the client
    const buffer = Buffer.from(excelData, 'base64');
    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    formData.append('chat_id', chatId);
    formData.append('document', blob, fileName || 'rekap_p2p.xlsx');
    formData.append('caption', `📊 *Tutup Buku Bulanan*\nUser: ${user.email}\nTanggal: ${new Date().toLocaleDateString('id-ID')}`);

    const teleRes = await fetch(`${TELEGRAM_API_URL}${TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    const teleResult = await teleRes.json();
    if (!teleResult.ok) {
      console.error('Telegram error:', teleResult);
      return NextResponse.json({ error: 'Gagal mengirim file ke Telegram: ' + teleResult.description }, { status: 500 });
    }

    // 3. ARCHIVE DATA (Run RPC)
    const { data: archiveData, error: archiveError } = await supabase.rpc('archive_closed_data', {
      target_user_id: user.id
    });

    if (archiveError) {
      console.error('Archive error:', archiveError);
      return NextResponse.json({ error: 'Gagal membersihkan data lama: ' + archiveError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      archiveStats: archiveData 
    });

  } catch (error: any) {
    console.error('Closing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
