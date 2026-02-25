-- Script Otomatis: Generate Session Sales & Normalkan Website
-- Jalankan ini untuk mengisi tabel session_sales yang kosong dan memperbaiki status sesi

DO $$
DECLARE
    -- Variabel untuk loop transaksi SELL
    sell_rec RECORD;
    
    -- Variabel untuk loop sesi (FIFO)
    session_rec RECORD;
    
    -- Variabel hitungan
    remaining_sell_amount numeric;
    sell_amount_for_session numeric;
    current_proceeds numeric;
    current_cost numeric;
    current_profit numeric;
    fee_portion numeric;
    proportion numeric;
    
    count_sales_created integer := 0;
    
BEGIN
    RAISE NOTICE '=== MEMULAI PROSES NORMALISASI DATA ===';

    -- 1. RESET ULANG SEMUA SESI KE KONDISI AWAL (PENUH)
    -- Ini penting agar kalkulasi dimulai dari nol dan akurat
    UPDATE sessions 
    SET 
        remaining_usdt = total_usdt,
        realized_profit_idr = 0,
        status = 'active';
        
    RAISE NOTICE 'Sesi di-reset. Mulai alokasi penjualan...';

    -- 2. HAPUS DATA SESSION_SALES JIKA ADA (Supaya bersih)
    DELETE FROM session_sales;

    -- 3. PROSES SETIAP TRANSAKSI SELL (Urut dari terlama ke terbaru)
    FOR sell_rec IN 
        SELECT * FROM transactions 
        WHERE type = 'SELL' 
        ORDER BY tx_time ASC 
    LOOP
        remaining_sell_amount := sell_rec.amount_usdt;
        
        -- Cari sesi yang tersedia (FIFO: terlama dulu) yang masih punya saldo
        FOR session_rec IN 
            SELECT * FROM sessions 
            WHERE remaining_usdt > 0.0001 
            ORDER BY created_at ASC 
        LOOP
            -- Jika penjualan sudah dialokasikan semua, berhenti cari sesi
            IF remaining_sell_amount <= 0.0001 THEN
                EXIT;
            END IF;
            
            -- Hitung berapa yang bisa diambil dari sesi ini
            sell_amount_for_session := LEAST(remaining_sell_amount, session_rec.remaining_usdt);
            
            -- Hitung Proporsi untuk Fee (jika ada fee di transaksi sell)
            proportion := sell_amount_for_session / sell_rec.amount_usdt;
            fee_portion := COALESCE(sell_rec.fee_idr, 0) * proportion;
            
            -- Hitung Angka Finansial
            -- Proceeds (Hasil Bersih) = (Jumlah * Harga Jual) - Fee Porsi
            current_proceeds := (sell_amount_for_session * sell_rec.price_idr) - fee_portion;
            
            -- Cost (Modal) = Jumlah * Harga Rata-rata Sesi
            current_cost := sell_amount_for_session * session_rec.avg_cost;
            
            -- Profit = Hasil Bersih - Modal
            current_profit := current_proceeds - current_cost;

            -- Masukkan ke tabel session_sales
            INSERT INTO session_sales (
                session_id, 
                tx_id, 
                sold_usdt, 
                proceeds_idr, 
                cost_idr, 
                profit_idr, 
                created_at
            ) VALUES (
                session_rec.id, 
                sell_rec.id, 
                sell_amount_for_session, 
                current_proceeds, 
                current_cost, 
                current_profit, 
                sell_rec.tx_time
            );
            
            count_sales_created := count_sales_created + 1;

            -- Update Sesi (Kurangi Saldo & Tambah Profit)
            UPDATE sessions
            SET 
                remaining_usdt = remaining_usdt - sell_amount_for_session,
                realized_profit_idr = realized_profit_idr + current_profit,
                status = CASE WHEN (remaining_usdt - sell_amount_for_session) <= 0.0001 THEN 'closed' ELSE 'active' END
            WHERE id = session_rec.id;
            
            -- Kurangi sisa yang perlu dijual
            remaining_sell_amount := remaining_sell_amount - sell_amount_for_session;
            
            -- Update variable session local untuk iterasi berikutnya (jika masih dalam loop yang sama)
            -- (Sebenarnya tidak perlu update record local karena kita select ulang di loop, tapi logic sudah benar)
            
        END LOOP;
        
        -- Warning jika masih ada sisa (berarti sesi kurang)
        IF remaining_sell_amount > 0.0001 THEN
            RAISE NOTICE 'Warning: Transaksi SELL ID % menyisakan % USDT tak teralokasi (Sesi habis)', sell_rec.id, remaining_sell_amount;
        END IF;
        
    END LOOP;
    
    RAISE NOTICE '=== SELESAI! % data penjualan berhasil dibuat ===', count_sales_created;
END $$;
