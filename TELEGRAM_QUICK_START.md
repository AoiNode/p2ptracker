# Telegram Bot - Quick Start Guide

Panduan cepat untuk setup Telegram Bot pada P2P Tracker Anda.

## 🚀 Setup dalam 5 Menit

### Step 1: Buat Bot di Telegram (2 menit)

1. Buka Telegram dan cari **@BotFather**
2. Ketik `/newbot`
3. Isi nama bot: "P2P Tracker Bot" (atau nama pilihan Anda)
4. Isi username: "p2p_tracker_bot" (harus unik, berakhir dengan "bot")
5. **Simpan token yang diberikan** (contoh: `123456789:ABCDefGHIjklMNOpqrsTUVwxyzABCDefGHI`)

### Step 2: Setup Environment Variable di Vercel (2 menit)

1. Buka **Vercel Dashboard** → Project Anda
2. Pergi ke **Settings → Environment Variables**
3. Klik **Add New**
4. Isi:
   - **Name**: `TELEGRAM_BOT_TOKEN`
   - **Value**: Token dari BotFather
   - **Environments**: Pilih semua (Production, Preview, Development)
5. Klik **Save**
6. **Redeploy** aplikasi Anda (atau tunggu auto-deploy)

### Step 3: Setup Webhook (1 menit)

Setelah deploy selesai, buka browser dan akses:

```
https://yourdomain.com/api/telegram/setup
```

Ganti `yourdomain.com` dengan domain Vercel Anda (contoh: `p2ptracker.vercel.app`).

Anda akan melihat status bot dan webhook.

### Step 4: Aktifkan Webhook

Di halaman yang sama, klik tombol **"Setup Webhook"** atau buka browser console dan jalankan:

```javascript
fetch('https://yourdomain.com/api/telegram/setup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    webhookUrl: 'https://yourdomain.com/api/telegram/webhook'
  })
}).then(r => r.json()).then(console.log);
```

Tunggu response `"success": true`.

## 📱 Cara Menggunakan

### Buka Bot di Telegram
Cari bot Anda dengan username yang Anda buat (contoh: `@p2p_tracker_bot`) dan klik **START**.

### Format Command

#### 1. BUY dengan IDR

**Lengkap:**
```
buy rp205000 16750 bybit
```

**Singkat:**
```
b rp205000 750 bybit
```
(Harga otomatis jadi 16750)

#### 2. BUY dengan USDT

**Lengkap:**
```
buy $50 16750 binance
buy 50$ 16750 binance
```

**Singkat:**
```
b $50 750 binance
b 50$ 750 binance
```
(Harga otomatis jadi 16750)

#### 3. SELL dengan IDR

**Lengkap:**
```
sell rp200000 16750 bybit
```

**Singkat:**
```
s rp200000 750 bybit
```

#### 4. SELL dengan USDT

**Lengkap:**
```
sell $50 16750 okx
sell 50$ 16750 okx
```

**Singkat:**
```
s $50 750 okx
s 50$ 750 okx
```

### Exchange yang Tersedia
- `binance` (default)
- `bybit`
- `okx`
- `bitget`
- `tokocrypto`
- `other`

### Command Shorthand

| Tipe | Lengkap | Singkat |
|------|---------|---------|
| BUY | `buy` | `b` |
| SELL | `sell` | `s` |
| Harga | `16750` | `750` (auto jadi 16750) |
| USDT | `$50` atau `50$` | `$50` atau `50$` |
| IDR | `rp200000` | `rp200000` |

## ✅ Fitur Otomatis

### BUY Transaction
✅ Membuat session baru otomatis  
✅ Merge dengan session existing (jika ada harga sama)  
✅ Simpan exchange label  

### SELL Transaction
✅ FIFO matching otomatis  
✅ Hitung profit/loss otomatis  
✅ Tutup session jika USDT habis  
✅ Simpan exchange label  

## 🔍 Cek Status di Website

1. Buka aplikasi P2P Tracker
2. Pergi ke **Settings → Telegram Bot**
3. Lihat status bot dan webhook
4. Lihat format command yang benar

## 🐛 Troubleshooting

### Bot tidak merespons
- ✅ Pastikan `TELEGRAM_BOT_TOKEN` sudah di-set di Vercel
- ✅ Pastikan aplikasi sudah di-redeploy
- ✅ Cek status webhook di `/api/telegram/setup`
- ✅ Lihat logs di Vercel: Settings → Function Logs

### Error "Format tidak valid"
- ✅ Pastikan format: `buy/sell [amount] [price] [exchange]`
- ✅ Untuk IDR: gunakan prefix `rp` (contoh: `rp205000`)
- ✅ Untuk USDT: gunakan prefix `$` (contoh: `$20`)
- ✅ Exchange harus salah satu dari list di atas

### Transaksi tidak muncul di website
- ✅ Refresh halaman transaksi
- ✅ Cek apakah Anda sudah login dengan akun yang benar
- ✅ Lihat logs di Vercel untuk error details

## 📊 Contoh Penggunaan Lengkap

**Scenario**: Anda ingin membeli 50 USDT di Bybit dengan harga Rp16.750

**Command**:
```
buy $50 16750 bybit
```

**Response dari Bot**:
```
✅ BUY Transaction Saved

💰 Amount: $50.00
💵 Total IDR: Rp837,500
📊 Price: Rp16,750
🏢 Exchange: Bybit
```

**Di Website**:
- Transaksi muncul di halaman Transaksi
- Session baru dibuat dengan 50 USDT
- Exchange label "Bybit" tersimpan

## 🔐 Security

- ✅ Token disimpan di environment variable (tidak di-hardcode)
- ✅ Webhook hanya menerima POST dari Telegram
- ✅ User ID dari Telegram digunakan sebagai user_id
- ✅ Setiap user hanya bisa akses transaksi mereka sendiri

## 📚 Dokumentasi Lengkap

Untuk dokumentasi lebih detail, baca: `TELEGRAM_BOT_SETUP.md`

---

**Selamat! Telegram Bot Anda sudah siap digunakan! 🎉**
