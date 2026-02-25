-- Auto delete SELL transactions when session is deleted
-- This ensures no orphaned sell transactions remain in the transactions table

-- Create function to delete related sell transactions
CREATE OR REPLACE FUNCTION delete_related_sell_transactions()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete all transactions that are referenced by session_sales for this session
  DELETE FROM transactions
  WHERE id IN (
    SELECT tx_id 
    FROM session_sales 
    WHERE session_id = OLD.id
  );
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_delete_sell_transactions ON sessions;

-- Create trigger that fires BEFORE delete on sessions
-- Using BEFORE instead of AFTER to ensure proper deletion order
CREATE TRIGGER trg_delete_sell_transactions
BEFORE DELETE ON sessions
FOR EACH ROW
EXECUTE FUNCTION delete_related_sell_transactions();

-- Alternative: If you also want to clean up orphaned transactions 
-- that might already exist in your database, run this:
/*
DELETE FROM transactions
WHERE type = 'SELL' 
AND id NOT IN (
  SELECT tx_id FROM session_sales WHERE tx_id IS NOT NULL
);
*/

-- Verify the trigger is created
SELECT 
  tgname AS trigger_name,
  tgrelid::regclass AS table_name,
  proname AS function_name,
  tgtype AS trigger_type
FROM pg_trigger
JOIN pg_proc ON pg_proc.oid = pg_trigger.tgfoid
WHERE tgrelid = 'sessions'::regclass;
