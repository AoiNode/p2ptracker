/**
 * Telegram Command Parser
 * Parses commands from Telegram messages
 */

export type TransactionType = 'BUY' | 'SELL';
export type CurrencyType = 'IDR' | 'USDT';
export type CommandType = 'BUY' | 'SELL' | 'HISTORY_BUY' | 'HISTORY_SELL' | 'HISTORY_NEW' | 'HELP' | 'BATCH';

export interface ParsedCommand {
  type: TransactionType;
  amount: number;
  currency: CurrencyType;
  price: number;
  exchange: string;
  timestamp?: Date;
  success?: true;
}

export interface BatchCommand {
  type: 'BATCH';
  commands: ParseResult[];
  timestamp?: Date;
  success?: true;
}

export interface HistoryCommand {
  type: 'HISTORY_BUY' | 'HISTORY_SELL' | 'HISTORY_NEW';
  limit: number;
  exchange?: string;
  timestamp?: Date;
  success?: true;
}

export interface HelpCommand {
  type: 'HELP';
  timestamp?: Date;
  success?: true;
}

export interface ParseError {
  success: false;
  error: string;
}

export type ParseResult = ParsedCommand | HistoryCommand | HelpCommand | BatchCommand | ParseError;

/**
 * Parse amount string and return amount and currency
 * Examples: "rp205000", "$50", "50$", "rp200000"
 */
function parseAmount(amountStr: string): { amount: number; currency: CurrencyType; error?: string } {
  const trimmed = amountStr.toLowerCase().trim();

  // Check for IDR (rp prefix)
  if (trimmed.startsWith('rp')) {
    const numStr = trimmed.substring(2);
    const amount = parseInt(numStr.replace(/\D/g, ''));
    if (isNaN(amount) || amount <= 0) {
      return { amount: 0, currency: 'IDR', error: 'Amount harus angka positif' };
    }
    return { amount, currency: 'IDR' };
  }

  // Check for USDT ($ prefix or suffix)
  if (trimmed.startsWith('$') || trimmed.endsWith('$')) {
    const numStr = trimmed.replace(/\$/g, '');
    const amount = parseFloat(numStr);
    if (isNaN(amount) || amount <= 0) {
      return { amount: 0, currency: 'USDT', error: 'Amount harus angka positif' };
    }
    return { amount, currency: 'USDT' };
  }

  return { amount: 0, currency: 'IDR', error: 'Format amount tidak valid. Gunakan: rp200000 atau $50' };
}

/**
 * Parse price and support shorthand
 * Examples: "16750", "750" (becomes 16750), "16500"
 */
function parsePrice(priceStr: string): { price: number; error?: string } {
  const price = parseInt(priceStr.replace(/\D/g, ''));

  if (isNaN(price) || price <= 0) {
    return { price: 0, error: 'Harga harus angka positif' };
  }

  // Support shorthand: if price < 10000, multiply by 1000 and add 16000
  // Examples: 750 -> 16750, 500 -> 16500, 16750 -> 16750
  if (price < 10000) {
    return { price: 16000 + price };
  }

  return { price };
}

/**
 * Capitalize exchange name
 */
function capitalizeExchange(exchange: string): string {
  const capitalMap: { [key: string]: string } = {
    binance: 'Binance',
    bybit: 'Bybit',
    okx: 'OKX',
    bitget: 'Bitget',
    tokocrypto: 'Tokocrypto',
    other: 'Other',
  };
  return capitalMap[exchange.toLowerCase()] || exchange;
}

/**
 * Parse transaction command (BUY/SELL)
 */
function parseTransactionCommand(parts: string[]): ParseResult {
  if (parts.length < 4) {
    return {
      success: false,
      error: 'Format tidak valid. Gunakan: buy/sell [amount] [price] [exchange]',
    };
  }

  const [command, amountStr, priceStr, exchange] = parts;

  // Validate and normalize command (support 'b' for buy, 's' for sell)
  let normalizedCommand: string;
  if (command === 'buy' || command === 'b') {
    normalizedCommand = 'BUY';
  } else if (command === 'sell' || command === 's') {
    normalizedCommand = 'SELL';
  } else {
    return {
      success: false,
      error: 'Command harus "buy"/"b" atau "sell"/"s"',
    };
  }

  // Parse amount and currency
  const { amount, currency, error: amountError } = parseAmount(amountStr);
  if (amountError) {
    return {
      success: false,
      error: amountError,
    };
  }

  // Parse price - support shorthand (e.g., "750" = "16750")
  const { price, error: priceError } = parsePrice(priceStr);
  if (priceError) {
    return {
      success: false,
      error: priceError,
    };
  }

  // Validate exchange
  const validExchanges = ['binance', 'bybit', 'okx', 'bitget', 'tokocrypto', 'other'];
  const normalizedExchange = exchange.toLowerCase();
  if (!validExchanges.includes(normalizedExchange)) {
    return {
      success: false,
      error: `Exchange tidak valid. Pilih: ${validExchanges.join(', ')}`,
    };
  }

  return {
    type: normalizedCommand as TransactionType,
    amount,
    currency,
    price,
    exchange: capitalizeExchange(normalizedExchange),
    timestamp: new Date(),
    success: true,
  };
}

