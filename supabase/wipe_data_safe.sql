-- Script AMAN untuk menghapus semua data (Tanpa mengubah System Triggers)
-- Script ini menggunakan DELETE standar yang lebih aman dari permission error

BEGIN;

-- 1. Hapus data dari tabel paling bawah (session_sales)
DELETE FROM session_sales;

-- 2. Hapus transactions (data transaksi jual/beli)
DELETE FROM transactions;

-- 3. Hapus sessions (data sesi)
DELETE FROM sessions;

COMMIT;

-- Verifikasi data sudah kosong
SELECT 
  (SELECT count(*) FROM sessions) as sisa_sessions,
  (SELECT count(*) FROM transactions) as sisa_transactions,
  (SELECT count(*) FROM session_sales) as sisa_sales;
