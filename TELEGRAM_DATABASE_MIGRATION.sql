-- ============================================
-- Telegram Bot Database Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create telegram_linking_codes table
CREATE TABLE IF NOT EXISTS public.telegram_linking_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_telegram_linking_codes_code 
  ON public.telegram_linking_codes(code);

CREATE INDEX IF NOT EXISTS idx_telegram_linking_codes_user_id 
  ON public.telegram_linking_codes(user_id);

CREATE INDEX IF NOT EXISTS idx_telegram_linking_codes_expires_at 
  ON public.telegram_linking_codes(expires_at);

-- ============================================

-- 2. Create telegram_users table
CREATE TABLE IF NOT EXISTS public.telegram_users (
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

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_telegram_users_user_id 
  ON public.telegram_users(user_id);

CREATE INDEX IF NOT EXISTS idx_telegram_users_telegram_id 
  ON public.telegram_users(telegram_user_id);

CREATE INDEX IF NOT EXISTS idx_telegram_users_connected_at 
  ON public.telegram_users(connected_at);

-- ============================================

-- 3. Enable RLS (Row Level Security) for security
ALTER TABLE public.telegram_linking_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;

-- ============================================

-- 4. Create RLS Policies for telegram_linking_codes
-- Users can only see their own linking codes
CREATE POLICY "Users can view their own linking codes"
  ON public.telegram_linking_codes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create linking codes"
  ON public.telegram_linking_codes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own linking codes"
  ON public.telegram_linking_codes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can do everything (for webhook)
CREATE POLICY "Service role can access all linking codes"
  ON public.telegram_linking_codes
  USING (current_setting('role') = 'authenticated' OR current_setting('role') = 'service_role');

-- ============================================

-- 5. Create RLS Policies for telegram_users
-- Users can only see their own telegram account
CREATE POLICY "Users can view their own telegram account"
  ON public.telegram_users
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create telegram account"
  ON public.telegram_users
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own telegram account"
  ON public.telegram_users
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own telegram account"
  ON public.telegram_users
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can do everything (for webhook)
CREATE POLICY "Service role can access all telegram users"
  ON public.telegram_users
  USING (current_setting('role') = 'authenticated' OR current_setting('role') = 'service_role');

-- ============================================

-- 6. Verify tables were created
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('telegram_linking_codes', 'telegram_users')
ORDER BY table_name, ordinal_position;

-- ============================================
-- DONE! Tables are ready to use
-- ============================================
