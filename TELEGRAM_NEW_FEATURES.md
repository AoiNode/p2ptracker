# ✨ New Features - History & Help Commands

Dokumentasi fitur baru yang ditambahkan ke Telegram Bot.

---

## 🆕 Fitur Baru

### 1. HISTORY Command
Menampilkan history transaksi BUY/SELL dengan filter dan limit yang customizable.

### 2. HELP Command
Menampilkan informasi detail tentang semua command yang tersedia.

---

## 📊 HISTORY Command

### Apa itu?
Command untuk melihat history transaksi dengan berbagai filter:
- Filter by type (BUY, SELL, atau NEW)
- Filter by exchange (Binance, Bybit, OKX, dll)
- Custom limit (berapa banyak yang ditampilkan)

### Format

```
history [type] [limit] [exchange]
h [type] [limit] [exchange]
```

### Tipe History

#### 1. HISTORY BUY
Menampilkan history BUY transactions.

**Format:**
```
history buy [limit] [exchange]
h b [limit] [exchange]
```

**Contoh:**
```
history buy bybit          → 10 BUY terakhir di Bybit
h b bybit                  → Singkat
history buy 15 bybit       → 15 BUY terakhir di Bybit
h b 30 bybit               → 30 BUY terakhir di Bybit
history buy 20             → 20 BUY terakhir (semua exchange)
h b 50                     → 50 BUY terakhir (semua exchange)
```

#### 2. HISTORY SELL
Menampilkan history SELL transactions.

**Format:**
```
history sell [limit] [exchange]
h s [limit] [exchange]
```

**Contoh:**
```
history sell binance       → 10 SELL terakhir di Binance
h s binance                → Singkat
history sell 20 binance    → 20 SELL terakhir di Binance
h s 25 okx                 → 25 SELL terakhir di OKX
history sell 15            → 15 SELL terakhir (semua exchange)
h s 30                     → 30 SELL terakhir (semua exchange)
```

#### 3. HISTORY NEW
Menampilkan transaksi terbaru (BUY + SELL) dengan urutan waktu.

**Format:**
```
history new [limit] [exchange]
h n [limit] [exchange]
```

**Contoh:**
```
history new 5 bybit        → 5 transaksi terbaru di Bybit
h n 5 bybit                → Singkat
history new 10 binance     → 10 transaksi terbaru di Binance
h n 20 okx                 → 20 transaksi terbaru di OKX
history new 1              → 1 transaksi terbaru (semua exchange)
h n 10                     → 10 transaksi terbaru (semua exchange)
history new 50             → 50 transaksi terbaru (semua exchange)
```

### Output Format

```
📊 [TYPE] HISTORY - [EXCHANGE] ([LIMIT] terakhir)

1. 🟢 BUY - $100 @ Rp16,750
   Waktu: 2025-11-17 10:30:00

2. 🟢 BUY - $50 @ Rp16,750
   Waktu: 2025-11-17 09:15:00

... (lebih)
```

### Kegunaan

- ✅ Check recent activity
- ✅ Monitor specific exchange
- ✅ Track transaction history
- ✅ Compare across exchanges
- ✅ Verify transactions

---

## 🆘 HELP Command

### Apa itu?
Command untuk menampilkan informasi detail tentang semua command yang tersedia.

### Format

```
help
h
```

### Apa yang Ditampilkan

```
📖 DAFTAR COMMAND P2P TRACKER

🟢 BUY COMMAND
buy rp200000 16750 bybit - BUY dengan IDR
b rp200000 750 bybit - BUY singkat (750 = 16750)
buy $50 16750 binance - BUY dengan USDT
b $50 750 binance - BUY USDT singkat
buy 50$ 16750 binance - BUY USDT (suffix $)
b 50$ 750 binance - BUY USDT singkat (suffix)

🔴 SELL COMMAND
sell rp200000 16750 bybit - SELL dengan IDR
s rp200000 750 bybit - SELL singkat
sell $50 16750 okx - SELL dengan USDT
s $50 750 okx - SELL USDT singkat
sell 50$ 16750 okx - SELL USDT (suffix $)
s 50$ 750 okx - SELL USDT singkat (suffix)

📊 HISTORY COMMAND
history buy bybit - Lihat 10 BUY terakhir di Bybit
h b bybit - Singkat
history buy 15 bybit - Lihat 15 BUY terakhir
h b 30 bybit - Singkat dengan limit 30
history sell bybit - Lihat 10 SELL terakhir
h s 20 bybit - Lihat 20 SELL terakhir
history new 5 bybit - Lihat 5 transaksi terbaru di Bybit
h n 5 bybit - Singkat
history new 10 - Lihat 10 transaksi terbaru (semua exchange)
h n 10 - Singkat

💱 EXCHANGE YANG TERSEDIA
binance, bybit, okx, bitget, tokocrypto, other

💡 TIPS
• Harga singkat: 750 otomatis jadi 16750 (prefix 16)
• USDT bisa prefix atau suffix: $50 atau 50$
• IDR harus prefix: rp200000
• Ketik help atau h untuk melihat pesan ini

Contoh transaksi:
b $100 750 bybit → Buy 100 USDT at 16750 di Bybit
s $50 800 binance → Sell 50 USDT at 16800 di Binance
h b 10 bybit → Lihat 10 BUY terakhir di Bybit
```

### Kegunaan

- ✅ Learn all available commands
- ✅ Get command examples
- ✅ See tips & tricks
- ✅ Quick reference

---

## 📋 Command Summary

### All Commands

