-- Apply CASCADE DELETE to ensure all transactions are deleted when a session is deleted
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- Step 1: Drop existing foreign key constraints
DO $$ 
DECLARE
    constraint_name_var text;
BEGIN
    -- Find and drop the existing foreign key constraint for session_id
    SELECT conname INTO constraint_name_var
    FROM pg_constraint 
    WHERE conrelid = 'transactions'::regclass 
    AND confrelid = 'sessions'::regclass
    AND contype = 'f'
    LIMIT 1;
    
    IF constraint_name_var IS NOT NULL THEN
        EXECUTE 'ALTER TABLE transactions DROP CONSTRAINT ' || constraint_name_var;
        RAISE NOTICE 'Dropped constraint: %', constraint_name_var;
    END IF;
END $$;

-- Step 2: Add the foreign key with CASCADE DELETE
ALTER TABLE transactions 
ADD CONSTRAINT transactions_session_id_fkey 
FOREIGN KEY (session_id) 
REFERENCES sessions(id) 
ON DELETE CASCADE;

-- Step 3: Verify the cascade delete is configured
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'transactions'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'session_id';

-- The result should show delete_rule = 'CASCADE'
-- This means when a session is deleted, all its transactions will be automatically deleted