/**
 * Parse history command
 */
function parseHistoryCommand(parts: string[]): ParseResult {
  if (parts.length < 2) {
    return {
      success: false,
      error: 'Format history tidak valid. Gunakan: history buy/sell/new [limit] [exchange]',
    };
  }

  const [, historyType, ...rest] = parts;

  // Validate history type
  if (!['buy', 'b', 'sell', 's', 'new', 'n'].includes(historyType)) {
    return {
      success: false,
      error: 'History type harus "buy"/"b", "sell"/"s", atau "new"/"n"',
    };
  }

  // Normalize history type
  let normalizedType: 'HISTORY_BUY' | 'HISTORY_SELL' | 'HISTORY_NEW';
  if (historyType === 'buy' || historyType === 'b') {
    normalizedType = 'HISTORY_BUY';
  } else if (historyType === 'sell' || historyType === 's') {
    normalizedType = 'HISTORY_SELL';
  } else {
    normalizedType = 'HISTORY_NEW';
  }

  // Parse limit and exchange
  let limit = 10; // default
  let exchange: string | undefined;

  if (rest.length === 0) {
    // No limit or exchange specified - use defaults
    // For HISTORY_NEW, limit is required but we'll use default
  } else if (rest.length === 1) {
    // Either limit or exchange
    const arg = rest[0];
    const argNum = parseInt(arg);

    if (!isNaN(argNum) && argNum > 0) {
      // It's a limit
      limit = argNum;
    } else {
      // It's an exchange
      const validExchanges = ['binance', 'bybit', 'okx', 'bitget', 'tokocrypto', 'other'];
      if (!validExchanges.includes(arg.toLowerCase())) {
        return {
          success: false,
          error: `Exchange tidak valid. Pilih: ${validExchanges.join(', ')}`,
        };
      }
      exchange = capitalizeExchange(arg.toLowerCase());
    }
  } else if (rest.length === 2) {
    // Both limit and exchange
    const limitArg = rest[0];
    const exchangeArg = rest[1];

    const limitNum = parseInt(limitArg);
    if (isNaN(limitNum) || limitNum <= 0) {
      return {
        success: false,
        error: 'Limit harus angka positif',
      };
    }
    limit = limitNum;

    const validExchanges = ['binance', 'bybit', 'okx', 'bitget', 'tokocrypto', 'other'];
    if (!validExchanges.includes(exchangeArg.toLowerCase())) {
      return {
        success: false,
        error: `Exchange tidak valid. Pilih: ${validExchanges.join(', ')}`,
      };
    }
    exchange = capitalizeExchange(exchangeArg.toLowerCase());
  } else {
    return {
      success: false,
      error: 'Terlalu banyak parameter',
    };
  }

  return {
    type: normalizedType,
    limit,
    exchange,
    timestamp: new Date(),
    success: true,
  };
}

/**
 * Check if message contains multiple lines (batch command)
 */
function isBatchCommand(message: string): boolean {
  const lines = message.trim().split('\n');
  return lines.length > 1;
}

/**
 * Check if message is TX batch command (starts with "TX [exchange]")
 */
function isTxBatchCommand(message: string): boolean {
  const trimmed = message.trim();
  const firstLine = trimmed.split('\n')[0].toLowerCase();
  return firstLine.startsWith('tx ');
}

/**
 * Parse TX batch command - commands with exchange prefix
 * Format: TX [exchange]\n[commands without exchange]
 */
function parseTxBatchCommand(message: string): ParseResult {
  const lines = message.trim().split('\n');
  
  if (lines.length < 2) {
    return {
      success: false,
      error: 'Format TX batch tidak valid. Gunakan: TX [exchange] diikuti commands',
    };
  }
  
  // Parse first line to get exchange
  const firstLineParts = lines[0].trim().split(/\s+/);
  if (firstLineParts.length !== 2 || firstLineParts[0].toLowerCase() !== 'tx') {
    return {
      success: false,
      error: 'Format TX batch tidak valid. Baris pertama harus: TX [exchange]',
    };
  }
  
  const exchange = firstLineParts[1].toLowerCase();
  const validExchanges = ['binance', 'bybit', 'okx', 'bitget', 'tokocrypto', 'other'];
  
  if (!validExchanges.includes(exchange)) {
    return {
      success: false,
      error: `Exchange tidak valid. Pilih: ${validExchanges.join(', ')}`,
    };
  }
  
  // Parse remaining lines as commands
  const commands: ParseResult[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines
    
    const parts = line.split(/\s+/);
    if (parts.length < 1) continue;
    
    const command = parts[0].toLowerCase();
    
    // Add exchange to the command parts
    const partsWithExchange = [...parts, exchange];
    
    // Process each line as individual command with auto-added exchange
    if (command === 'buy' || command === 'b' || command === 'sell' || command === 's') {
      const result = parseTransactionCommand(partsWithExchange);
      commands.push(result);
    } else if (command === 'help' || (command === 'h' && parts.length === 1)) {
      commands.push({
        success: false,
        error: `Baris ${i + 1}: Help command tidak support di TX batch`,
      });
    } else if (command === 'history' || command === 'h') {
      commands.push({
        success: false,
        error: `Baris ${i + 1}: History command tidak support di TX batch`,
      });
    } else {
      commands.push({
        success: false,
        error: `Baris ${i + 1}: Command tidak dikenal - "${line}"`,
      });
    }
  }
  
  return {
    type: 'BATCH',
    commands,
    timestamp: new Date(),
    success: true,
  };
}

