# Complete Telegram Bot Setup Guide

## 🚀 Setup dalam 5 Langkah

### LANGKAH 1: Create Database Tables (PENTING!)

**Ini adalah masalah Anda - tables belum dibuat!**

1. Buka **Supabase Dashboard**
2. Pilih project Anda
3. Pergi ke **SQL Editor**
4. Buat tab baru
5. Copy-paste seluruh isi file: `TELEGRAM_DATABASE_MIGRATION.sql`
6. Klik **Run** atau **Ctrl+Enter**
7. Tunggu sampai selesai (harus ada ✅)

**Verify:**
```sql
SELECT * FROM public.telegram_linking_codes;
SELECT * FROM public.telegram_users;
```

Kedua query harus return empty table (tidak error).

---

### LANGKAH 2: Setup Environment Variables

Pastikan di Vercel sudah ada:

1. Buka **Vercel Dashboard**
2. Pilih project: `p2ptracker`
3. Pergi ke **Settings → Environment Variables**
4. Pastikan ada:
   - ✅ `TELEGRAM_BOT_TOKEN` = Token dari @BotFather
   - ✅ `NEXT_PUBLIC_SUPABASE_URL` = URL Supabase project
   - ✅ `SUPABASE_SERVICE_ROLE_KEY` = Service role key dari Supabase

**Jika belum ada, tambahkan sekarang!**

---

### LANGKAH 3: Redeploy Application

Setelah tambah env vars:

1. Buka **Vercel Dashboard**
2. Pilih project `p2ptracker`
3. Klik **Deployments**
4. Klik **Redeploy** pada deployment terbaru
5. Tunggu sampai selesai (Status: Ready)

---

### LANGKAH 4: Setup Webhook

Setelah deploy selesai:

1. Buka browser: `https://p2ptracker.vercel.app/api/telegram/setup`
   (Ganti `p2ptracker.vercel.app` dengan domain Anda)

2. Anda akan lihat:
   ```
   Bot Information:
   - Name: [Bot Name]
   - Username: @[bot_username]
   
   Webhook Status:
   - [Status]
   ```

3. Klik tombol **"Setup Webhook"**

4. Tunggu sampai muncul:
   ```
   ✅ Webhook Active
   https://p2ptracker.vercel.app/api/telegram/webhook
   ```

---

### LANGKAH 5: Test Linking

Sekarang coba link akun:

#### A. Generate Linking Code di Web

1. Buka aplikasi: `https://p2ptracker.vercel.app`
2. Login dengan akun Anda
3. Pergi ke **Settings → Telegram Bot**
4. Klik **"Generate Kode Linking"**
5. Copy kode (misal: `ABC123`)

#### B. Link Account di Telegram

1. Buka Telegram
2. Cari bot Anda (misal: `@p2p_tracker_bot`)
3. Kirim pesan: `/link ABC123`
4. Bot akan respond dengan:
   ```
   ✅ Akun Telegram berhasil terhubung dengan web!
   
   Sekarang Anda bisa mengirim command transaksi:
   
   🟢 BUY: buy $50 16750 bybit
   🔴 SELL: sell $50 16750 bybit
   📊 HISTORY: h b 10
   🆘 HELP: help
   ```

#### C. Verify di Web

1. Refresh halaman Settings → Telegram Bot
2. Anda akan lihat:
   ```
   ✅ Akun Terhubung
   Nama: [Your Name]
   Username: @[your_username]
   Terhubung: [Date]
   ```

---

## ✅ Checklist

- [ ] **Database Tables Created**
  - [ ] `telegram_linking_codes` table exists
  - [ ] `telegram_users` table exists
  - [ ] Indexes created
  - [ ] RLS policies enabled

