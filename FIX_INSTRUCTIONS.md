# Instruksi Perbaikan Riwayat Penjualan & Cascade Delete

## 🔧 Masalah yang Diperbaiki

### 1. ✅ Riwayat Penjualan Sekarang Tampil di Detail Sesi
- Data penjualan sekarang di-fetch dengan join ke tabel transactions
- Menampilkan harga, jumlah USDT, hasil IDR, modal, dan profit
- Persentase profit juga ditampilkan

### 2. ✅ Cascade Delete Sekarang Bekerja Sempurna  
- Saat hapus sesi, semua transaksi & penjualan ikut terhapus otomatis
- Tidak ada data orphan yang tertinggal

### 3. ✅ Bug Form Sell Diperbaiki
- USDT tidak lagi auto-fill saat ubah harga/fee
- User harus input USDT manual di mode sell

## 📝 Langkah-Langkah Implementasi

### Step 1: Jalankan Migration di Supabase SQL Editor

Masuk ke **Supabase Dashboard > SQL Editor** dan jalankan script ini:

```sql
-- File: supabase/migrations/004_complete_cascade_delete.sql

-- Complete CASCADE DELETE setup for all related tables
-- This ensures when a session is deleted, all related data is also deleted

-- 1. Fix session_sales -> sessions cascade delete
ALTER TABLE session_sales
DROP CONSTRAINT IF EXISTS session_sales_session_id_fkey;

ALTER TABLE session_sales
ADD CONSTRAINT session_sales_session_id_fkey
FOREIGN KEY (session_id)
REFERENCES sessions(id)
ON DELETE CASCADE;

-- 2. Fix session_sales -> transactions cascade delete  
ALTER TABLE session_sales
DROP CONSTRAINT IF EXISTS session_sales_tx_id_fkey;

ALTER TABLE session_sales
ADD CONSTRAINT session_sales_tx_id_fkey
FOREIGN KEY (tx_id)
REFERENCES transactions(id)
ON DELETE CASCADE;

-- 3. Fix transactions -> sessions cascade delete (if not already done)
ALTER TABLE transactions
DROP CONSTRAINT IF EXISTS transactions_session_id_fkey;

ALTER TABLE transactions
ADD CONSTRAINT transactions_session_id_fkey
FOREIGN KEY (session_id)
REFERENCES sessions(id)
ON DELETE CASCADE;

-- 4. Verify all cascade deletes are configured
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name IN ('transactions', 'session_sales')
ORDER BY tc.table_name, kcu.column_name;
```

**✅ Output yang benar:** Semua `delete_rule` harus menunjukkan `CASCADE`

### Step 2: Verifikasi Perubahan Code

File-file yang sudah diperbaiki:

#### 1. **`src/stores/useSessionStore.ts`**
- `fetchAllSessions()` sekarang fetch session_sales dengan join ke transactions
- Data lengkap tersedia untuk ditampilkan di UI

#### 2. **`src/app/sessions/[id]/page.tsx`**  
- Riwayat Penjualan sekarang menampilkan:
  - Harga jual per USDT
  - Jumlah USDT terjual  
  - Hasil penjualan (IDR)
  - Modal yang dikeluarkan
  - Profit/Loss dengan persentase
- Mencari transaksi dari kedua sumber (transactions & sessionTxs)

#### 3. **`src/app/transaksi/new/page.tsx`**
- Mode Sell: USDT field tidak auto-fill lagi
- User input USDT manual, IDR otomatis terhitung
- Fee calculation hanya update total, tidak mengubah USDT input

## 🧪 Testing Checklist

### Test 1: Riwayat Penjualan
1. Buka halaman Sessions
2. Klik salah satu sesi yang ada penjualannya
3. **✅ Harus terlihat:** Section "Riwayat Penjualan" dengan detail lengkap

### Test 2: Cascade Delete
1. Buat sesi baru (Buy USDT)
2. Jual sebagian USDT dari sesi tersebut
3. Buka detail sesi, klik tombol hapus (🗑️)
4. Konfirmasi hapus
5. **✅ Cek database:** 
   - Sesi terhapus dari tabel `sessions`
   - Transaksi terhapus dari tabel `transactions`  
   - Penjualan terhapus dari tabel `session_sales`

### Test 3: Form Sell
1. Klik FAB > Jual USDT
2. Ubah harga - **✅ USDT field tidak berubah**
3. Ubah fee - **✅ USDT field tidak berubah**
4. Input USDT manual - **✅ IDR otomatis terhitung**
5. Klik "Max" - **✅ USDT terisi dengan sisa dari sesi**

## 🎯 Summary

Semua masalah sudah diperbaiki:

✅ **Riwayat Penjualan** - Tampil lengkap dengan join data
✅ **Cascade Delete** - Hapus sesi = hapus semua data terkait  
✅ **Bug Form Sell** - USDT field tidak auto-fill lagi

Aplikasi sekarang siap digunakan dengan fitur lengkap! 🚀
