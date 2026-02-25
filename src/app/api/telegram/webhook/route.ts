import { NextRequest, NextResponse } from 'next/server';
import { parseTelegramCommand, formatHelpMessage, BatchCommand, ParsedCommand, ParseResult } from '@/lib/telegramParser';
import { createClient } from '@supabase/supabase-js';
import { processSmartFIFOSell } from '@/lib/sessionManager';
import type { Session, SessionSale } from '@/lib/types';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

/**
 * Get Supabase client (lazy initialization)
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
 * Send message to Telegram
 */
async function sendTelegramMessage(chatId: number, text: string, parseMode: string = 'HTML') {
  try {
    const response = await fetch(
      `${TELEGRAM_API_URL}${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode,
        }),
      }
    );

    return await response.json();
  } catch (error) {
    console.error('Error sending telegram message:', error);
  }
}

/**
 * Process a single transaction (BUY or SELL)
 */
async function processSingleTransaction(
  command: ParsedCommand, 
  webUserId: string, 
  supabase: any
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const tx_time = new Date().toISOString();
    
    if (command.type === 'BUY') {
      // Calculate amount_usdt
      let amount_usdt: number;
      if (command.currency === 'IDR') {
        amount_usdt = command.amount / command.price;
      } else {
        amount_usdt = command.amount;
      }

      // Check for existing session with same price and remaining USDT > 0
      const { data: existingSessions, error: fetchError } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', webUserId)
        .eq('price_idr', command.price)
        .gt('remaining_usdt', 0)
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      let sessionId: string;
      const total_idr = command.currency === 'IDR' ? command.amount : command.amount * command.price;

      if (existingSessions && existingSessions.length > 0) {
        // Merge with existing session
        const existingSession = existingSessions[0];
        const new_total_usdt = existingSession.remaining_usdt + amount_usdt;
        const new_total_invest_idr = existingSession.total_invest_idr + total_idr;
        const new_avg_cost = new_total_invest_idr / new_total_usdt;

        const { data: updatedSession, error: updateError } = await supabase
          .from('sessions')
          .update({
            total_invest_idr: new_total_invest_idr,
            total_usdt: existingSession.total_usdt + amount_usdt,
            avg_cost: new_avg_cost,
            remaining_usdt: new_total_usdt
          })
          .eq('id', existingSession.id)
          .select()
          .single();

        if (updateError) throw updateError;
        sessionId = existingSession.id;
      } else {
        // Create new session
        const session = {
          created_at: tx_time,
          user_id: webUserId,
          price_idr: command.price,
          total_invest_idr: total_idr,
          total_usdt: amount_usdt,
          avg_cost: command.price,
          remaining_usdt: amount_usdt,
          realized_profit_idr: 0,
          status: 'active'
        };

        const { data: sessionData, error: sessionError } = await supabase
          .from('sessions')
          .insert([session])
          .select()
          .single();

        if (sessionError) throw sessionError;
        sessionId = sessionData.id;
      }

      // Insert transaction
      const txDataToInsert = {
        user_id: webUserId,
        tx_time,
        type: 'BUY',
        price_idr: command.price,
        amount_usdt,
        total_idr,
        fee_idr: 0,
        session_id: sessionId,
        label: command.exchange
      };
      
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .insert([txDataToInsert])
        .select()
        .single();

      if (txError) throw txError;

      const amountLabel = command.currency === 'IDR' 
        ? `Rp${command.amount.toLocaleString('id-ID')}` 
        : `$${command.amount}`;
      const priceLabel = `Rp${command.price.toLocaleString('id-ID')}`;
      const message = `✅ BUY: ${amountLabel} @ ${priceLabel} (${command.exchange}) → ${amount_usdt.toFixed(4)} USDT`;
      
      return { success: true, message };

    } else if (command.type === 'SELL') {
      // Calculate sold_usdt
      let sold_usdt: number;
      if (command.currency === 'IDR') {
        sold_usdt = command.amount / command.price;
      } else {
        sold_usdt = command.amount;
      }

      // Get active sessions for this user
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', webUserId)
        .gt('remaining_usdt', 0)
        .order('created_at', { ascending: true });

      if (sessionsError) throw sessionsError;

      if (!sessions || sessions.length === 0) {
        return { success: false, message: '', error: 'Tidak ada session aktif untuk dijual' };
      }

      // Process FIFO sell
      const result_fifo = processSmartFIFOSell(
        sessions as Session[],
        sold_usdt,
        command.price,
        tx_time,
        0 // fee_idr = 0 for Telegram
      );

      // Create SELL transaction
      const total_proceeds = sold_usdt * command.price;
      const sellTxData = {
        user_id: webUserId,
        tx_time,
        type: 'SELL',
        price_idr: command.price,
        amount_usdt: sold_usdt,
        total_idr: total_proceeds,
        fee_idr: 0,
        label: command.exchange
      };
      
      const { data: txInsert, error: txErr } = await supabase
        .from('transactions')
        .insert([sellTxData])
        .select('id')
        .single();

      if (txErr) throw txErr;
      const sell_tx_id = txInsert.id;
      
      // Update all affected sessions
      for (const { session, sale } of result_fifo.affectedSessions) {
        await supabase
          .from('sessions')
          .update({
            remaining_usdt: session.remaining_usdt,
            realized_profit_idr: session.realized_profit_idr,
            status: session.status
          })
          .eq('id', session.id!);

        await supabase
          .from('session_sales')
          .insert({
            session_id: sale.session_id,
            tx_id: sell_tx_id,
            sold_usdt: sale.sold_usdt,
            proceeds_idr: sale.proceeds_idr,
            cost_idr: sale.cost_idr,
            profit_idr: sale.profit_idr
          });
      }

      const amountLabel = command.currency === 'IDR' 
        ? `Rp${command.amount.toLocaleString('id-ID')}` 
        : `${sold_usdt.toFixed(4)} USDT`;
      const priceLabel = `Rp${command.price.toLocaleString('id-ID')}`;
      const profitLabel = result_fifo.totalProfit >= 0 ? `+Rp${result_fifo.totalProfit.toLocaleString('id-ID')}` : `Rp${result_fifo.totalProfit.toLocaleString('id-ID')}`;
      const message = `✅ SELL: ${amountLabel} @ ${priceLabel} (${command.exchange}) → Profit: ${profitLabel}`;
      
      return { success: true, message };
    }

    return { success: false, message: '', error: 'Command type tidak valid' };
  } catch (error: any) {
    console.error('Error processing single transaction:', error);
    return { success: false, message: '', error: error.message || 'Gagal memproses transaksi' };
  }
}

/**
 * Process batch command
 */
async function processBatchCommand(
  batchCommand: BatchCommand,
  webUserId: string,
  supabase: any
): Promise<string> {
  const results: string[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < batchCommand.commands.length; i++) {
    const command = batchCommand.commands[i];
    const lineNum = i + 1;

    if ('error' in command) {
      results.push(`${lineNum}. ❌ ${command.error}`);
      errorCount++;
      continue;
    }

    if (command.type === 'HELP') {
      results.push(`${lineNum}. 📋 Help command - lihat pesan terpisah`);
      successCount++;
      continue;
    }

    if (command.type === 'HISTORY_BUY' || command.type === 'HISTORY_SELL' || command.type === 'HISTORY_NEW') {
      results.push(`${lineNum}. 📊 History command tidak support di batch`);
      errorCount++;
      continue;
    }

    if (command.type === 'BUY' || command.type === 'SELL') {
      const result = await processSingleTransaction(command, webUserId, supabase);
      if (result.success) {
        results.push(`${lineNum}. ${result.message}`);
        successCount++;
      } else {
        results.push(`${lineNum}. ❌ ${result.error}`);
        errorCount++;
      }
    }
  }

  // Create summary message
  let summaryMessage = `🔄 *BATCH PROCESSING COMPLETE*\n\n`;
  summaryMessage += `✅ Success: ${successCount} transactions\n`;
  summaryMessage += `❌ Failed: ${errorCount} transactions\n\n`;
  summaryMessage += `*Details:*\n`;
  summaryMessage += results.join('\n');

  return summaryMessage;
}

/**
 * GET /api/telegram/webhook
 * Health check
 */
export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Telegram webhook is running' });
}

/**
 * POST /api/telegram/webhook
 * Receive messages from Telegram
 */
export async function POST(request: NextRequest) {
  console.log('[Telegram Webhook] Request received');
  
  try {
    const body = await request.json();
    console.log('[Telegram Webhook] Body parsed:', JSON.stringify(body, null, 2));

    // Handle message
    if (body.message) {
      const { message } = body;
      const chatId = message.chat.id;
      const telegramUserId = message.from.id;
      const text = message.text || '';

      console.log(`[Telegram] User ${telegramUserId}: ${text}`);

      // Check if user is trying to link account
      if (text.startsWith('/link ')) {
        const linkCode = text.substring(6).trim().toUpperCase();
        
        try {
          const supabase = getSupabaseClient();
          
          // Find linking code
          const { data: codeData, error: codeError } = await supabase
            .from('telegram_linking_codes')
            .select('user_id, expires_at')
            .eq('code', linkCode)
            .single();

          if (codeError || !codeData) {
            await sendTelegramMessage(chatId, '❌ Kode linking tidak valid atau sudah kadaluarsa.');
            return NextResponse.json({ ok: true });
          }

          // Check if code expired
          if (new Date(codeData.expires_at) < new Date()) {
            await sendTelegramMessage(chatId, '❌ Kode linking sudah kadaluarsa. Silakan generate kode baru di web.');
            return NextResponse.json({ ok: true });
          }

          // Check if already linked
          const { data: existingLink } = await supabase
            .from('telegram_users')
            .select('id')
            .eq('telegram_user_id', telegramUserId)
            .single();

          if (existingLink) {
            await sendTelegramMessage(chatId, '⚠️ Akun Telegram Anda sudah terhubung dengan web.');
            return NextResponse.json({ ok: true });
          }

          // Link account
          const { error: linkError } = await supabase
            .from('telegram_users')
            .upsert({
              user_id: codeData.user_id,
              telegram_user_id: telegramUserId,
              telegram_username: message.from.username || 'unknown',
              telegram_first_name: message.from.first_name || 'User',
              connected_at: new Date().toISOString(),
            }, {
              onConflict: 'telegram_user_id',
            });

          if (linkError) {
            console.error('Error linking account:', linkError);
            await sendTelegramMessage(chatId, '❌ Gagal menghubungkan akun. Silakan coba lagi.');
            return NextResponse.json({ ok: true });
          }

          // Delete used linking code
          await supabase
            .from('telegram_linking_codes')
            .delete()
            .eq('code', linkCode);

          // Send success message
          await sendTelegramMessage(
            chatId,
            '✅ Akun Telegram berhasil terhubung dengan web!\n\nSekarang Anda bisa mengirim command transaksi:\n\n🟢 BUY: buy $50 16750 bybit\n🔴 SELL: sell $50 16750 bybit\n📊 HISTORY: h b 10\n🆘 HELP: help'
          );
        } catch (error) {
          console.error('Error in linking process:', error);
          await sendTelegramMessage(chatId, '❌ Terjadi kesalahan. Silakan coba lagi.');
        }
        
        return NextResponse.json({ ok: true });
      }

      // Get web user_id from telegram_users table
      const supabase = getSupabaseClient();
      const { data: telegramUser, error: lookupError } = await supabase
        .from('telegram_users')
        .select('user_id')
        .eq('telegram_user_id', telegramUserId)
        .single();

      if (lookupError || !telegramUser) {
        await sendTelegramMessage(
          chatId,
          '❌ Akun Telegram belum terhubung dengan web.\n\nKetik /link untuk menghubungkan akun Anda.'
        );
        return NextResponse.json({ ok: true });
      }

      const webUserId = telegramUser.user_id;

      // Parse command
      const result = parseTelegramCommand(text);

      // Handle error
      if ('error' in result) {
        await sendTelegramMessage(chatId, `❌ ${result.error}`);
        return NextResponse.json({ ok: true });
      }

      // Handle HELP command
      if (result.type === 'HELP') {
        const helpMessage = formatHelpMessage();
        await sendTelegramMessage(chatId, helpMessage, 'Markdown');
        return NextResponse.json({ ok: true });
      }

      // Handle HISTORY commands
      if (result.type === 'HISTORY_BUY' || result.type === 'HISTORY_SELL' || result.type === 'HISTORY_NEW') {
        try {
          console.log('[Telegram] Processing history command:', { type: result.type, limit: result.limit, exchange: result.exchange, userId: webUserId });
          
          // Build query step by step
          let query = supabase
            .from('transactions')
            .select('*')
            .eq('user_id', webUserId);

          if (result.type === 'HISTORY_BUY') {
            query = query.eq('type', 'BUY');
          } else if (result.type === 'HISTORY_SELL') {
            query = query.eq('type', 'SELL');
          } else if (result.type === 'HISTORY_NEW') {
            // Get transactions from last 7 days
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            query = query.gte('tx_time', sevenDaysAgo.toISOString());
          }

          if (result.exchange) {
            query = query.eq('label', result.exchange);
          }

          query = query.order('tx_time', { ascending: false }).limit(result.limit);

          const { data: transactions, error: historyError } = await query;
          
          console.log('[Telegram] History query result:', { 
            count: transactions?.length || 0, 
            error: historyError?.message,
            transactions: transactions?.slice(0, 2) // Log first 2 for debugging
          });

          if (historyError) {
            console.error('[Telegram] Error fetching history:', historyError);
            await sendTelegramMessage(chatId, `❌ Gagal mengambil history transaksi: ${historyError.message}`);
            return NextResponse.json({ ok: true });
          }

          if (!transactions || transactions.length === 0) {
            const historyType = result.type === 'HISTORY_BUY' ? 'BUY' : result.type === 'HISTORY_SELL' ? 'SELL' : 'NEW';
            const exchange = result.exchange ? ` - ${result.exchange}` : '';
            await sendTelegramMessage(chatId, `📊 ${historyType} HISTORY${exchange}\n\nTidak ada transaksi ditemukan.`);
            return NextResponse.json({ ok: true });
          }

          // Format history message
          const historyType = result.type === 'HISTORY_BUY' ? '🟢 BUY' : result.type === 'HISTORY_SELL' ? '🔴 SELL' : '📊 NEW';
          const exchange = result.exchange ? ` - ${result.exchange}` : '';
          let message = `${historyType} HISTORY${exchange} (${transactions.length} terakhir)\n\n`;

          transactions.forEach((tx: any, index: number) => {
            try {
              const date = new Date(tx.tx_time).toLocaleDateString('id-ID');
              const amount = tx.type === 'BUY' 
                ? `Rp${Number(tx.total_idr).toLocaleString('id-ID')}`
                : `${Number(tx.amount_usdt).toFixed(4)} USDT`;
              const price = `Rp${Number(tx.price_idr).toLocaleString('id-ID')}`;
              const label = tx.label || 'Unknown';
              message += `${index + 1}. ${date} - ${amount} @ ${price} (${label})\n`;
            } catch (err) {
              console.error('[Telegram] Error formatting transaction:', err, tx);
            }
          });

          await sendTelegramMessage(chatId, message);
        } catch (error) {
          console.error('Error in history command:', error);
          await sendTelegramMessage(chatId, '❌ Terjadi kesalahan saat mengambil history.');
        }
        return NextResponse.json({ ok: true });
      }

      // Handle BATCH command
      if (result.type === 'BATCH') {
        try {
          console.log('[Telegram] Processing batch command with', result.commands.length, 'commands');
          const batchMessage = await processBatchCommand(result, webUserId, supabase);
          await sendTelegramMessage(chatId, batchMessage, 'Markdown');
        } catch (error: any) {
          console.error('Error processing batch command:', error);
          await sendTelegramMessage(chatId, `❌ Gagal memproses batch command: ${error.message || 'Unknown error'}`);
        }
        return NextResponse.json({ ok: true });
      }

      // Handle BUY/SELL commands
      if (result.type === 'BUY' || result.type === 'SELL') {
        try {
          const tx_time = new Date().toISOString();
          
          if (result.type === 'BUY') {
            // Calculate amount_usdt
            let amount_usdt: number;
            if (result.currency === 'IDR') {
              amount_usdt = result.amount / result.price;
            } else {
              amount_usdt = result.amount;
            }

            // Check for existing session with same price and remaining USDT > 0
            const { data: existingSessions, error: fetchError } = await supabase
              .from('sessions')
              .select('*')
              .eq('user_id', webUserId)
              .eq('price_idr', result.price)
              .gt('remaining_usdt', 0)
              .order('created_at', { ascending: false })
              .limit(1);

            if (fetchError) throw fetchError;

            let sessionId: string;
            const total_idr = result.currency === 'IDR' ? result.amount : result.amount * result.price;

            if (existingSessions && existingSessions.length > 0) {
              // Merge with existing session
              const existingSession = existingSessions[0];
              const new_total_usdt = existingSession.remaining_usdt + amount_usdt;
              const new_total_invest_idr = existingSession.total_invest_idr + total_idr;
              const new_avg_cost = new_total_invest_idr / new_total_usdt;

              const { data: updatedSession, error: updateError } = await supabase
                .from('sessions')
                .update({
                  total_invest_idr: new_total_invest_idr,
                  total_usdt: existingSession.total_usdt + amount_usdt,
                  avg_cost: new_avg_cost,
                  remaining_usdt: new_total_usdt
                })
                .eq('id', existingSession.id)
                .select()
                .single();

              if (updateError) throw updateError;
              sessionId = existingSession.id;
            } else {
              // Create new session
              const session = {
                created_at: tx_time,
                user_id: webUserId,
                price_idr: result.price,
                total_invest_idr: total_idr,
                total_usdt: amount_usdt,
                avg_cost: result.price,
                remaining_usdt: amount_usdt,
                realized_profit_idr: 0,
                status: 'active'
              };

              const { data: sessionData, error: sessionError } = await supabase
                .from('sessions')
                .insert([session])
                .select()
                .single();

              if (sessionError) throw sessionError;
              sessionId = sessionData.id;
            }

            // Insert transaction
            const txDataToInsert = {
              user_id: webUserId,
              tx_time,
              type: 'BUY',
              price_idr: result.price,
              amount_usdt,
              total_idr,
              fee_idr: 0,
              session_id: sessionId,
              label: result.exchange
            };
            
            console.log('[Telegram] Inserting BUY transaction:', txDataToInsert);
            
            const { data: txData, error: txError } = await supabase
              .from('transactions')
              .insert([txDataToInsert])
              .select()
              .single();

            if (txError) {
              console.error('[Telegram] Error inserting BUY transaction:', txError);
              throw txError;
            }
            
            console.log('[Telegram] BUY transaction saved successfully:', txData);

            const amountLabel = result.currency === 'IDR' 
              ? `Rp${result.amount.toLocaleString('id-ID')}` 
              : `$${result.amount}`;
            const priceLabel = `Rp${result.price.toLocaleString('id-ID')}`;
            const message = `🟢 BUY Transaction Saved\n💰 ${amountLabel}\n📊 Harga: ${priceLabel}\n🏢 ${result.exchange}\n💵 USDT: ${amount_usdt.toFixed(4)}`;
            await sendTelegramMessage(chatId, message);

          } else if (result.type === 'SELL') {
            // Calculate sold_usdt
            let sold_usdt: number;
            if (result.currency === 'IDR') {
              sold_usdt = result.amount / result.price;
            } else {
              sold_usdt = result.amount;
            }

            // Get active sessions for this user
            const { data: sessions, error: sessionsError } = await supabase
              .from('sessions')
              .select('*')
              .eq('user_id', webUserId)
              .gt('remaining_usdt', 0)
              .order('created_at', { ascending: true });

            if (sessionsError) throw sessionsError;

            if (!sessions || sessions.length === 0) {
              await sendTelegramMessage(chatId, '❌ Tidak ada session aktif untuk dijual.');
              return NextResponse.json({ ok: true });
            }

            // Process FIFO sell
            const result_fifo = processSmartFIFOSell(
              sessions as Session[],
              sold_usdt,
              result.price,
              tx_time,
              0 // fee_idr = 0 for Telegram
            );

            // Create SELL transaction
            const total_proceeds = sold_usdt * result.price;
            const sellTxData = {
              user_id: webUserId,
              tx_time,
              type: 'SELL',
              price_idr: result.price,
              amount_usdt: sold_usdt,
              total_idr: total_proceeds,
              fee_idr: 0,
              label: result.exchange
            };
            
            console.log('[Telegram] Inserting SELL transaction:', sellTxData);
            
            const { data: txInsert, error: txErr } = await supabase
              .from('transactions')
              .insert([sellTxData])
              .select('id')
              .single();

            if (txErr) {
              console.error('[Telegram] Error inserting SELL transaction:', txErr);
              throw txErr;
            }
            const sell_tx_id = txInsert.id;
            
            console.log('[Telegram] SELL transaction saved successfully:', { id: sell_tx_id });

            // Update all affected sessions
            for (const { session, sale } of result_fifo.affectedSessions) {
              await supabase
                .from('sessions')
                .update({
                  remaining_usdt: session.remaining_usdt,
                  realized_profit_idr: session.realized_profit_idr,
                  status: session.status
                })
                .eq('id', session.id!);

              await supabase
                .from('session_sales')
                .insert({
                  session_id: sale.session_id,
                  tx_id: sell_tx_id,
                  sold_usdt: sale.sold_usdt,
                  proceeds_idr: sale.proceeds_idr,
                  cost_idr: sale.cost_idr,
                  profit_idr: sale.profit_idr
                });
            }

            const amountLabel = result.currency === 'IDR' 
              ? `Rp${result.amount.toLocaleString('id-ID')}` 
              : `${sold_usdt.toFixed(4)} USDT`;
            const priceLabel = `Rp${result.price.toLocaleString('id-ID')}`;
            const profitLabel = result_fifo.totalProfit >= 0 ? `+Rp${result_fifo.totalProfit.toLocaleString('id-ID')}` : `Rp${result_fifo.totalProfit.toLocaleString('id-ID')}`;
            const message = `🔴 SELL Transaction Saved\n💰 ${amountLabel}\n📊 Harga: ${priceLabel}\n🏢 ${result.exchange}\n💵 Proceeds: Rp${result_fifo.totalProceeds.toLocaleString('id-ID')}\n📈 Profit: ${profitLabel}`;
            await sendTelegramMessage(chatId, message);
          }
        } catch (error: any) {
          console.error('Error processing transaction:', error);
          const errorMsg = error.message || 'Gagal menyimpan transaksi';
          await sendTelegramMessage(chatId, `❌ ${errorMsg}`);
        }
        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Telegram Webhook] Error:', error);
    console.error('[Telegram Webhook] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[Telegram Webhook] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({ 
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
