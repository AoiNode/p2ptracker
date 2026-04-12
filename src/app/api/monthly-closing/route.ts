
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

    // 3. RESET DATA & RESTORE ACTIVE INVENTORY
    console.log(`Resetting data for user ${user.id}...`);
    
    if (skipCleaning) {
      return NextResponse.json({ success: true, message: 'File dikirim, pembersihan dilewati.' });
    }

    const { data: archiveData, error: archiveError } = await supabase.rpc('monthly_close_reset_v1', {
      target_user_id: user.id
    });

    if (archiveError) {
      console.error('Archive RPC error:', archiveError);
      // Special case: if file sent but cleaning failed
      return NextResponse.json({ 
        success: false, 
        error: `File terkirim, tapi gagal reset database: ${archiveError.message}.`,
        partialSuccess: true 
      }, { status: 500 });
    }

    try {
      const snapshot = Array.isArray(archiveData?.active_snapshot) ? archiveData.active_snapshot : [];
      const restoredCount = Number(archiveData?.restored_sessions || 0);
      const totalUsdt = snapshot.reduce((sum: number, s: any) => sum + Number(s?.remaining_usdt || 0), 0);

      const lines = snapshot.slice(0, 20).map((s: any, idx: number) => {
        const usdt = Number(s?.remaining_usdt || 0).toFixed(2);
        const price = Number(s?.avg_cost || s?.price_idr || 0);
        const priceText = Math.round(price).toLocaleString('id-ID');
        return `${idx + 1}) ${usdt} USDT @ ${priceText}`;
      });

      const moreText = snapshot.length > 20 ? `\n(+${snapshot.length - 20} sesi lainnya)` : '';
      const text =
        `✅ Tutup Buku Selesai\n` +
        `Sesi aktif dipulihkan: ${restoredCount}\n` +
        `Total sisa: ${totalUsdt.toFixed(2)} USDT\n\n` +
        `Detail Snapshot:\n` +
        (lines.length > 0 ? lines.join('\n') : '- (Tidak ada sesi aktif tersisa)') +
        moreText;

      const msgRes = await fetch(`${TELEGRAM_API_URL}${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text })
      });

      const msgResult = await msgRes.json();
      if (!msgResult.ok) {
        console.error('Telegram sendMessage error:', msgResult);
        return NextResponse.json({
          success: true,
          archiveStats: archiveData,
          warning: `Reset berhasil, tapi gagal mengirim detail snapshot: ${msgResult.description}`
        });
      }
    } catch (e: any) {
      console.error('Failed to send snapshot detail:', e);
      return NextResponse.json({
        success: true,
        archiveStats: archiveData,
        warning: `Reset berhasil, tapi gagal mengirim detail snapshot: ${e.message}`
      });
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