- [ ] **Environment Variables Set**
  - [ ] `TELEGRAM_BOT_TOKEN` ✅
  - [ ] `NEXT_PUBLIC_SUPABASE_URL` ✅
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` ✅

- [ ] **Application Deployed**
  - [ ] Latest code pushed to GitHub
  - [ ] Vercel deployment successful
  - [ ] No build errors

- [ ] **Webhook Setup**
  - [ ] Webhook URL configured
  - [ ] Webhook status: Active ✅

- [ ] **Linking Tested**
  - [ ] Generate code di web ✅
  - [ ] Send `/link CODE` di Telegram ✅
  - [ ] Bot respond dengan konfirmasi ✅
  - [ ] Account linked di web ✅

---

## 🆘 Troubleshooting

### Problem: Bot tidak respond ke `/link` command

**Cause:** Database tables tidak ada

**Solution:**
1. Run SQL migration di Supabase
2. Verify tables exist
3. Redeploy aplikasi
4. Try again

### Problem: Error "Missing Supabase environment variables"

**Cause:** Env vars tidak set di Vercel

**Solution:**
1. Add env vars di Vercel
2. Redeploy aplikasi
3. Check Vercel logs untuk errors

### Problem: Webhook tidak active

**Cause:** Webhook belum di-setup

**Solution:**
1. Buka `/api/telegram/setup`
2. Klik "Setup Webhook"
3. Tunggu sampai status berubah ke "Active"

### Problem: Linking code invalid

**Cause:** Code sudah expired (10 menit) atau typo

**Solution:**
1. Generate code baru di web
2. Copy dengan hati-hati
3. Send dalam 10 menit

### Problem: Account tidak muncul di web setelah linking

**Cause:** Halaman belum di-refresh

**Solution:**
1. Refresh halaman settings/telegram
2. Check database: `SELECT * FROM telegram_users`
3. Verify user_id match

---

## 📊 Database Verification

Setelah setup, jalankan queries ini di Supabase SQL Editor:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('telegram_linking_codes', 'telegram_users');

-- Check linking codes (should be empty initially)
SELECT COUNT(*) FROM public.telegram_linking_codes;

-- Check linked accounts (should be empty initially)
SELECT COUNT(*) FROM public.telegram_users;

-- After linking, check data
SELECT * FROM public.telegram_users;
```

---

## 🔗 Linking Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      TELEGRAM BOT LINKING                   │
└─────────────────────────────────────────────────────────────┘

1. WEB: Generate Code
   └─> Settings → Telegram Bot → Generate Kode Linking
   └─> Code: ABC123 (valid 10 menit)

2. TELEGRAM: Send Link Command
   └─> /link ABC123

3. BOT: Verify & Link
   └─> Query telegram_linking_codes table
   └─> Verify code valid & not expired
   └─> Insert ke telegram_users table
   └─> Delete linking code
   └─> Send confirmation

4. WEB: Show Linked Account
   └─> Refresh Settings → Telegram Bot
   └─> Show "✅ Akun Terhubung"
   └─> Show name, username, connection date

5. TELEGRAM: Ready for Commands
   └─> buy $50 16750 bybit
   └─> sell $50 16750 bybit
   └─> h b 10
   └─> help
```

---

## 📞 Support

Jika masih ada masalah:

1. **Check Vercel Logs**
   ```
   vercel logs
   ```

2. **Check Supabase Logs**
   - Dashboard → Logs

3. **Check Database**
   - Run verification queries

4. **Check Bot Token**
   - Verify token valid di @BotFather

5. **Check Webhook**
   - Buka `/api/telegram/setup`
   - Verify webhook active

---

## 🎯 Next Steps

Setelah linking berhasil:

1. **Test Commands**
   - Send: `buy $50 16750 bybit`
   - Send: `sell $50 16750 bybit`
   - Send: `help`

2. **Check Transactions**
   - Verify data saved ke database
   - Check user_id match

3. **Monitor Logs**
   - Watch Vercel logs untuk errors
   - Check Supabase logs

4. **Add More Features**
   - Implement transaction creation
   - Implement history queries
   - Add profit/loss calculation

---

**Good luck! 🚀**
