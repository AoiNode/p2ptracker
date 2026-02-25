-- Script untuk menonaktifkan sesi spesifik cfcdb1c0-43c2-442b-9788-728c5166f1e3
-- User melaporkan sesi ini seharusnya sudah habis tapi masih terdeteksi full.
-- FIX: Menghapus update kolom 'notes' karena kolom tersebut tidak ada di tabel sessions.

BEGIN;

UPDATE sessions
SET 
    remaining_usdt = 0,      -- Set sisa saldo ke 0 agar tidak dipakai lagi
    status = 'closed'        -- Set status ke closed
WHERE id = 'cfcdb1c0-43c2-442b-9788-728c5166f1e3';

COMMIT;

-- Verifikasi hasil
SELECT id, total_usdt, remaining_usdt, status
FROM sessions
WHERE id = 'cfcdb1c0-43c2-442b-9788-728c5166f1e3';
