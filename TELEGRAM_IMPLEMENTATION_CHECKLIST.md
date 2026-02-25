# Telegram Bot Implementation Checklist

Checklist lengkap untuk setup dan deploy Telegram Bot integration.

## ✅ Pre-Setup (Sebelum Setup)

- [ ] Baca dokumentasi:
  - [ ] `TELEGRAM_BOT_SETUP.md` - Setup guide lengkap
  - [ ] `TELEGRAM_QUICK_START.md` - Quick start
  - [ ] `TELEGRAM_API_REFERENCE.md` - API reference

- [ ] Persiapan:
  - [ ] Punya akun Telegram
  - [ ] Punya akses ke Vercel Dashboard
  - [ ] Domain Vercel sudah siap (atau custom domain)

## 🤖 Step 1: Create Telegram Bot

- [ ] Buka Telegram dan cari **@BotFather**
- [ ] Ketik `/newbot`
- [ ] Isi nama bot (contoh: "P2P Tracker Bot")
- [ ] Isi username bot (contoh: "p2p_tracker_bot", harus unik)
- [ ] **Simpan token yang diberikan**
  - Format: `123456789:ABCDefGHIjklMNOpqrsTUVwxyzABCDefGHI`
  - Jangan share token ini!

## 🔐 Step 2: Setup Environment Variable

### Di Vercel Dashboard:

- [ ] Login ke Vercel Dashboard
- [ ] Pilih project P2P Tracker
- [ ] Pergi ke **Settings**
- [ ] Klik **Environment Variables**
- [ ] Klik **Add New**
- [ ] Isi:
  - [ ] Name: `TELEGRAM_BOT_TOKEN`
  - [ ] Value: Token dari BotFather
  - [ ] Environments: Pilih semua (Production, Preview, Development)
- [ ] Klik **Save**

### Di Local Development (.env.local):

- [ ] Buka file `.env.local`
- [ ] Tambahkan:
  ```
  TELEGRAM_BOT_TOKEN=123456789:ABCDefGHIjklMNOpqrsTUVwxyzABCDefGHI
  ```
- [ ] Simpan file

## 🚀 Step 3: Deploy

- [ ] Commit dan push perubahan ke Git:
  ```bash
  git add .
  git commit -m "Add Telegram Bot integration"
  git push
  ```

- [ ] Tunggu Vercel auto-deploy selesai
  - [ ] Cek status di Vercel Dashboard
  - [ ] Pastikan build berhasil (bukan failed)

- [ ] Atau manual redeploy:
  - [ ] Buka Vercel Dashboard
  - [ ] Klik **Deployments**
  - [ ] Klik **Redeploy** pada deployment terbaru

## 🔗 Step 4: Setup Webhook

### Option A: Via Browser (Recommended)

- [ ] Buka browser dan akses:
  ```
  https://yourdomain.com/api/telegram/setup
  ```
  Ganti `yourdomain.com` dengan domain Vercel Anda

- [ ] Lihat status bot dan webhook
- [ ] Klik tombol **"Setup Webhook"**
- [ ] Tunggu response `"success": true`

### Option B: Via cURL

- [ ] Buka terminal
- [ ] Jalankan:
  ```bash
  curl -X POST https://yourdomain.com/api/telegram/setup \
    -H "Content-Type: application/json" \
    -d '{"webhookUrl": "https://yourdomain.com/api/telegram/webhook"}'
  ```

- [ ] Tunggu response:
  ```json
  {
    "success": true,
    "message": "Webhook configured successfully"
  }
  ```

### Option C: Via Browser Console

- [ ] Buka browser console (F12)
- [ ] Jalankan:
  ```javascript
  fetch('https://yourdomain.com/api/telegram/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webhookUrl: 'https://yourdomain.com/api/telegram/webhook'
    })
  }).then(r => r.json()).then(console.log);
  ```

## ✅ Step 5: Verification

- [ ] Cek webhook status:
  ```bash
  curl https://yourdomain.com/api/telegram/setup
  ```

- [ ] Response harus menunjukkan:
  - [ ] Bot info (id, username, first_name)
  - [ ] Webhook URL aktif
  - [ ] Pending updates: 0

- [ ] Test di Telegram:
  - [ ] Cari bot Anda (contoh: `@p2p_tracker_bot`)
  - [ ] Klik **START**
  - [ ] Kirim command test:
    ```
    buy $50 16750 binance
    ```
  - [ ] Tunggu response dari bot
  - [ ] Response harus menunjukkan transaksi berhasil disimpan

- [ ] Verifikasi di website:
  - [ ] Login ke P2P Tracker
  - [ ] Pergi ke halaman **Transaksi**
  - [ ] Cek apakah transaksi dari Telegram muncul
  - [ ] Klik transaksi untuk lihat detail

## 🎯 Step 6: Settings Page Integration

- [ ] Login ke aplikasi P2P Tracker
- [ ] Pergi ke **Settings**
- [ ] Cari menu **🤖 Telegram Bot**
- [ ] Klik untuk membuka halaman Telegram Bot settings
- [ ] Verifikasi:
  - [ ] Bot info ditampilkan
  - [ ] Webhook status ditampilkan
  - [ ] Command format ditampilkan

