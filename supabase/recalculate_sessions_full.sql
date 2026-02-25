-- Script untuk MEREKALKULASI ULANG seluruh data Sesi
-- Script ini akan memperbaiki:
-- 1. Total Investasi & USDT (berdasarkan transaksi BUY)
-- 2. Remaining USDT (berdasarkan transaksi BUY dikurangi SALES)
-- 3. Realized Profit (berdasarkan data session_sales)
-- 4. Status Sesi (Active/Closed) - Sesi akan aktif kembali jika ada sisa USDT

DO $$
DECLARE
    s_rec RECORD;
    t_buy_usdt numeric;
    t_buy_invest numeric;
    t_sold_usdt numeric;
    t_profit_idr numeric;
    final_remaining numeric;
    count_updated integer := 0;
BEGIN
    RAISE NOTICE 'Mulai rekalkulasi sesi...';

    FOR s_rec IN SELECT * FROM sessions LOOP
        -- 1. Hitung total dari transaksi BUY yang ada
        SELECT 
            COALESCE(SUM(amount_usdt), 0),
            COALESCE(SUM(total_idr), 0)
        INTO t_buy_usdt, t_buy_invest
        FROM transactions 
        WHERE session_id = s_rec.id AND type = 'BUY';
        
        -- Jika tidak ada transaksi BUY (mungkin terhapus), gunakan data lama session sebagai fallback
        -- agar sesi tidak menjadi 0 totalnya (safety net)
        IF t_buy_usdt = 0 THEN
            t_buy_usdt := s_rec.total_usdt;
            t_buy_invest := s_rec.total_invest_idr;
        END IF;

        -- 2. Hitung total PENJUALAN dari session_sales
        SELECT 
            COALESCE(SUM(sold_usdt), 0),
            COALESCE(SUM(profit_idr), 0)
        INTO t_sold_usdt, t_profit_idr
        FROM session_sales 
        WHERE session_id = s_rec.id;

        -- 3. Hitung sisa USDT
        final_remaining := t_buy_usdt - t_sold_usdt;
        
        -- Pastikan tidak negatif (safety)
        IF final_remaining < 0 THEN
            final_remaining := 0;
        END IF;

        -- 4. Update Sesi dengan data yang dikalkulasi ulang
        UPDATE sessions
        SET 
            total_usdt = t_buy_usdt,
            total_invest_idr = t_buy_invest,
            avg_cost = CASE WHEN t_buy_usdt > 0 THEN t_buy_invest / t_buy_usdt ELSE 0 END,
            remaining_usdt = final_remaining,
            realized_profit_idr = t_profit_idr,
            -- Jika sisa USDT > 0.001 (toleransi desimal), set status ACTIVE
            status = CASE WHEN final_remaining > 0.001 THEN 'active' ELSE 'closed' END
        WHERE id = s_rec.id;
        
        count_updated := count_updated + 1;
    END LOOP;
    
    RAISE NOTICE 'Selesai! % sesi telah direkalkulasi.', count_updated;
END $$;
