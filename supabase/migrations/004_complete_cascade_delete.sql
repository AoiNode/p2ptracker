-- Complete CASCADE DELETE setup for all related tables
-- This ensures when a session is deleted, all related data is also deleted

-- 1. Fix session_sales -> sessions cascade delete
ALTER TABLE session_sales
DROP CONSTRAINT IF EXISTS session_sales_session_id_fkey;

ALTER TABLE session_sales
ADD CONSTRAINT session_sales_session_id_fkey
FOREIGN KEY (session_id)
REFERENCES sessions(id)
ON DELETE CASCADE;

-- 2. Fix session_sales -> transactions cascade delete  
ALTER TABLE session_sales
DROP CONSTRAINT IF EXISTS session_sales_tx_id_fkey;

ALTER TABLE session_sales
ADD CONSTRAINT session_sales_tx_id_fkey
FOREIGN KEY (tx_id)
REFERENCES transactions(id)
ON DELETE CASCADE;

-- 3. Fix transactions -> sessions cascade delete (if not already done)
ALTER TABLE transactions
DROP CONSTRAINT IF EXISTS transactions_session_id_fkey;

ALTER TABLE transactions
ADD CONSTRAINT transactions_session_id_fkey
FOREIGN KEY (session_id)
REFERENCES sessions(id)
ON DELETE CASCADE;

-- 4. Verify all cascade deletes are configured
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name IN ('transactions', 'session_sales')
ORDER BY tc.table_name, kcu.column_name;

-- All delete_rule values should show 'CASCADE'
