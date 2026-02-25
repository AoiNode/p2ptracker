# Telegram Bot API Reference

Dokumentasi lengkap API endpoints untuk Telegram Bot integration.

## Base URL

```
https://yourdomain.com/api/telegram
```

Ganti `yourdomain.com` dengan domain Vercel Anda.

---

## Endpoints

### 1. GET /setup - Get Webhook Status

Mendapatkan informasi bot dan status webhook.

**Request:**
```bash
curl https://yourdomain.com/api/telegram/setup
```

**Response (Success):**
```json
{
  "bot": {
    "id": 123456789,
    "is_bot": true,
    "first_name": "P2P Tracker Bot",
    "username": "p2p_tracker_bot"
  },
  "webhook": {
    "url": "https://yourdomain.com/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "last_error_date": null,
    "last_error_message": null
  }
}
```

**Response (Error):**
```json
{
  "error": "TELEGRAM_BOT_TOKEN not configured",
  "status": 400
}
```

---

### 2. POST /setup - Setup Webhook

Mengatur webhook untuk menerima pesan dari Telegram.

**Request:**
```bash
curl -X POST https://yourdomain.com/api/telegram/setup \
  -H "Content-Type: application/json" \
  -d '{
    "webhookUrl": "https://yourdomain.com/api/telegram/webhook"
  }'
```

**Request Body:**
```json
{
  "webhookUrl": "https://yourdomain.com/api/telegram/webhook"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Webhook configured successfully",
  "webhookUrl": "https://yourdomain.com/api/telegram/webhook"
}
```

**Response (Error):**
```json
{
  "error": "Invalid webhook URL format",
  "status": 400
}
```

---

### 3. DELETE /setup - Delete Webhook

Menghapus webhook configuration.

**Request:**
```bash
curl -X DELETE https://yourdomain.com/api/telegram/setup
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Webhook removed successfully"
}
```

---

### 4. POST /webhook - Receive Messages (Automatic)

Endpoint ini dipanggil otomatis oleh Telegram ketika user mengirim pesan.

**Automatic Request dari Telegram:**
```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 1,
    "from": {
      "id": 987654321,
      "first_name": "John",
      "username": "johndoe"
    },
    "chat": {
      "id": 987654321,
      "type": "private"
    },
    "text": "buy $50 16750 bybit",
    "date": 1634567890
  }
}
```

**Response (Success):**
```json
{
  "ok": true
}
```

**Bot Response ke User:**
```
✅ BUY Transaction Saved

💰 Amount: $50.00
💵 Total IDR: Rp837,500
📊 Price: Rp16,750
🏢 Exchange: Bybit
```

---

## Command Format

### BUY dengan IDR

```
buy rp205000 16750 bybit
```

**Parsing:**
- Command: `buy`
- Amount: `205000` IDR
- Price: `16750` IDR/USDT
- Exchange: `bybit`

**Calculation:**
- USDT Amount: 205000 / 16750 = 12.24 USDT
- Session: Created or merged with existing session at price 16750

---

### BUY dengan USDT

```
buy $50 16750 binance
```

**Parsing:**
- Command: `buy`
- Amount: `50` USDT
- Price: `16750` IDR/USDT
- Exchange: `binance`

**Calculation:**
- Total IDR: 50 * 16750 = 837,500 IDR
- Session: Created or merged with existing session at price 16750

---

### SELL

```
sell 10 16800 okx
```

**Parsing:**
- Command: `sell`
- Amount: `10` USDT
- Price: `16800` IDR/USDT
- Exchange: `okx`

**Calculation:**
- Total IDR: 10 * 16800 = 168,000 IDR
- FIFO Matching: Automatically matches against sessions in order
- Profit/Loss: Calculated based on average cost

---

## Error Responses

### Format Error

**Command:**
```
buy invalid 16750 bybit
```

**Response:**
```
❌ Format Error

Jumlah tidak valid. Harus angka positif

Contoh:
• buy rp205000 16750 bybit
• buy $20 16750 bybit
• sell 5 16750 bybit
```

---

### Invalid Exchange

**Command:**
```
buy $50 16750 unknown
```

**Response:**
```
❌ Format Error

Exchange tidak valid. Pilih: binance, bybit, okx, bitget, tokocrypto, other

Contoh:
• buy rp205000 16750 bybit
• buy $20 16750 bybit
• sell 5 16750 bybit
```

---

### No Active Sessions (SELL)

**Command:**
```
sell 10 16800 okx
```

**Response (when no active sessions):**
```
❌ Tidak ada session aktif untuk dijual
```

---

## Database Integration

### Transactions Table

Setiap command menyimpan data ke tabel `transactions`:

