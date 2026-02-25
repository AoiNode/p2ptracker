# Migration Guide: FIFO to Session-Based Model

## 🚀 Quick Start

### 1. Run Database Migration
Copy and execute the SQL script from `/supabase/migrations/001_session_model.sql` in your Supabase SQL Editor:
1. Go to Supabase Dashboard → SQL Editor
2. Create a new query
3. Paste the entire migration script
4. Click "Run"

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Start Development Server
```bash
pnpm dev
```

## 📋 What Changed?

### Database Changes
- **New Tables:**
  - `sessions` - Stores investment batches
  - `session_sales` - Links sales to sessions
- **Modified Tables:**
  - `transactions` - Added `session_id` column

### Code Changes
- **New Files:**
  - `/src/stores/useSessionStore.ts` - Session-based state management
  - `/src/lib/sessionManager.ts` - Session business logic
  - `/src/app/sessions/page.tsx` - Session overview page
- **Updated Files:**
  - All pages now use `useSessionStore` instead of `useTransactionStore`
  - Transaction form has session selector for SELL operations

## 🔄 How It Works Now

### Adding a BUY Transaction
1. User clicks FAB → Buy button
2. Enters price and total IDR
3. System creates a new session automatically
4. Each BUY = one independent investment batch

### Adding a SELL Transaction
1. User clicks FAB → Sell button
2. **NEW:** Must select which session to sell from
3. Enters USDT amount to sell (max = session's remaining USDT)
4. System calculates profit for that specific session only

### Profit Calculation
- Per-session profit tracking
- No more global FIFO queue
- Each session has independent ROI
- Monthly profit = sum of all session profits in current month

## 🎯 Benefits

1. **Clear Investment Tracking**: Each capital injection is tracked separately
2. **Flexible Selling**: Choose which investment batch to liquidate
3. **Better ROI Analysis**: See performance per investment batch
4. **Session Management**: View all active/closed sessions at `/sessions`

## ⚠️ Important Notes

1. **Existing Data**: Old FIFO data (buy_lots, lot_matches) remains but is not used
2. **Session Required**: SELL transactions now require selecting a session
3. **No Migration of Old Data**: Start fresh with new session model

## 🧪 Testing

### Test Scenario 1: Basic Flow
1. Add BUY: Rp 16,700/USDT, Total Rp 10,000,000
2. Check `/sessions` - should see 1 active session
3. Add SELL: Select session, sell 100 USDT
4. Check session remaining USDT decreased
5. View profit in dashboard

### Test Scenario 2: Multiple Sessions
1. Add BUY #1: Rp 16,500/USDT, Total Rp 5,000,000
2. Add BUY #2: Rp 16,800/USDT, Total Rp 7,000,000
3. Check `/sessions` - should see 2 active sessions
4. Add SELL: Choose session #1, sell 50 USDT
5. Verify only session #1's remaining USDT decreased

## 🐛 Troubleshooting

### Error: "Tidak ada sesi aktif"
- You need to add a BUY transaction first
- Each BUY creates a new session

### Error: "Insufficient USDT in session"
- Check session's remaining USDT
- Cannot sell more than available in selected session

### TypeScript Errors
- Run `pnpm install` to install all dependencies
- Restart dev server after installation

## 📱 UI Navigation

The app now has 5 navigation tabs:
1. **Beranda** - Dashboard with profit summary
2. **Transaksi** - Transaction list with session info
3. **Sesi** - NEW! View all investment sessions
4. **Statistik** - Charts with daily buy/sell/profit
5. **Settings** - App settings

## ✅ Success Indicators

You'll know the migration is successful when:
1. Database has `sessions` and `session_sales` tables
2. Adding BUY creates a new session in `/sessions`
3. SELL form shows session selector dropdown
4. Dashboard shows correct profit calculations
5. No console errors in browser
