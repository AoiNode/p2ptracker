import { NextRequest, NextResponse } from 'next/server';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

interface TelegramBotInfo {
  ok: boolean;
  result?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
  };
  error_code?: number;
  description?: string;
}

interface TelegramWebhookInfo {
  ok: boolean;
  result?: {
    url?: string;
    has_custom_certificate?: boolean;
    pending_update_count?: number;
    last_error_date?: number;
    last_error_message?: string;
    last_synchronization_error_date?: number;
  };
  error_code?: number;
  description?: string;
}

/**
 * GET /api/telegram/setup
 * Get bot info and webhook status
 */
export async function GET() {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN not configured' },
        { status: 500 }
      );
    }

    // Get bot info
    const botResponse = await fetch(
      `${TELEGRAM_API_URL}${TELEGRAM_BOT_TOKEN}/getMe`
    );
    const botData: TelegramBotInfo = await botResponse.json();

    // Get webhook info
    const webhookResponse = await fetch(
      `${TELEGRAM_API_URL}${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
    );
    const webhookData: TelegramWebhookInfo = await webhookResponse.json();

    if (!botData.ok) {
      return NextResponse.json(
        { error: botData.description || 'Failed to get bot info' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      bot: botData.result,
      webhook: webhookData.result,
    });
  } catch (error) {
    console.error('Error fetching telegram setup:', error);
    return NextResponse.json(
      { error: 'Failed to fetch telegram setup' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/telegram/setup
 * Setup webhook
 */
export async function POST(request: NextRequest) {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN not configured' },
        { status: 500 }
      );
    }

    const { webhookUrl } = await request.json();

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'webhookUrl is required' },
        { status: 400 }
      );
    }

    // Validate webhook URL is HTTPS
    if (!webhookUrl.startsWith('https://')) {
      return NextResponse.json(
        { error: 'Webhook URL must be HTTPS' },
        { status: 400 }
      );
    }

    // Set webhook
    const response = await fetch(
      `${TELEGRAM_API_URL}${TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
      }
    );

    const data = await response.json();

    if (!data.ok) {
      return NextResponse.json(
        { error: data.description || 'Failed to setup webhook' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: 'Webhook setup successfully' });
  } catch (error) {
    console.error('Error setting up webhook:', error);
    return NextResponse.json(
      { error: 'Failed to setup webhook' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/telegram/setup
 * Delete webhook
 */
export async function DELETE() {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN not configured' },
        { status: 500 }
      );
    }

    // Delete webhook
    const response = await fetch(
      `${TELEGRAM_API_URL}${TELEGRAM_BOT_TOKEN}/deleteWebhook`,
      { method: 'POST' }
    );

    const data = await response.json();

    if (!data.ok) {
      return NextResponse.json(
        { error: data.description || 'Failed to delete webhook' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: 'Webhook deleted successfully' });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhook' },
      { status: 500 }
    );
  }
}
