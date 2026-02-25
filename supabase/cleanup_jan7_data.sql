-- Script untuk menghapus data transaksi tanggal 7 Januari 2025
-- Jalankan script ini di Supabase SQL Editor

BEGIN;

-- 1. Hapus transaksi PENJUALAN (SELL) tanggal 7 Jan 2025
-- Trigger 'trg_restore_session_on_sale_delete' yang baru kita buat
-- akan otomatis berjalan dan mengembalikan saldo ke sesi yang bersangkutan.
DELETE FROM transactions 
WHERE type = 'SELL' 
AND (tx_time AT TIME ZONE 'Asia/Jakarta')::date = '2025-01-07';

-- 2. Hapus SESI (dan otomatis BUY) yang dibuat tanggal 7 Jan 2025
-- Karena setiap BUY membuat Session baru, kita hapus dari tabel sessions.
-- Transaksi BUY akan otomatis terhapus karena CASCADE.
-- Transaksi SELL yang terkait dengan sesi ini juga akan terhapus otomatis (via trigger 005).
DELETE FROM sessions 
WHERE (created_at AT TIME ZONE 'Asia/Jakarta')::date = '2025-01-07';

COMMIT;

-- Cek hasil penghapusan
SELECT count(*) as sisa_transaksi_jan7 
FROM transactions 
WHERE (tx_time AT TIME ZONE 'Asia/Jakarta')::date = '2025-01-07';
