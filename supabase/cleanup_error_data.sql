-- Script untuk menghapus data error "auto-sync from sales Jan 2026"
-- Data ini memiliki IDR 0 dan Profit 0, tapi memakan saldo USDT.

BEGIN;

-- 1. (Safety Net) Restore Saldo Sesi JIKA tidak ada data di session_sales
-- Ini untuk jaga-jaga jika transaksi error ini punya session_id tapi tidak punya session_sales
UPDATE sessions s
SET remaining_usdt = s.remaining_usdt + t.amount_usdt,
    status = 'active'
FROM transactions t
WHERE t.session_id = s.id
  AND t.type = 'SELL'
  AND t.total_idr = 0
  AND (t.notes ILIKE '%auto-sync from sales Jan 2026%' OR t.notes ILIKE '%auto-sync%')
  AND NOT EXISTS (SELECT 1 FROM session_sales ss WHERE ss.tx_id = t.id);

-- 2. Hapus Transaksi Error
-- Kriteria: Tipe SELL, Total IDR 0, dan Notes mengandung 'auto-sync'
-- Jika ada data di 'session_sales', trigger 'trg_restore_session_on_sale_delete' 
-- akan otomatis berjalan dan mengembalikan saldo.
DELETE FROM transactions 
WHERE type = 'SELL' 
  AND total_idr = 0
  AND (
      notes ILIKE '%auto-sync from sales Jan 2026%' 
      OR notes ILIKE '%auto-sync%'
  );

COMMIT;

-- Verifikasi hasil (seharusnya 0 baris)
SELECT * FROM transactions 
WHERE type = 'SELL' 
  AND total_idr = 0
  AND notes ILIKE '%auto-sync%';