/**
 * Parse batch command - multiple commands in one message
 */
function parseBatchCommand(message: string): ParseResult {
  const lines = message.trim().split('\n');
  const commands: ParseResult[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines
    
    const parts = line.split(/\s+/);
    if (parts.length < 1) continue;
    
    const command = parts[0].toLowerCase();
    
    // Process each line as individual command
    if (command === 'buy' || command === 'b' || command === 'sell' || command === 's') {
      const result = parseTransactionCommand(parts);
      commands.push(result);
    } else if (command === 'help' || (command === 'h' && parts.length === 1)) {
      const result = {
        type: 'HELP' as const,
        timestamp: new Date(),
        success: true as const,
      };
      commands.push(result);
    } else if (command === 'history' || command === 'h') {
      const result = parseHistoryCommand(parts);
      commands.push(result);
    } else {
      commands.push({
        success: false,
        error: `Baris ${i + 1}: Command tidak dikenal - "${line}"`,
      });
    }
  }
  
  return {
    type: 'BATCH',
    commands,
    timestamp: new Date(),
    success: true,
  };
}

/**
 * Main parser function
 */
export function parseTelegramCommand(message: string): ParseResult {
  const trimmed = message.trim();
  
  if (!trimmed) {
    return {
      success: false,
      error: 'Pesan kosong',
    };
  }

  // Check for TX batch command first (TX [exchange] format)
  if (isTxBatchCommand(message)) {
    return parseTxBatchCommand(message);
  }

  // Check for regular batch command (multiple lines)
  if (isBatchCommand(message)) {
    return parseBatchCommand(message);
  }

  // Single line command processing
  const parts = trimmed.split(/\s+/);
  const command = parts[0];

  // Check for HELP command
  if (command === 'help' || (command === 'h' && parts.length === 1)) {
    return {
      type: 'HELP',
      timestamp: new Date(),
      success: true,
    };
  }

  // Check for HISTORY commands
  if (command === 'history' || command === 'h') {
    return parseHistoryCommand(parts);
  }

  // Check for BUY/SELL commands
  if (command === 'buy' || command === 'b' || command === 'sell' || command === 's') {
    return parseTransactionCommand(parts);
  }

  return {
    success: false,
    error: 'Command tidak dikenal. Ketik "help" untuk melihat daftar command',
  };
}

/**
 * Format help message
 */
export function formatHelpMessage(): string {
  return `📖 *P2P TRACKER BOT*

🟢 *BUY* - Record pembelian USDT
\`buy rp200000 16750 bybit\`
\`b $50 750 binance\` (shorthand)

🔴 *SELL* - Record penjualan (FIFO)
\`sell rp200000 16750 bybit\`
\`s $50 750 okx\` (shorthand)

📊 *HISTORY* - Lihat riwayat
\`h b 15 bybit\` - 15 buy terakhir
\`h s 10\` - 10 sell terakhir
\`h n 5 bybit\` - 5 transaksi terbaru

━━━━━━━━━━━━━━━━━━━━━━

🔄 *BATCH* - Multiple commands
\`buy rp200000 16750 bybit\`
\`sell rp150000 16800 bybit\`
\`b $50 750 binance\`
\`s $25 800 okx\`

🎯 *TX BATCH* - Exchange prefix
\`TX bybit\`
\`buy rp200000 16750\`
\`b $50 750\`
\`sell rp150000 16800\`
\`s $25 800\`

━━━━━━━━━━━━━━━━━━━━━━

💱 *EXCHANGES*
binance, bybit, okx, bitget, tokocrypto, other

💰 *AMOUNT*
IDR: \`rp200000\`
USDT: \`$50\` atau \`50$\`

📊 *PRICE*
Full: \`16750\`
Short: \`750\` → \`16750\`

━━━━━━━━━━━━━━━━━━━━━━

💡 *TIPS*
• \`b\` = buy, \`s\` = sell, \`h\` = history
• Price < 10000 auto +16000
• TX batch: tulis exchange sekali
• Regular batch: tulis exchange per line

📈 *FEATURES*
✅ Auto session management
✅ FIFO profit calculation
✅ Batch processing
✅ Error handling
✅ Real-time tracking

🌐 *WEB DASHBOARD*
Akses web untuk statistik lengkap, chart, export CSV, dan manage sessions

_Track smarter, trade better_ 🚀`;
}
