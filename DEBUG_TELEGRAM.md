# Telegram Linking Debug Guide

## 🔍 Step-by-Step Debugging

### STEP 1: Verify Database Tables Exist

Jalankan di Supabase SQL Editor:

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('telegram_linking_codes', 'telegram_users');
```

**Expected Result:**
```
table_name
─────────────────────────
telegram_linking_codes
telegram_users
```

**If empty:** Tables tidak ada, run migration lagi

---

### STEP 2: Check RLS Policies

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('telegram_linking_codes', 'telegram_users');
```

**Expected Result:**
```
tablename                 | rowsecurity
──────────────────────────┼────────────
telegram_linking_codes    | t
telegram_users            | t
```

**If rowsecurity = f:** RLS tidak enabled, run:
```sql
ALTER TABLE public.telegram_linking_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;
```

---

### STEP 3: Test Insert Linking Code

```sql
-- Get your user_id (replace with your actual user_id)
SELECT id FROM auth.users LIMIT 1;

-- Insert test linking code (replace USER_ID)
INSERT INTO public.telegram_linking_codes (user_id, code, expires_at)
VALUES ('USER_ID', 'TEST123', NOW() + INTERVAL '10 minutes');

-- Verify it was inserted
SELECT * FROM public.telegram_linking_codes WHERE code = 'TEST123';
```

**Expected Result:**
```
id | user_id | code | expires_at | created_at
──┼─────────┼──────┼────────────┼───────────
  | USER_ID | TEST123 | ...    | ...
```

**If error:** Check RLS policies

---

### STEP 4: Test Service Role Access

Masalah paling umum: **Service role tidak bisa access tables karena RLS policy**

```sql
-- Check current policies
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename IN ('telegram_linking_codes', 'telegram_users');
```

**If policies ada tapi service_role tidak listed:** Itu masalahnya!

**Solution:** Update policies untuk allow service role:

```sql
-- Drop old policies
DROP POLICY IF EXISTS "Service role can access all linking codes" ON public.telegram_linking_codes;
DROP POLICY IF EXISTS "Service role can access all telegram users" ON public.telegram_users;

-- Create new policies that allow service role
CREATE POLICY "Allow service role full access"
  ON public.telegram_linking_codes
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access"
  ON public.telegram_users
  USING (true)
  WITH CHECK (true);
```

---

### STEP 5: Check Vercel Logs

```bash
# See real-time logs
vercel logs --follow

# Or check specific deployment
vercel logs [deployment-id]
```

**Look for errors like:**
- "Missing Supabase environment variables"
- "supabaseKey is required"
- "Permission denied"
- "relation does not exist"

---

### STEP 6: Test Webhook Manually

Buka Supabase SQL Editor dan jalankan:

```sql
-- Simulate what bot does when user sends /link TEST123

-- 1. Find linking code
SELECT user_id, expires_at FROM public.telegram_linking_codes
WHERE code = 'TEST123' AND expires_at > NOW();

-- 2. If found, insert to telegram_users
INSERT INTO public.telegram_users (
  user_id, 
  telegram_user_id, 
  telegram_username, 
  telegram_first_name, 
  connected_at
) VALUES (
  'USER_ID',  -- from linking code
  123456789,  -- telegram user id
  'testuser',
  'Test User',
  NOW()
);

-- 3. Verify insert
SELECT * FROM public.telegram_users WHERE telegram_user_id = 123456789;

-- 4. Delete linking code
DELETE FROM public.telegram_linking_codes WHERE code = 'TEST123';
```

---

## 🔧 Common Issues & Solutions

### Issue 1: "Permission denied" Error

**Cause:** RLS policies blocking service role