```sql
INSERT INTO transactions (
  user_id,
  tx_time,
  type,
  price_idr,
  amount_usdt,
  total_idr,
  fee_idr,
  session_id,
  label
) VALUES (...)
```

**Fields:**
- `user_id`: Telegram user ID
- `tx_time`: ISO timestamp saat command diterima
- `type`: 'BUY' atau 'SELL'
- `price_idr`: Harga USDT/IDR
- `amount_usdt`: Jumlah USDT
- `total_idr`: Total IDR
- `fee_idr`: Fee (default 0 dari Telegram)
- `session_id`: Session ID (untuk BUY)
- `label`: Exchange label

### Sessions Table

Untuk BUY transactions, session dibuat atau diupdate:

```sql
INSERT INTO sessions (
  user_id,
  created_at,
  price_idr,
  total_invest_idr,
  total_usdt,
  avg_cost,
  remaining_usdt,
  realized_profit_idr,
  status
) VALUES (...)
```

### Session Sales Table

Untuk SELL transactions, session_sales dibuat untuk setiap session yang di-match:

```sql
INSERT INTO session_sales (
  session_id,
  tx_id,
  sold_usdt,
  proceeds_idr,
  cost_idr,
  profit_idr
) VALUES (...)
```

---

## Authentication

### User Identification

User diidentifikasi berdasarkan Telegram user ID:

```
Telegram User ID → Database user_id
```

Setiap user hanya bisa melihat transaksi mereka sendiri.

### Token Security

- `TELEGRAM_BOT_TOKEN` disimpan di environment variable
- Tidak pernah di-hardcode di source code
- Hanya accessible di server-side

---

## Rate Limiting

Tidak ada rate limiting built-in. Telegram Bot API memiliki rate limiting tersendiri:

- Max 30 messages per second per chat
- Max 100 messages per second total

---

## Testing

### Test dengan cURL

```bash
# Get webhook status
curl https://yourdomain.com/api/telegram/setup

# Setup webhook
curl -X POST https://yourdomain.com/api/telegram/setup \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl": "https://yourdomain.com/api/telegram/webhook"}'

# Delete webhook
curl -X DELETE https://yourdomain.com/api/telegram/setup
```

### Test dengan Telegram Bot

1. Cari bot Anda di Telegram (contoh: `@p2p_tracker_bot`)
2. Klik START
3. Kirim command:
   ```
   buy $50 16750 bybit
   ```
4. Tunggu response dari bot
5. Cek transaksi di website

---

## Troubleshooting

### Webhook tidak aktif

**Check:**
```bash
curl https://yourdomain.com/api/telegram/setup
```

**Expected:**
```json
{
  "webhook": {
    "url": "https://yourdomain.com/api/telegram/webhook"
  }
}
```

**If empty:**
- Setup webhook lagi dengan POST request
- Pastikan domain HTTPS (bukan HTTP)

### Bot tidak merespons

**Check logs:**
1. Buka Vercel Dashboard
2. Pergi ke Settings → Function Logs
3. Lihat error messages

**Common issues:**
- `TELEGRAM_BOT_TOKEN` tidak di-set
- Webhook URL salah
- Database connection error

### Transaksi tidak muncul

**Check:**
1. Refresh halaman transaksi
2. Pastikan login dengan akun yang benar
3. Lihat logs di Vercel untuk error details

---

## Examples

### Example 1: Buy USDT

```
User: buy $100 16750 binance
Bot:  ✅ BUY Transaction Saved
      💰 Amount: $100.00
      💵 Total IDR: Rp1,675,000
      📊 Price: Rp16,750
      🏢 Exchange: Binance

Database:
- Transaction created: BUY, $100, Rp1,675,000
- Session created: 100 USDT at Rp16,750
```

### Example 2: Buy IDR

```
User: buy rp500000 16750 bybit
Bot:  ✅ BUY Transaction Saved
      💰 Amount: Rp500,000
      💵 Total IDR: Rp500,000
      📊 Price: Rp16,750
      🏢 Exchange: Bybit

Database:
- Transaction created: BUY, 29.85 USDT, Rp500,000
- Session updated: +29.85 USDT (merged with existing)
```

### Example 3: Sell

```
User: sell 50 16800 okx
Bot:  ✅ SELL Transaction Saved
      💰 Amount: $50.00
      💵 Total IDR: Rp840,000
      📊 Price: Rp16,800
      🏢 Exchange: OKX

Database:
- Transaction created: SELL, 50 USDT, Rp840,000
- Sessions updated: FIFO matched against sessions
- Session sales created: Profit/loss calculated
```

---

## Support

Untuk bantuan lebih lanjut:
1. Baca `TELEGRAM_BOT_SETUP.md` untuk setup guide
2. Baca `TELEGRAM_QUICK_START.md` untuk quick start
3. Lihat logs di Vercel untuk error details
