-- Add price_idr column to sessions table for smart merging
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS price_idr DECIMAL(10, 2);

-- Update existing sessions with their average cost as price (if needed)
UPDATE sessions 
SET price_idr = avg_cost 
WHERE price_idr IS NULL;

-- Make price_idr NOT NULL after updating existing rows
ALTER TABLE sessions 
ALTER COLUMN price_idr SET NOT NULL;

-- Add index for faster lookup by price and remaining USDT
CREATE INDEX IF NOT EXISTS idx_sessions_price_remaining 
ON sessions(price_idr, remaining_usdt) 
WHERE remaining_usdt > 0;

-- Add index for session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_status_remaining 
ON sessions(status, remaining_usdt) 
WHERE status = 'active';
