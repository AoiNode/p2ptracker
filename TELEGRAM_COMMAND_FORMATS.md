# 📱 Telegram Command Formats

Dokumentasi lengkap semua format command yang didukung.

## 🎯 Quick Reference

### BUY Commands

| Format | Command | Contoh |
|--------|---------|--------|
| BUY IDR Lengkap | `buy rp[amount] [price] [exchange]` | `buy rp200000 16750 bybit` |
| BUY IDR Singkat | `b rp[amount] [price] [exchange]` | `b rp200000 750 bybit` |
| BUY USDT Lengkap | `buy $[amount] [price] [exchange]` | `buy $50 16750 binance` |
| BUY USDT Lengkap | `buy [amount]$ [price] [exchange]` | `buy 50$ 16750 binance` |
| BUY USDT Singkat | `b $[amount] [price] [exchange]` | `b $50 750 binance` |
| BUY USDT Singkat | `b [amount]$ [price] [exchange]` | `b 50$ 750 binance` |

### SELL Commands

| Format | Command | Contoh |
|--------|---------|--------|
| SELL IDR Lengkap | `sell rp[amount] [price] [exchange]` | `sell rp200000 16750 bybit` |
| SELL IDR Singkat | `s rp[amount] [price] [exchange]` | `s rp200000 750 bybit` |
| SELL USDT Lengkap | `sell $[amount] [price] [exchange]` | `sell $50 16750 okx` |
| SELL USDT Lengkap | `sell [amount]$ [price] [exchange]` | `sell 50$ 16750 okx` |
| SELL USDT Singkat | `s $[amount] [price] [exchange]` | `s $50 750 okx` |
| SELL USDT Singkat | `s [amount]$ [price] [exchange]` | `s 50$ 750 okx` |

### HISTORY Commands

| Format | Command | Contoh |
|--------|---------|--------|
| History BUY | `history buy [limit] [exchange]` | `history buy 10 bybit` |
| History BUY Singkat | `h b [limit] [exchange]` | `h b 15 bybit` |
| History SELL | `history sell [limit] [exchange]` | `history sell 20 binance` |
| History SELL Singkat | `h s [limit] [exchange]` | `h s 25 okx` |
| History NEW | `history new [limit] [exchange]` | `history new 5 bybit` |
| History NEW Singkat | `h n [limit] [exchange]` | `h n 10` |

### HELP Command

| Format | Command | Contoh |
|--------|---------|--------|
| Help | `help` | `help` |
| Help Singkat | `h` | `h` |

---

## 📖 Detailed Formats

### 1. BUY dengan IDR

#### Format Lengkap
```
buy rp200000 16750 bybit
```

**Penjelasan:**
- `buy` = Command untuk membeli
- `rp200000` = Jumlah IDR yang ingin dibeli (prefix "rp")
- `16750` = Harga USDT/IDR
- `bybit` = Exchange platform

**Hasil:**
- USDT yang didapat: 200000 / 16750 = 11.94 USDT
- Session dibuat atau di-merge dengan session existing

#### Format Singkat
```
b rp200000 750 bybit
```

**Penjelasan:**
- `b` = Singkat dari "buy"
- `rp200000` = Jumlah IDR
- `750` = Harga singkat (otomatis jadi 16750, prefix "16" default)
- `bybit` = Exchange

**Hasil:** Sama seperti format lengkap

---

### 2. BUY dengan USDT

#### Format Lengkap (Prefix $)
```
buy $50 16750 binance
```

**Penjelasan:**
- `buy` = Command untuk membeli
- `$50` = Jumlah USDT (prefix "$")
- `16750` = Harga USDT/IDR
- `binance` = Exchange

**Hasil:**
- Total IDR: 50 * 16750 = 837,500 IDR
- Session dibuat atau di-merge

#### Format Lengkap (Suffix $)
```
buy 50$ 16750 binance
```

**Penjelasan:**
- `buy` = Command untuk membeli
- `50$` = Jumlah USDT (suffix "$")
- `16750` = Harga USDT/IDR
- `binance` = Exchange

**Hasil:** Sama seperti format prefix

#### Format Singkat (Prefix $)
```
b $50 750 binance
```

**Penjelasan:**
- `b` = Singkat dari "buy"
- `$50` = Jumlah USDT
- `750` = Harga singkat (otomatis jadi 16750)
- `binance` = Exchange

