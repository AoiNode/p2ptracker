# Telegram Account Linking - Setup Guide

## 📋 Database Setup

### 1. Create `telegram_linking_codes` Table

Jalankan SQL di Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS telegram_linking_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_telegram_linking_codes_code ON telegram_linking_codes(code);
CREATE INDEX idx_telegram_linking_codes_user_id ON telegram_linking_codes(user_id);
```

### 2. Create `telegram_users` Table

```sql
CREATE TABLE IF NOT EXISTS telegram_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL UNIQUE,
  telegram_username TEXT,
  telegram_first_name TEXT,
  connected_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_telegram_users_user_id ON telegram_users(user_id);
CREATE INDEX idx_telegram_users_telegram_id ON telegram_users(telegram_user_id);
```

---

## 🔗 Linking Flow

### Step 1: User Generate Linking Code (Web)

```
User di Web
    ↓
Buka Settings → Telegram Bot
    ↓
Klik "Generate Kode Linking"
    ↓
Kode: ABC123 (valid 10 menit)
    ↓
Copy kode
```

**API Call:**
```
POST /api/telegram/link
Body: { userId: "user-uuid" }
Response: { code: "ABC123", expiresAt: "2025-11-17T04:10:00Z" }
```

### Step 2: User Link Account (Telegram)

```
User di Telegram
    ↓
Kirim pesan ke bot: /link ABC123
    ↓
Bot verifikasi kode
    ↓
Bot link akun ke database
    ↓
Bot send konfirmasi
```

**Webhook Processing:**
```
1. Bot terima: /link ABC123
2. Query telegram_linking_codes table
3. Verifikasi code valid & belum expired
4. Insert ke telegram_users table
5. Delete linking code
6. Send success message
```

### Step 3: Confirmation (Web & Telegram)

**Telegram:**
```
✅ Akun Telegram berhasil terhubung dengan web!

Sekarang Anda bisa mengirim command transaksi:

🟢 BUY: buy $50 16750 bybit
🔴 SELL: sell $50 16750 bybit
📊 HISTORY: h b 10
🆘 HELP: help
```

**Web:**
```
Refresh halaman settings/telegram
    ↓
Lihat "✅ Akun Terhubung"
    ↓
Tampilkan nama, username, tanggal linking
```

---

## 🔐 Security Features

✅ **Linking Code Expiration** - 10 menit  
✅ **One-time Use** - Kode dihapus setelah digunakan  
✅ **Duplicate Prevention** - Cek akun sudah linked  
✅ **User Isolation** - Setiap user hanya link akun mereka  
✅ **Error Handling** - Pesan error yang jelas  

---

## 📝 Error Messages

### Invalid Code
```
❌ Kode linking tidak valid atau sudah kadaluarsa.
```

### Expired Code
```
❌ Kode linking sudah kadaluarsa. Silakan generate kode baru di web.
```

### Already Linked
```
⚠️ Akun Telegram Anda sudah terhubung dengan web.
```

### Linking Failed
```
❌ Gagal menghubungkan akun. Silakan coba lagi.
```

---

## 🧪 Testing

### Test Linking Flow

```bash
# 1. Generate linking code di web
# Settings → Telegram Bot → Generate Kode Linking
# Copy kode: ABC123

# 2. Send linking command di Telegram
# /link ABC123

# 3. Verify in database
SELECT * FROM telegram_users WHERE telegram_user_id = YOUR_TELEGRAM_ID;

# 4. Check linking code was deleted
SELECT * FROM telegram_linking_codes WHERE code = 'ABC123';
# Should return empty
```

### Test Error Cases

```bash
# Test invalid code
/link INVALID

# Test expired code (wait 10 minutes)
# Generate code, wait, then send

# Test duplicate linking
# Link account, try linking again
```

---

## 🔄 Unlinking Account

### TODO: Implement Unlink Feature

```sql
-- Delete linking
DELETE FROM telegram_users 
WHERE user_id = $1 AND telegram_user_id = $2;

-- Or soft delete
UPDATE telegram_users 
SET updated_at = NOW() 
WHERE user_id = $1 AND telegram_user_id = $2;
```

---

## 📊 Database Queries

### Get Linked Account Info

```sql
SELECT 
  telegram_user_id,
  telegram_username,
  telegram_first_name,
  connected_at
FROM telegram_users
WHERE user_id = $1;
```

### Check if Telegram User Already Linked

```sql
SELECT user_id FROM telegram_users
WHERE telegram_user_id = $1;
```

### Get Active Linking Codes

```sql
SELECT code, expires_at FROM telegram_linking_codes
WHERE user_id = $1 AND expires_at > NOW();
```

### Clean Up Expired Codes

```sql
DELETE FROM telegram_linking_codes
WHERE expires_at < NOW();
```

---

## 🚀 Deployment Checklist

- [ ] Create `telegram_linking_codes` table di Supabase
- [ ] Create `telegram_users` table di Supabase
- [ ] Add `TELEGRAM_BOT_TOKEN` ke Vercel env vars
- [ ] Add `NEXT_PUBLIC_SUPABASE_URL` ke Vercel env vars
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` ke Vercel env vars
- [ ] Deploy aplikasi ke Vercel
- [ ] Setup webhook di Telegram bot
- [ ] Test linking flow end-to-end
- [ ] Test error cases
- [ ] Monitor logs untuk errors

---

## 📚 Related Files

- `src/app/api/telegram/link/route.ts` - Linking code generation & verification
- `src/app/api/telegram/webhook/route.ts` - Linking verification in webhook
- `src/app/settings/telegram/page.tsx` - UI untuk generate linking code
- `TELEGRAM_USER_MAPPING.md` - User mapping architecture

---

## 🆘 Troubleshooting

### Bot tidak respond ke `/link` command

**Possible causes:**
- Webhook tidak setup
- TELEGRAM_BOT_TOKEN tidak valid
- Database tables tidak ada

**Solution:**
1. Check webhook status: `/api/telegram/setup`
2. Verify TELEGRAM_BOT_TOKEN di Vercel
3. Check database tables exist

### Linking code tidak valid

**Possible causes:**
- Kode sudah expired (10 menit)
- Kode sudah digunakan
- Typo di kode

**Solution:**
1. Generate kode baru di web
2. Copy dengan hati-hati
3. Kirim dalam 10 menit

### Akun tidak muncul di web setelah linking

**Possible causes:**
- Halaman belum di-refresh
- Database query error
- User isolation issue

**Solution:**
1. Refresh halaman settings/telegram
2. Check database: `SELECT * FROM telegram_users`
3. Check user_id match

---

## 📞 Support

Jika ada masalah, check:
1. Vercel logs: `vercel logs`
2. Supabase logs: Dashboard → Logs
3. Telegram bot logs: Check console output
4. Database: Query tables directly
