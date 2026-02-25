-- Script untuk Sinkronisasi Tabel Sessions dari Session Sales
-- Script ini akan menghitung ulang 'remaining_usdt', 'realized_profit_idr', dan 'status'
-- berdasarkan data 'session_sales' yang baru saja Anda import.

BEGIN;

-- Update setiap baris di tabel sessions
UPDATE sessions s
SET 
    -- 1. Hitung ulang Sisa USDT
    -- Rumus: Total Awal - Total yang sudah tercatat di session_sales
    remaining_usdt = s.total_usdt - COALESCE((
        SELECT SUM(ss.sold_usdt) 
        FROM session_sales ss 
        WHERE ss.session_id = s.id
    ), 0),
    
    -- 2. Hitung ulang Profit (supaya konsisten dengan sales yang diimport)
    realized_profit_idr = COALESCE((
        SELECT SUM(ss.profit_idr) 
        FROM session_sales ss 
        WHERE ss.session_id = s.id
    ), 0);

-- 3. Update Status Sesi (Active / Closed)
-- Jika sisa USDT mendekati 0 (kurang dari 0.01), anggap CLOSED
UPDATE sessions
SET status = CASE 
        WHEN remaining_usdt <= 0.01 THEN 'closed' 
        ELSE 'active' 
    END;

COMMIT;

-- Verifikasi Hasil: Tampilkan sesi yang masih AKTIF
-- Seharusnya hanya muncul 3 sesi terbaru sesuai keinginan Anda
SELECT id, created_at, total_usdt, remaining_usdt, status 
FROM sessions 
WHERE status = 'active'
ORDER BY created_at DESC;