#### Format Singkat (Suffix $)
```
b 50$ 750 binance
```

**Penjelasan:**
- `b` = Singkat dari "buy"
- `50$` = Jumlah USDT (suffix)
- `750` = Harga singkat (otomatis jadi 16750)
- `binance` = Exchange

---

### 3. SELL dengan IDR

#### Format Lengkap
```
sell rp200000 16750 bybit
```

**Penjelasan:**
- `sell` = Command untuk menjual
- `rp200000` = Jumlah IDR yang ingin dijual
- `16750` = Harga USDT/IDR
- `bybit` = Exchange

**Hasil:**
- USDT yang dijual: 200000 / 16750 = 11.94 USDT
- FIFO matching dengan sessions
- Profit/loss dihitung otomatis

#### Format Singkat
```
s rp200000 750 bybit
```

**Penjelasan:**
- `s` = Singkat dari "sell"
- `rp200000` = Jumlah IDR
- `750` = Harga singkat (otomatis jadi 16750)
- `bybit` = Exchange

---

### 4. SELL dengan USDT

#### Format Lengkap (Prefix $)
```
sell $50 16750 okx
```

**Penjelasan:**
- `sell` = Command untuk menjual
- `$50` = Jumlah USDT (prefix "$")
- `16750` = Harga USDT/IDR
- `okx` = Exchange

**Hasil:**
- Total IDR: 50 * 16750 = 837,500 IDR
- FIFO matching dengan sessions
- Profit/loss dihitung

#### Format Lengkap (Suffix $)
```
sell 50$ 16750 okx
```

**Penjelasan:**
- `sell` = Command untuk menjual
- `50$` = Jumlah USDT (suffix "$")
- `16750` = Harga USDT/IDR
- `okx` = Exchange

#### Format Singkat (Prefix $)
```
s $50 750 okx
```

**Penjelasan:**
- `s` = Singkat dari "sell"
- `$50` = Jumlah USDT
- `750` = Harga singkat (otomatis jadi 16750)
- `okx` = Exchange

#### Format Singkat (Suffix $)
```
s 50$ 750 okx
```

**Penjelasan:**
- `s` = Singkat dari "sell"
- `50$` = Jumlah USDT (suffix)
- `750` = Harga singkat (otomatis jadi 16750)
- `okx` = Exchange

---

## 🔢 Price Shorthand

### Cara Kerja

**Jika harga < 1000:**
- Otomatis ditambah prefix "16"
- Contoh: `750` → `16750`

**Jika harga >= 1000:**
- Digunakan sebagai harga penuh
- Contoh: `16750` → `16750`

### Contoh Price Shorthand

| Input | Output | Keterangan |
|-------|--------|-----------|
| `750` | `16750` | Singkat, auto prefix 16 |
| `800` | `16800` | Singkat, auto prefix 16 |
| `500` | `16500` | Singkat, auto prefix 16 |
| `16750` | `16750` | Lengkap, tidak diubah |
| `17000` | `17000` | Lengkap, tidak diubah |
| `20000` | `20000` | Lengkap, tidak diubah |

---

## 💱 Amount Formats

### IDR Format

**Prefix "rp":**
```
rp200000
rp500000
rp1000000
```

### USDT Format

**Prefix "$":**
```
$50
$100
$20.5
```

**Suffix "$":**
```
50$
100$
20.5$
```

---

## 🏢 Exchange Options

Semua format command support exchange berikut:

- `binance` (default)
- `bybit`
- `okx`
- `bitget`
- `tokocrypto`
- `other`

---

## 📋 Command Shorthand Reference

### Transaction Type

| Lengkap | Singkat |
|---------|---------|
| `buy` | `b` |
| `sell` | `s` |

### Amount

| Tipe | Format | Contoh |
|------|--------|--------|
| IDR | `rp[amount]` | `rp200000` |
| USDT | `$[amount]` | `$50` |
| USDT | `[amount]$` | `50$` |

### Price

| Tipe | Format | Contoh |
|------|--------|--------|
| Lengkap | `[price]` | `16750` |
| Singkat | `[price]` | `750` (auto jadi 16750) |

---

## 🎯 Real-World Examples

### Scenario 1: Daily Trading