## 📱 Step 7: Test Commands

Kirim command berikut ke bot dan verifikasi response:

### Test 1: BUY dengan USDT
- [ ] Command: `buy $50 16750 binance`
- [ ] Expected response: ✅ BUY Transaction Saved
- [ ] Verifikasi di website: Transaksi muncul

### Test 2: BUY dengan IDR
- [ ] Command: `buy rp500000 16750 bybit`
- [ ] Expected response: ✅ BUY Transaction Saved
- [ ] Verifikasi di website: Transaksi muncul

### Test 3: SELL
- [ ] Command: `sell 10 16800 okx`
- [ ] Expected response: ✅ SELL Transaction Saved
- [ ] Verifikasi di website: Transaksi muncul

### Test 4: Invalid Command
- [ ] Command: `invalid command`
- [ ] Expected response: ❌ Format Error dengan contoh format

### Test 5: Invalid Exchange
- [ ] Command: `buy $50 16750 unknown`
- [ ] Expected response: ❌ Exchange tidak valid

## 🔍 Step 8: Monitoring

### Check Logs

- [ ] Buka Vercel Dashboard
- [ ] Pergi ke **Settings → Function Logs**
- [ ] Filter untuk `/api/telegram`
- [ ] Verifikasi tidak ada error

### Check Database

- [ ] Login ke Supabase Dashboard
- [ ] Pergi ke **SQL Editor**
- [ ] Query transactions dari Telegram:
  ```sql
  SELECT * FROM transactions 
  WHERE user_id = 'YOUR_TELEGRAM_USER_ID'
  ORDER BY created_at DESC
  LIMIT 10;
  ```
- [ ] Verifikasi transaksi tersimpan dengan benar

### Check Webhook Status

- [ ] Akses: `https://yourdomain.com/api/telegram/setup`
- [ ] Verifikasi:
  - [ ] Webhook URL aktif
  - [ ] Pending updates: 0 (atau rendah)
  - [ ] Tidak ada error messages

## 🚨 Troubleshooting

### Bot tidak merespons

- [ ] Cek:
  - [ ] `TELEGRAM_BOT_TOKEN` sudah di-set di Vercel
  - [ ] Aplikasi sudah di-redeploy
  - [ ] Webhook sudah di-setup
  - [ ] Logs di Vercel tidak ada error

- [ ] Solusi:
  - [ ] Redeploy aplikasi
  - [ ] Delete dan setup webhook lagi
  - [ ] Restart bot dengan `/start` di Telegram

### Webhook error

- [ ] Cek status: `https://yourdomain.com/api/telegram/setup`
- [ ] Lihat `last_error_message`
- [ ] Common errors:
  - [ ] "Webhook URL is not HTTPS" → Pastikan domain HTTPS
  - [ ] "Connection refused" → Pastikan domain accessible
  - [ ] "Unauthorized" → Pastikan token benar

### Transaksi tidak muncul di website

- [ ] Cek:
  - [ ] Refresh halaman transaksi
  - [ ] Login dengan akun yang benar
  - [ ] Cek database di Supabase

- [ ] Lihat logs:
  - [ ] Vercel Function Logs
  - [ ] Browser console (F12)

### Error "Format tidak valid"

- [ ] Verifikasi format command:
  - [ ] `buy rp205000 16750 bybit` (BUY IDR)
  - [ ] `buy $50 16750 binance` (BUY USDT)
  - [ ] `sell 10 16800 okx` (SELL)

- [ ] Pastikan:
  - [ ] Prefix "rp" untuk IDR
  - [ ] Prefix "$" untuk USDT
  - [ ] Exchange valid: binance, bybit, okx, bitget, tokocrypto, other

## 📊 Step 9: Production Readiness

- [ ] Security:
  - [ ] Token tidak di-hardcode
  - [ ] Token hanya di environment variable
  - [ ] Webhook hanya accept POST dari Telegram

- [ ] Performance:
  - [ ] Response time < 1 second
  - [ ] Database queries optimized
  - [ ] No memory leaks

- [ ] Reliability:
  - [ ] Error handling implemented
  - [ ] Fallback untuk failed requests
  - [ ] Logging untuk debugging

- [ ] Documentation:
  - [ ] README updated
  - [ ] API reference complete
  - [ ] Setup guide clear

## 🎉 Step 10: Go Live

- [ ] Semua test passed
- [ ] Semua checklist completed
- [ ] Logs clean (no errors)
- [ ] Ready untuk production use!

---

## 📝 Notes

- Simpan token Telegram di tempat aman
- Jangan share token dengan siapa pun
- Backup token di password manager
- Monitor logs secara berkala
- Update dokumentasi jika ada perubahan

## 🆘 Support

Jika ada masalah:
1. Baca dokumentasi di folder root
2. Cek logs di Vercel Dashboard
3. Lihat error message dari bot
4. Cek database di Supabase

---

**Status: Ready for Setup! ✅**
