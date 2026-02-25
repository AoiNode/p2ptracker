# 📊 History & Help Commands

Dokumentasi lengkap untuk fitur History dan Help di Telegram Bot.

---

## 🆘 HELP Command

Menampilkan informasi detail tentang semua command yang tersedia.

### Format

```
help
h
```

### Contoh

```
User: help
Bot:  📖 DAFTAR COMMAND P2P TRACKER
      
      🟢 BUY COMMAND
      buy rp200000 16750 bybit - BUY dengan IDR
      ...
      
      (menampilkan semua command)
```

### Apa yang Ditampilkan

- ✅ Semua BUY command format
- ✅ Semua SELL command format
- ✅ Semua HISTORY command format
- ✅ Exchange yang tersedia
- ✅ Tips & tricks
- ✅ Contoh penggunaan

---

## 📊 HISTORY Command

Menampilkan history transaksi BUY/SELL dengan berbagai filter.

### Format Umum

```
history [type] [limit] [exchange]
h [type] [limit] [exchange]
```

**Keterangan:**
- `type` = `buy`, `b`, `sell`, `s`, `new`, `n`
- `limit` = Jumlah history yang ditampilkan (optional, default 10)
- `exchange` = Exchange filter (optional untuk `new`)

---

## 🟢 HISTORY BUY

Menampilkan history BUY transactions.

### Format

```
history buy [limit] [exchange]
h b [limit] [exchange]
```

### Contoh

#### 1. Default (10 BUY terakhir di exchange)

```
history buy bybit
h b bybit
```

**Result:**
```
📊 BUY HISTORY - BYBIT (10 terakhir)

1. 🟢 BUY - $100 @ Rp16,750
   Waktu: 2025-11-17 10:30:00
   
2. 🟢 BUY - $50 @ Rp16,750
   Waktu: 2025-11-17 09:15:00
   
... (8 lebih)
```

#### 2. Custom Limit

```
history buy 15 bybit
h b 30 bybit
```

**Penjelasan:**
- `history buy 15 bybit` = Lihat 15 BUY terakhir di Bybit
- `h b 30 bybit` = Lihat 30 BUY terakhir di Bybit

#### 3. Tanpa Exchange (semua exchange)

```
history buy 20
h b 20
```

**Result:** 20 BUY terakhir dari semua exchange

---

## 🔴 HISTORY SELL

Menampilkan history SELL transactions.

### Format

```
history sell [limit] [exchange]
h s [limit] [exchange]
```

### Contoh

#### 1. Default (10 SELL terakhir)

```
history sell binance
h s binance
```

#### 2. Custom Limit

```
history sell 20 binance
h s 25 okx
```

#### 3. Tanpa Exchange

```
history sell 15
h s 15
```

---

## ⭐ HISTORY NEW

Menampilkan transaksi terbaru (BUY + SELL) dengan urutan waktu.

### Format

```
history new [limit] [exchange]
h n [limit] [exchange]
```

**Keterangan:**
- `limit` = Jumlah transaksi terbaru (required)
- `exchange` = Exchange filter (optional)

### Contoh

#### 1. Dengan Exchange

```
history new 5 bybit
h n 5 bybit
```

**Result:**
```
📊 LATEST TRANSACTIONS - BYBIT (5 terbaru)

1. 🔴 SELL - $50 @ Rp16,800
   Waktu: 2025-11-17 11:45:00
   
2. 🟢 BUY - $100 @ Rp16,750
   Waktu: 2025-11-17 11:30:00
   
3. 🔴 SELL - $25 @ Rp16,800
   Waktu: 2025-11-17 11:00:00
   
... (2 lebih)
```

#### 2. Tanpa Exchange (semua exchange)

```
history new 10
h n 10
```

**Result:** 10 transaksi terbaru dari semua exchange

#### 3. Berbagai Limit

```
history new 1 bybit      → 1 transaksi terbaru di Bybit
h n 5 binance            → 5 transaksi terbaru di Binance
history new 20           → 20 transaksi terbaru (semua exchange)
h n 50                   → 50 transaksi terbaru (semua exchange)
```

---

## 📋 Command Reference Table

### HISTORY BUY

| Command | Penjelasan |
|---------|-----------|
| `history buy bybit` | 10 BUY terakhir di Bybit |
| `h b bybit` | Singkat |
| `history buy 15 bybit` | 15 BUY terakhir di Bybit |
| `h b 30 bybit` | 30 BUY terakhir di Bybit |
| `history buy 20` | 20 BUY terakhir (semua exchange) |
| `h b 50` | 50 BUY terakhir (semua exchange) |

### HISTORY SELL

| Command | Penjelasan |
|---------|-----------|
| `history sell binance` | 10 SELL terakhir di Binance |
| `h s binance` | Singkat |
| `history sell 20 binance` | 20 SELL terakhir di Binance |
| `h s 25 okx` | 25 SELL terakhir di OKX |
| `history sell 15` | 15 SELL terakhir (semua exchange) |
| `h s 30` | 30 SELL terakhir (semua exchange) |

### HISTORY NEW

| Command | Penjelasan |
|---------|-----------|
| `history new 5 bybit` | 5 transaksi terbaru di Bybit |
| `h n 5 bybit` | Singkat |
| `history new 10 binance` | 10 transaksi terbaru di Binance |
| `h n 20 okx` | 20 transaksi terbaru di OKX |
| `history new 1` | 1 transaksi terbaru (semua exchange) |
| `h n 10` | 10 transaksi terbaru (semua exchange) |
| `history new 50` | 50 transaksi terbaru (semua exchange) |

