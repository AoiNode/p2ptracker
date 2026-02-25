-- Add label column to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS label TEXT DEFAULT 'Binance';

-- Add check constraint to ensure valid exchange labels
ALTER TABLE transactions
ADD CONSTRAINT valid_exchange_label CHECK (
  label IN ('Binance', 'Bybit', 'OKX', 'Bitget', 'Tokocrypto', 'Other')
);

-- Update existing transactions to have default label
UPDATE transactions
SET label = 'Binance'
WHERE label IS NULL;
