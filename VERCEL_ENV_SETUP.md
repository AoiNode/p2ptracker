# Setup Environment Variables di Vercel

## 🔧 Cara Fix Error Deployment

Error: `Environment Variable "NEXT_PUBLIC_SUPABASE_URL" references Secret "supabase_url", which does not exist`

### Langkah-langkah Setup:

## 1. Login ke Vercel Dashboard
- Buka https://vercel.com/dashboard
- Pilih project `p2p-rekap-fifo-mobile`

## 2. Masuk ke Settings → Environment Variables
- Klik tab `Settings`
- Pilih `Environment Variables` di sidebar

## 3. Tambahkan Environment Variables

Tambahkan 2 variabel berikut:

### Variable 1: NEXT_PUBLIC_SUPABASE_URL
- **Key**: `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: URL Supabase Anda (contoh: `https://xyzabc.supabase.co`)
- **Environment**: ✅ Production, ✅ Preview, ✅ Development
- **Type**: Plain Text (BUKAN Secret)

### Variable 2: NEXT_PUBLIC_SUPABASE_ANON_KEY  
- **Key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value**: Anon key dari Supabase
- **Environment**: ✅ Production, ✅ Preview, ✅ Development
- **Type**: Plain Text (BUKAN Secret)

## 4. Cara Mendapatkan Values dari Supabase

1. Login ke https://app.supabase.com
2. Pilih project Anda
3. Pergi ke Settings → API
4. Copy:
   - **Project URL** → paste ke `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → paste ke `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 5. Deploy Ulang

Setelah menambahkan environment variables:
1. Klik `Save` 
2. Pergi ke tab `Deployments`
3. Klik 3 titik di deployment terakhir
4. Pilih `Redeploy`

## 📝 Catatan Penting

- Variables dengan prefix `NEXT_PUBLIC_` HARUS menggunakan type **Plain Text**, BUKAN Secret
- Jangan gunakan reference ke Secret (`@secret-name`) untuk NEXT_PUBLIC variables
- NEXT_PUBLIC variables aman untuk client-side karena memang dirancang untuk publik

## 🚨 Jika Masih Error

Cek apakah:
1. Variable names sudah benar (case sensitive)
2. Tidak ada spasi di awal/akhir values
3. URL Supabase tidak ada trailing slash di akhir
4. Anon key dicopy lengkap (biasanya panjang)

## Alternative: Setup via Vercel CLI

```bash
# Install Vercel CLI jika belum
npm i -g vercel

# Link project
vercel link

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY

# Deploy
vercel --prod
```

## Testing Locally

Untuk test local, buat file `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

Lalu jalankan:
```bash
npm run dev
```
