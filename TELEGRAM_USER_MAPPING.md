# Telegram User Mapping

## Database Schema

Tambahkan tabel baru di Supabase untuk mapping Telegram user dengan web user:

```sql
-- Create telegram_users table
CREATE TABLE telegram_users (
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

-- Create index for faster lookups
CREATE INDEX idx_telegram_users_user_id ON telegram_users(user_id);
CREATE INDEX idx_telegram_users_telegram_id ON telegram_users(telegram_user_id);
```

## How It Works

### Flow 1: Web User Links Telegram Account

1. User login ke web dengan akun Supabase
2. User buka Settings → Telegram Bot
3. User klik "Link Telegram Account"
4. Generate unique code/link
5. User kirim code ke Telegram bot
6. Bot verifikasi code dan link akun
7. Simpan mapping di `telegram_users` table

### Flow 2: Telegram User Sends Command

1. Telegram user kirim command ke bot
2. Bot terima message dengan `telegram_user_id`
3. Bot query `telegram_users` table untuk cari `user_id`
4. Bot gunakan `user_id` untuk save transaction ke database
5. Data muncul di web user yang sesuai

## Implementation Steps

### Step 1: Create Migration

```sql
-- Run di Supabase SQL Editor
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

### Step 2: Update Webhook Endpoint

```typescript
// src/app/api/telegram/webhook/route.ts

// Query telegram_users table
const { data: telegramUser } = await supabase
  .from('telegram_users')
  .select('user_id')
  .eq('telegram_user_id', userId)
  .single();

if (!telegramUser) {
  // User belum link akun
  await sendTelegramMessage(chatId, '❌ Akun Telegram belum terhubung dengan web');
  return;
}

// Gunakan user_id dari mapping
const webUserId = telegramUser.user_id;

// Save transaction dengan user_id yang benar
await supabase.from('transactions').insert({
  user_id: webUserId,
  ...transactionData
});
```

### Step 3: Update Settings Page

```typescript
// src/app/settings/telegram/page.tsx

// Show linked Telegram account
// Show button to link/unlink account
// Show linking code for user to send to bot
```

## Linking Flow

### Option 1: Manual Code Entry

1. User di web generate code (random 6 digit)
2. User kirim code ke Telegram bot: `/link 123456`
3. Bot verifikasi code dan link akun
4. Mapping disimpan di database

### Option 2: QR Code

1. User di web generate QR code dengan user_id
2. User scan QR dengan Telegram bot
3. Bot parse QR dan link akun
4. Mapping disimpan

### Option 3: Direct Link

1. User klik "Link Telegram" di web
2. Redirect ke Telegram bot dengan deep link
3. Bot auto-link akun
4. Mapping disimpan

## Security Considerations

- ✅ Verify user ownership (user harus confirm di Telegram)
- ✅ One Telegram account per web user
- ✅ User isolation (each user only sees their data)
- ✅ Revoke access (user bisa unlink anytime)
- ✅ Audit trail (track linking/unlinking)

## Database Queries

### Link Account

```sql
INSERT INTO telegram_users (user_id, telegram_user_id, telegram_username, telegram_first_name)
VALUES ($1, $2, $3, $4)
ON CONFLICT (telegram_user_id) DO UPDATE SET
  user_id = $1,
  telegram_username = $3,
  telegram_first_name = $4,
  updated_at = NOW();
```

### Get Web User from Telegram ID

```sql
SELECT user_id FROM telegram_users
WHERE telegram_user_id = $1;
```

### Unlink Account

```sql
DELETE FROM telegram_users
WHERE user_id = $1 AND telegram_user_id = $2;
```

### Get Telegram Info for Web User

```sql
SELECT telegram_user_id, telegram_username, telegram_first_name, connected_at
FROM telegram_users
WHERE user_id = $1;
```

## Testing

### Test Linking

```bash
# 1. Get user_id from web login
# 2. Send to Telegram bot: /link {user_id}
# 3. Bot verifies and links
# 4. Check telegram_users table
```

### Test Transaction

```bash
# 1. Link account
# 2. Send command: buy $50 16750 binance
# 3. Check transactions table - should have correct user_id
# 4. Verify data appears in web for that user
```

## Rollback

```sql
DROP TABLE IF EXISTS telegram_users;
```