---

## 🎯 Real-World Examples

### Scenario 1: Check Recent Activity

```
User: h n 5
Bot:  📊 LATEST TRANSACTIONS (5 terbaru)
      
      1. 🔴 SELL - $50 @ Rp16,800
         Waktu: 2025-11-17 11:45:00
      
      2. 🟢 BUY - $100 @ Rp16,750
         Waktu: 2025-11-17 11:30:00
      
      ... (3 lebih)
```

### Scenario 2: Check Buy History at Specific Exchange

```
User: h b 10 bybit
Bot:  📊 BUY HISTORY - BYBIT (10 terakhir)
      
      1. 🟢 BUY - $100 @ Rp16,750
         Waktu: 2025-11-17 10:30:00
      
      2. 🟢 BUY - $50 @ Rp16,750
         Waktu: 2025-11-17 09:15:00
      
      ... (8 lebih)
```

### Scenario 3: Check Sell History with Custom Limit

```
User: history sell 20 binance
Bot:  📊 SELL HISTORY - BINANCE (20 terakhir)
      
      1. 🔴 SELL - $75 @ Rp16,800
         Waktu: 2025-11-17 11:00:00
      
      2. 🔴 SELL - $50 @ Rp16,800
         Waktu: 2025-11-17 10:00:00
      
      ... (18 lebih)
```

### Scenario 4: Compare Across Exchanges

```
User: h b 5 bybit
Bot:  📊 BUY HISTORY - BYBIT (5 terakhir)
      ...

User: h b 5 binance
Bot:  📊 BUY HISTORY - BINANCE (5 terakhir)
      ...
```

---

## 💡 Tips & Tricks

### Tip 1: Quick Check Latest Activity
```
h n 1
```
Lihat 1 transaksi terbaru (paling cepat)

### Tip 2: Monitor Specific Exchange
```
h b 10 bybit    → Check BUY di Bybit
h s 10 bybit    → Check SELL di Bybit
h n 10 bybit    → Check semua di Bybit
```

### Tip 3: Compare Exchanges
```
h b 5 bybit
h b 5 binance
h b 5 okx
```

### Tip 4: Get Detailed History
```
h b 30 bybit    → Lihat 30 BUY terakhir
h s 30 bybit    → Lihat 30 SELL terakhir
h n 50          → Lihat 50 transaksi terbaru
```

### Tip 5: Help When Confused
```
help
```
Lihat semua command yang tersedia

---

## ❌ Invalid Examples

```
history buy              ❌ Missing exchange
h b                      ❌ Missing exchange
history sell 0 bybit     ❌ Limit harus positif
h s -5 binance           ❌ Limit tidak boleh negatif
history new bybit        ❌ Missing limit untuk new
h n binance              ❌ Missing limit
history buy 10 unknown   ❌ Exchange tidak valid
h s 20 invalid           ❌ Exchange tidak valid
```

---

## ✅ Valid Examples

```
history buy bybit        ✅ 10 BUY terakhir di Bybit
h b bybit                ✅ Singkat
history buy 15 bybit     ✅ 15 BUY terakhir
h b 30 bybit             ✅ 30 BUY terakhir
history sell binance     ✅ 10 SELL terakhir di Binance
h s 20 binance           ✅ 20 SELL terakhir
history new 5 bybit      ✅ 5 transaksi terbaru di Bybit
h n 5 bybit              ✅ Singkat
history new 10           ✅ 10 transaksi terbaru (semua)
h n 50                   ✅ 50 transaksi terbaru (semua)
help                     ✅ Tampilkan help
h                        ✅ Singkat (jika hanya 1 parameter)
```

---

## 📊 Output Format

### History BUY/SELL

```
📊 [TYPE] HISTORY - [EXCHANGE] ([LIMIT] terakhir)

1. [ICON] [TYPE] - [AMOUNT] @ [PRICE]
   Waktu: [TIMESTAMP]
   
2. [ICON] [TYPE] - [AMOUNT] @ [PRICE]
   Waktu: [TIMESTAMP]
   
... (lebih)
```

### History New

```
📊 LATEST TRANSACTIONS - [EXCHANGE] ([LIMIT] terbaru)

1. [ICON] [TYPE] - [AMOUNT] @ [PRICE]
   Waktu: [TIMESTAMP]
   
2. [ICON] [TYPE] - [AMOUNT] @ [PRICE]
   Waktu: [TIMESTAMP]
   
... (lebih)
```

**Icons:**
- 🟢 = BUY
- 🔴 = SELL

---

## 🔄 Integration with Webhook

History command akan:
1. Parse command dari Telegram
2. Query database untuk transaksi
3. Filter by type (BUY/SELL/NEW)
4. Filter by exchange (jika ada)
5. Limit hasil (default 10)
6. Format dan send ke user

---

## 📱 Usage Flow

```
User sends command
    ↓
Parser validates format
    ↓
Extract: type, limit, exchange
    ↓
Query database
    ↓
Format results
    ↓
Send to Telegram
```

---

## 🎓 Learning Path

1. **Start with Help**
   ```
   help
   ```

2. **Check Recent Activity**
   ```
   h n 5
   ```

3. **Check Specific Type**
   ```
   h b 10 bybit
   h s 10 bybit
   ```

4. **Explore Exchanges**
   ```
   h b 5 binance
   h b 5 bybit
   h b 5 okx
   ```

5. **Get Detailed History**
   ```
   h b 30 bybit
   h s 30 binance
   h n 50
   ```

---

**Last Updated:** 2025-11-17
**Version:** 1.0.0