| Command | Fungsi | Contoh |
|---------|--------|--------|
| `buy` / `b` | BUY transaction | `b $50 750 bybit` |
| `sell` / `s` | SELL transaction | `s $50 800 binance` |
| `history buy` / `h b` | BUY history | `h b 10 bybit` |
| `history sell` / `h s` | SELL history | `h s 20 binance` |
| `history new` / `h n` | Latest transactions | `h n 5 bybit` |
| `help` / `h` | Show help | `help` |

---

## 🎯 Real-World Scenarios

### Scenario 1: Morning Check

```
User: h n 5
Bot:  📊 LATEST TRANSACTIONS (5 terbaru)
      
      1. 🔴 SELL - $50 @ Rp16,800
         Waktu: 2025-11-17 11:45:00
      
      2. 🟢 BUY - $100 @ Rp16,750
         Waktu: 2025-11-17 11:30:00
      
      ... (3 lebih)
```

### Scenario 2: Check Specific Exchange

```
User: h b 10 bybit
Bot:  📊 BUY HISTORY - BYBIT (10 terakhir)
      
      1. 🟢 BUY - $100 @ Rp16,750
         Waktu: 2025-11-17 10:30:00
      
      2. 🟢 BUY - $50 @ Rp16,750
         Waktu: 2025-11-17 09:15:00
      
      ... (8 lebih)
```

### Scenario 3: Verify Transaction

```
User: h n 1 binance
Bot:  📊 LATEST TRANSACTIONS - BINANCE (1 terbaru)
      
      1. 🟢 BUY - $100 @ Rp16,750
         Waktu: 2025-11-17 10:30:00
```

### Scenario 4: Learn Commands

```
User: help
Bot:  📖 DAFTAR COMMAND P2P TRACKER
      
      (menampilkan semua command dengan contoh)
```

---

## 💡 Usage Tips

### Tip 1: Quick Check
```
h n 1          → Lihat 1 transaksi terbaru
h b 5 bybit    → Lihat 5 BUY terakhir di Bybit
h s 10 binance → Lihat 10 SELL terakhir di Binance
```

### Tip 2: Monitor Exchanges
```
h b 10 bybit
h b 10 binance
h b 10 okx
```

### Tip 3: Detailed Review
```
h b 30 bybit   → Review 30 BUY terakhir
h s 30 bybit   → Review 30 SELL terakhir
h n 50         → Review 50 transaksi terbaru
```

### Tip 4: When Confused
```
help           → Lihat semua command
h              → Singkat
```

---

## 🔧 Implementation Details

### Parser Updates

**File:** `src/lib/telegramParser.ts`

**New Types:**
```typescript
export interface HistoryCommand {
  type: 'HISTORY_BUY' | 'HISTORY_SELL' | 'HISTORY_NEW';
  limit: number;
  exchange?: string;
  timestamp?: Date;
}

export interface HelpCommand {
  type: 'HELP';
  timestamp?: Date;
}
```

**New Functions:**
- `parseHistoryCommand()` - Parse history commands
- `formatHelpMessage()` - Format help message

**Updated Functions:**
- `parseTelegramCommand()` - Now handles history and help

### Webhook Updates

**File:** `src/app/api/telegram/webhook/route.ts`

**New Logic:**
- Handle `HistoryCommand` type
- Query database for transactions
- Filter by type, exchange, limit
- Format and send response
- Handle `HelpCommand` type
- Send formatted help message

---

## 📊 Database Queries

### For HISTORY BUY
```sql
SELECT * FROM transactions
WHERE user_id = ? AND type = 'BUY' AND label = ?
ORDER BY tx_time DESC
LIMIT ?
```

### For HISTORY SELL
```sql
SELECT * FROM transactions
WHERE user_id = ? AND type = 'SELL' AND label = ?
ORDER BY tx_time DESC
LIMIT ?
```

### For HISTORY NEW
```sql
SELECT * FROM transactions
WHERE user_id = ? AND label = ?
ORDER BY tx_time DESC
LIMIT ?
```

---

## ✅ Testing

### Test Cases

```
✅ history buy bybit
✅ h b bybit
✅ history buy 15 bybit
✅ h b 30 bybit
✅ history sell binance
✅ h s 20 binance
✅ history new 5 bybit
✅ h n 5 bybit
✅ history new 10
✅ h n 10
✅ help
✅ h (when alone)
```

### Invalid Cases

```
❌ history buy (missing exchange)
❌ h b (missing exchange)
❌ history new bybit (missing limit)
❌ h n binance (missing limit)
❌ history buy 0 bybit (invalid limit)
❌ h s -5 binance (negative limit)
❌ history buy 10 unknown (invalid exchange)
❌ help extra (extra parameters)
```

---

## 📚 Documentation Files

- **`TELEGRAM_HISTORY_HELP.md`** - Detailed history & help documentation
- **`TELEGRAM_COMMAND_FORMATS.md`** - Updated with history & help
- **`TELEGRAM_NEW_FEATURES.md`** - This file

---

## 🚀 Next Steps

1. **Update Webhook** - Implement history and help handling
2. **Test Commands** - Test all history and help commands
3. **Deploy** - Deploy updated code to production
4. **Monitor** - Monitor usage and performance

---

## 📞 Support

For questions about history and help commands:
1. Read `TELEGRAM_HISTORY_HELP.md`
2. Type `help` in Telegram bot
3. Check examples in this file

---

**Last Updated:** 2025-11-17
**Version:** 1.0.0
**Status:** Ready for Implementation