**Morning - Buy di Binance:**
```
b $100 750 binance
```
→ Buy 100 USDT at 16750, Binance

**Afternoon - Buy lagi di Binance (merge):**
```
b $50 750 binance
```
→ Buy 50 USDT at 16750, merge dengan session existing

**Evening - Sell di Binance:**
```
s $75 800 binance
```
→ Sell 75 USDT at 16800, FIFO matched

---

### Scenario 2: Multi-Exchange

**Buy di Bybit:**
```
buy rp500000 750 bybit
```
→ Buy Rp500.000 at 16750, Bybit

**Buy di OKX:**
```
b $30 750 okx
```
→ Buy 30 USDT at 16750, OKX

**Sell dari Bybit:**
```
s rp300000 800 bybit
```
→ Sell Rp300.000 worth at 16800, Bybit

---

### Scenario 3: Quick Trading

**Rapid buy:**
```
b 20$ 750 bybit
b 30$ 750 bybit
b 50$ 750 bybit
```

**Quick sell:**
```
s 50$ 800 bybit
s 30$ 800 bybit
```

---

## ✅ Valid Examples

### BUY Commands
```
buy rp200000 16750 bybit      ✅ BUY IDR Lengkap
b rp200000 750 bybit          ✅ BUY IDR Singkat
buy $50 16750 binance         ✅ BUY USDT Lengkap (prefix)
buy 50$ 16750 binance         ✅ BUY USDT Lengkap (suffix)
b $50 750 binance             ✅ BUY USDT Singkat (prefix)
b 50$ 750 binance             ✅ BUY USDT Singkat (suffix)
```

### SELL Commands
```
sell rp200000 16750 bybit     ✅ SELL IDR Lengkap
s rp200000 750 bybit          ✅ SELL IDR Singkat
sell $50 16750 okx            ✅ SELL USDT Lengkap (prefix)
sell 50$ 16750 okx            ✅ SELL USDT Lengkap (suffix)
s $50 750 okx                 ✅ SELL USDT Singkat (prefix)
s 50$ 750 okx                 ✅ SELL USDT Singkat (suffix)
```

---

## ❌ Invalid Examples

```
buy 200000 16750 bybit        ❌ Missing "rp" prefix for IDR
b 50 750 binance              ❌ Missing "$" for USDT
buy rp200000 bybit            ❌ Missing price
b $50 binance                 ❌ Missing price
sell 50 16750                 ❌ Missing exchange
s rp200000 750                ❌ Missing exchange
buy rp200000 16750 unknown    ❌ Invalid exchange
```

---

## 🔄 Conversion Examples

### IDR to USDT

```
buy rp200000 16750 bybit
```

**Calculation:**
- Amount IDR: 200000
- Price: 16750 IDR/USDT
- USDT: 200000 ÷ 16750 = 11.94 USDT

### USDT to IDR

```
sell $50 16750 okx
```

**Calculation:**
- Amount USDT: 50
- Price: 16750 IDR/USDT
- IDR: 50 × 16750 = 837,500 IDR

---

## 📊 Price Shorthand Logic

```javascript
// Jika harga < 1000, tambah prefix "16"
if (price < 1000) {
  fullPrice = 16000 + price;
}

// Contoh:
// 750 → 16750
// 800 → 16800
// 500 → 16500
// 16750 → 16750 (tidak berubah)
```

---

## 🎓 Tips & Tricks

### Tip 1: Gunakan Format Singkat untuk Cepat
```
b $50 750 bybit    (lebih cepat dari)
buy $50 16750 bybit
```

### Tip 2: Konsisten dengan Exchange
```
b $50 750 bybit
b $30 750 bybit
s $40 800 bybit    (semua di Bybit)
```

### Tip 3: Mix USDT & IDR
```
b rp500000 750 binance   (IDR)
b $50 750 binance        (USDT, sama exchange)
s $30 800 binance        (USDT, same exchange)
```

### Tip 4: Rapid Trading
```
b 20$ 750 bybit
b 30$ 750 bybit
s 50$ 800 bybit
```

---

## 📞 Support

Jika ada pertanyaan tentang format command:
1. Lihat contoh di atas
2. Cek tabel Quick Reference
3. Lihat Real-World Examples

---

**Last Updated:** 2025-11-17
**Version:** 1.1.0 (dengan shorthand support)
