-- DANGER: SCRIPT INI MENGHAPUS SEMUA DATA TRANSAKSI & SESI
-- Gunakan script ini HANYA jika Anda ingin membersihkan database sebelum restore backup CSV.

BEGIN;

-- 1. Matikan trigger sementara agar penghapusan lebih cepat dan tidak error
ALTER TABLE sessions DISABLE TRIGGER ALL;
ALTER TABLE transactions DISABLE TRIGGER ALL;
ALTER TABLE session_sales DISABLE TRIGGER ALL;

-- 2. Hapus data dari tabel anak (child) dulu
TRUNCATE TABLE session_sales CASCADE;

-- 3. Hapus data dari tabel utama
TRUNCATE TABLE transactions CASCADE;
TRUNCATE TABLE sessions CASCADE;

-- 4. Aktifkan kembali trigger
ALTER TABLE sessions ENABLE TRIGGER ALL;
ALTER TABLE transactions ENABLE TRIGGER ALL;
ALTER TABLE session_sales ENABLE TRIGGER ALL;

COMMIT;

-- Verifikasi data sudah kosong
SELECT count(*) as total_sessions FROM sessions;
SELECT count(*) as total_transactions FROM transactions;
SELECT count(*) as total_sales FROM session_sales;