**Solution:**
```sql
-- Fix RLS policies
DROP POLICY IF EXISTS "Allow service role full access" ON public.telegram_linking_codes;
DROP POLICY IF EXISTS "Allow service role full access" ON public.telegram_users;

-- Create permissive policies
CREATE POLICY "Allow all access"
  ON public.telegram_linking_codes
  AS PERMISSIVE
  FOR ALL
  USING (true);

CREATE POLICY "Allow all access"
  ON public.telegram_users
  AS PERMISSIVE
  FOR ALL
  USING (true);
```

### Issue 2: "Relation does not exist" Error

**Cause:** Tables tidak ada

**Solution:**
1. Run `TELEGRAM_DATABASE_MIGRATION.sql` lagi
2. Verify tables exist dengan STEP 1

### Issue 3: Bot tidak respond tapi tidak ada error

**Cause:** Webhook tidak setup atau bot token invalid

**Solution:**
1. Buka `/api/telegram/setup`
2. Verify webhook status: Active ✅
3. Verify bot token di Vercel env vars

### Issue 4: Linking code tidak ditemukan

**Cause:** Code sudah expired atau typo

**Solution:**
1. Generate code baru (valid 10 menit)
2. Copy dengan hati-hati
3. Send dalam 10 menit

---

## 📊 Full Debug Checklist

- [ ] **Tables Exist**
  ```sql
  SELECT * FROM information_schema.tables 
  WHERE table_name IN ('telegram_linking_codes', 'telegram_users');
  ```

- [ ] **RLS Enabled**
  ```sql
  SELECT tablename, rowsecurity FROM pg_tables 
  WHERE tablename IN ('telegram_linking_codes', 'telegram_users');
  ```

- [ ] **RLS Policies Allow Service Role**
  ```sql
  SELECT * FROM pg_policies 
  WHERE tablename IN ('telegram_linking_codes', 'telegram_users');
  ```

- [ ] **Can Insert Data**
  ```sql
  INSERT INTO public.telegram_linking_codes (user_id, code, expires_at)
  VALUES ('test-user-id', 'TEST123', NOW() + INTERVAL '10 minutes');
  ```

- [ ] **Webhook Setup**
  - Buka `/api/telegram/setup`
  - Status: Active ✅

- [ ] **Environment Variables**
  - `TELEGRAM_BOT_TOKEN` ✅
  - `NEXT_PUBLIC_SUPABASE_URL` ✅
  - `SUPABASE_SERVICE_ROLE_KEY` ✅

- [ ] **Vercel Logs**
  - `vercel logs --follow`
  - No errors ✅

---

## 🆘 If Still Not Working

1. **Check Vercel Logs**
   ```
   vercel logs --follow
   ```
   Kirim `/link CODE` ke bot dan lihat error di logs

2. **Check Supabase Logs**
   - Dashboard → Logs
   - Look for database errors

3. **Test Manually**
   - Run SQL queries di Supabase
   - Verify data can be inserted

4. **Check Bot Token**
   - Verify token valid di @BotFather
   - Verify token di Vercel matches

5. **Check Webhook**
   - Buka `/api/telegram/setup`
   - Verify webhook active
   - Check webhook URL correct

---

## 📝 Sample Working Flow

```
1. Generate code di web
   ✅ Code: ABC123 stored di telegram_linking_codes

2. Send /link ABC123 di Telegram
   ✅ Bot receives message

3. Bot queries telegram_linking_codes
   ✅ Finds code ABC123

4. Bot inserts to telegram_users
   ✅ Account linked

5. Bot deletes linking code
   ✅ Code removed

6. Bot sends confirmation
   ✅ User sees "✅ Akun Terhubung"

7. Refresh web
   ✅ Shows linked account info
```

---

## 💡 Pro Tips

1. **Always check Vercel logs first**
   - Most errors logged there

2. **Test SQL queries manually**
   - Verify database works

3. **Check RLS policies**
   - Most common issue

4. **Verify environment variables**
   - Must match exactly

5. **Redeploy after changes**
   - Changes need to be deployed

---

**Good luck! Let me know what error you see in Vercel logs! 🚀**
