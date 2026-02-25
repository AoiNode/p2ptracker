# 🤖 Telegram Bot Integration

Sistem lengkap untuk input transaksi BUY/SELL melalui Telegram Bot.

## 📋 Daftar Isi

1. [Fitur Utama](#fitur-utama)
2. [Quick Start](#quick-start)
3. [Command Format](#command-format)
4. [Dokumentasi Lengkap](#dokumentasi-lengkap)
5. [Troubleshooting](#troubleshooting)

---

## ✨ Fitur Utama

### 🎯 Transaksi via Telegram

- ✅ Input BUY dengan IDR: `buy rp205000 16750 bybit`
- ✅ Input BUY dengan USDT: `buy $50 16750 binance`
- ✅ Input SELL: `sell 10 16800 okx`
- ✅ Support 6 exchange: Binance, Bybit, OKX, Bitget, Tokocrypto, Other

### 🔄 Otomasi Penuh

- ✅ Auto-create session untuk BUY
- ✅ Auto-merge dengan session existing (same price)
- ✅ FIFO matching untuk SELL
- ✅ Auto-calculate profit/loss
- ✅ Exchange label tracking

### 🛡️ Keamanan

- ✅ Token di environment variable (tidak hardcoded)
- ✅ User isolation (setiap user hanya lihat transaksi mereka)
- ✅ Webhook validation dari Telegram
- ✅ Database encryption

### 📊 Integrasi Sempurna

- ✅ Data tersimpan di database yang sama
- ✅ Muncul di website secara real-time
- ✅ Bisa diedit di website
- ✅ Included dalam statistik dan laporan

### 🎨 UI Management

- ✅ Settings page untuk manage bot
- ✅ Lihat status webhook
- ✅ Lihat bot info
- ✅ Copy command format

---

## 🚀 Quick Start

### 1. Setup Bot (5 menit)

```bash
# Step 1: Chat dengan @BotFather di Telegram
# - Ketik /newbot
# - Isi nama dan username
# - Simpan token

# Step 2: Add token ke Vercel
# Settings → Environment Variables
# Name: TELEGRAM_BOT_TOKEN
# Value: Token dari BotFather

# Step 3: Redeploy aplikasi
# Tunggu deploy selesai

# Step 4: Setup webhook
curl -X POST https://yourdomain.com/api/telegram/setup \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl": "https://yourdomain.com/api/telegram/webhook"}'
```

### 2. Test Bot (2 menit)

```
1. Cari bot Anda di Telegram (contoh: @p2p_tracker_bot)
2. Klik START
3. Kirim: buy $50 16750 binance
4. Tunggu response
5. Cek transaksi di website
```

---

## 📱 Command Format

### BUY dengan IDR

```
buy rp205000 16750 bybit
```

**Breakdown:**
- `buy` = tipe transaksi
- `rp205000` = jumlah IDR (prefix "rp")
- `16750` = harga USDT/IDR
- `bybit` = exchange

**Result:**
- USDT Amount: 205000 / 16750 = 12.24 USDT
- Session: Created atau merged

### BUY dengan USDT

```
buy $50 16750 binance
```

**Breakdown:**
- `buy` = tipe transaksi
- `$50` = jumlah USDT (prefix "$")
- `16750` = harga USDT/IDR
- `binance` = exchange

**Result:**
- Total IDR: 50 * 16750 = 837,500 IDR
- Session: Created atau merged

### SELL

```
sell 10 16800 okx
```

**Breakdown:**
- `sell` = tipe transaksi
- `10` = jumlah USDT
- `16800` = harga USDT/IDR
- `okx` = exchange

**Result:**
- Total IDR: 10 * 16800 = 168,000 IDR
- FIFO: Auto-matched dengan sessions
- Profit/Loss: Auto-calculated

### Exchange Options

- `binance` (default)
- `bybit`
- `okx`
- `bitget`
- `tokocrypto`
- `other`

---

## 📚 Dokumentasi Lengkap

### Setup & Installation

- **[TELEGRAM_QUICK_START.md](./TELEGRAM_QUICK_START.md)** - Setup dalam 5 menit
- **[TELEGRAM_BOT_SETUP.md](./TELEGRAM_BOT_SETUP.md)** - Setup guide lengkap
- **[TELEGRAM_IMPLEMENTATION_CHECKLIST.md](./TELEGRAM_IMPLEMENTATION_CHECKLIST.md)** - Checklist lengkap

### API & Development

- **[TELEGRAM_API_REFERENCE.md](./TELEGRAM_API_REFERENCE.md)** - API endpoints reference
- **[scripts/test-telegram.js](./scripts/test-telegram.js)** - Testing script

### Source Code

```
src/
├── lib/
│   ├── telegramParser.ts       # Command parser
│   └── telegramSetup.ts        # Setup utilities
├── app/
│   ├── api/telegram/
│   │   ├── webhook/route.ts    # Webhook endpoint
│   │   └── setup/route.ts      # Setup endpoint
│   └── settings/
│       └── telegram/page.tsx   # Settings UI
```

---

## 🔧 API Endpoints

### GET /api/telegram/setup
Mendapatkan status bot dan webhook.

```bash
curl https://yourdomain.com/api/telegram/setup
```

### POST /api/telegram/setup
Setup webhook untuk menerima pesan.

```bash
curl -X POST https://yourdomain.com/api/telegram/setup \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl": "https://yourdomain.com/api/telegram/webhook"}'
```

### DELETE /api/telegram/setup
Menghapus webhook.

```bash
curl -X DELETE https://yourdomain.com/api/telegram/setup
```

### POST /api/telegram/webhook
Webhook endpoint (dipanggil otomatis oleh Telegram).

---

## 🧪 Testing

### Test dengan Script

```bash
# Get status
node scripts/test-telegram.js status

# Setup webhook
node scripts/test-telegram.js setup yourdomain.com

# Test commands
node scripts/test-telegram.js test-buy-idr
node scripts/test-telegram.js test-buy-usdt
node scripts/test-telegram.js test-sell
node scripts/test-telegram.js test-invalid
```

### Test dengan Telegram

1. Cari bot Anda di Telegram
2. Klik START
3. Kirim command:
   ```
   buy $50 16750 binance
   ```
4. Tunggu response
5. Cek di website

---

## 📊 Database Integration

### Tables yang Digunakan

1. **transactions** - Menyimpan BUY/SELL transactions
2. **sessions** - Menyimpan BUY sessions
3. **session_sales** - Menyimpan SELL details

### Fields yang Disimpan

```sql
-- transactions
user_id          # Telegram user ID
tx_time          # Transaction timestamp
type             # 'BUY' atau 'SELL'
price_idr        # Harga USDT/IDR
amount_usdt      # Jumlah USDT
total_idr        # Total IDR
fee_idr          # Fee (default 0)
session_id       # Session ID (untuk BUY)
label            # Exchange label

-- sessions
user_id          # Telegram user ID
price_idr        # Harga session
total_invest_idr # Total investasi
total_usdt       # Total USDT
avg_cost         # Average cost
remaining_usdt   # Sisa USDT
realized_profit  # Profit/loss
status           # 'active' atau 'closed'

-- session_sales
session_id       # Session yang dijual
tx_id            # Transaction ID
sold_usdt        # USDT yang dijual
proceeds_idr     # IDR yang diterima
cost_idr         # Cost basis
profit_idr       # Profit/loss
```

---

## 🔐 Security

### Token Management

- ✅ Token disimpan di environment variable
- ✅ Tidak pernah di-hardcode
- ✅ Hanya accessible di server-side
- ✅ Tidak terlihat di client-side

### User Isolation

- ✅ Setiap user diidentifikasi by Telegram user ID
- ✅ User hanya bisa akses transaksi mereka sendiri
- ✅ Database query filtered by user_id

### Webhook Security

- ✅ Hanya menerima POST requests
- ✅ Validate dari Telegram API
- ✅ HTTPS only (tidak HTTP)

---

## 🚨 Troubleshooting

### Bot tidak merespons

**Check:**
```bash
curl https://yourdomain.com/api/telegram/setup
```

**Solusi:**
1. Pastikan `TELEGRAM_BOT_TOKEN` di-set di Vercel
2. Redeploy aplikasi
3. Setup webhook lagi
4. Cek logs di Vercel

### Webhook error

**Check logs:**
- Vercel Dashboard → Settings → Function Logs
- Cari error messages

**Common errors:**
- "Webhook URL is not HTTPS" → Pastikan domain HTTPS
- "Connection refused" → Pastikan domain accessible
- "Unauthorized" → Pastikan token benar

### Transaksi tidak muncul

**Check:**
1. Refresh halaman transaksi
2. Login dengan akun yang benar
3. Cek database di Supabase
4. Lihat logs di Vercel

### Format error

**Pastikan:**
- Format: `buy/sell [amount] [price] [exchange]`
- Untuk IDR: prefix "rp" (contoh: `rp205000`)
- Untuk USDT: prefix "$" (contoh: `$50`)
- Exchange valid: binance, bybit, okx, bitget, tokocrypto, other

---

## 📈 Usage Examples

### Example 1: Daily Trading

```
Morning:
buy $100 16750 binance
→ ✅ Transaksi tersimpan

Afternoon:
buy $50 16750 binance
→ ✅ Merge dengan session existing

Evening:
sell 75 16800 binance
→ ✅ FIFO matched, profit calculated
```

### Example 2: Multi-Exchange

```
Binance:
buy $100 16750 binance

Bybit:
buy $50 16700 bybit

OKX:
sell 50 16800 okx
→ ✅ FIFO matched dari Binance session
```

### Example 3: Monitoring

```
Check status:
https://yourdomain.com/api/telegram/setup

View transactions:
Settings → Telegram Bot → See command format

Check profit:
Statistik page → See all transactions
```

---

## 🎯 Next Steps

1. **Setup Bot** - Ikuti [TELEGRAM_QUICK_START.md](./TELEGRAM_QUICK_START.md)
2. **Test Commands** - Kirim test command ke bot
3. **Verify Data** - Cek transaksi di website
4. **Monitor** - Lihat logs dan status webhook
5. **Go Live** - Mulai gunakan untuk trading

---

## 📞 Support

### Documentation

- [TELEGRAM_QUICK_START.md](./TELEGRAM_QUICK_START.md) - Quick start
- [TELEGRAM_BOT_SETUP.md](./TELEGRAM_BOT_SETUP.md) - Setup guide
- [TELEGRAM_API_REFERENCE.md](./TELEGRAM_API_REFERENCE.md) - API reference
- [TELEGRAM_IMPLEMENTATION_CHECKLIST.md](./TELEGRAM_IMPLEMENTATION_CHECKLIST.md) - Checklist

### Debugging

- Check logs: Vercel Dashboard → Settings → Function Logs
- Check status: `https://yourdomain.com/api/telegram/setup`
- Check database: Supabase Dashboard → SQL Editor

---

## 📝 Version Info

- **Version**: 1.0.0
- **Release Date**: 2025-11-17
- **Status**: Production Ready ✅

---

**Enjoy your Telegram Bot! 🚀**
