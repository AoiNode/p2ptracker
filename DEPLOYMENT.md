# 🚀 Deployment Guide for Vercel

This guide will help you deploy the P2P Tracker app to Vercel.

## Prerequisites
- GitHub account with the repository
- Vercel account (free tier is sufficient)
- Supabase project with database setup

## Step-by-Step Deployment

### 1. Prepare Supabase Database

First, run all migrations in your Supabase project:

1. Go to Supabase Dashboard → SQL Editor
2. Run each migration file in order from `/supabase/migrations/`:
   - `001_initial_schema.sql`
   - `002_session_model.sql`
   - `003_session_cascade_delete.sql`
   - `004_user_settings.sql`
   - `005_auto_delete_sell_transactions.sql`

### 2. Get Supabase Credentials

1. Go to Supabase Dashboard → Settings → API
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon/Public Key**: `eyJhbGc...` (long string)

### 3. Deploy to Vercel

#### Option A: Deploy via Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository: `ZKSystemId/p2ptracker`
4. Configure Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL = [Your Supabase URL]
   NEXT_PUBLIC_SUPABASE_ANON_KEY = [Your Anon Key]
   ```
5. Click "Deploy"

#### Option B: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Run deployment:
   ```bash
   vercel
   ```

3. Follow the prompts:
   - Link to existing project or create new
   - Select the repository
   - Add environment variables when prompted

### 4. Environment Variables Setup

Add these environment variables in Vercel Dashboard → Settings → Environment Variables:

| Variable Name | Value | Required |
|--------------|-------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | ✅ |

### 5. Configure Domain (Optional)

1. Go to Vercel Dashboard → Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

### 6. Post-Deployment Setup

After successful deployment:

1. **Test PWA Installation**:
   - Visit your deployed site on mobile
   - Look for install prompt or use browser menu

2. **Enable RLS (Row Level Security) in Supabase**:
   ```sql
   -- Enable RLS on all tables
   ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
   ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
   ALTER TABLE session_sales ENABLE ROW LEVEL SECURITY;
   ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
   
   -- Create policies for authenticated users
   CREATE POLICY "Users can view own transactions" ON transactions
     FOR ALL USING (auth.uid() = user_id);
   
   CREATE POLICY "Users can view own sessions" ON sessions
     FOR ALL USING (auth.uid() = user_id);
   
   CREATE POLICY "Users can view own sales" ON session_sales
     FOR ALL USING (auth.uid() = user_id);
   
   CREATE POLICY "Users can view own settings" ON user_settings
     FOR ALL USING (auth.uid()::text = user_id);
   ```

3. **Set up Authentication Providers** (if needed):
   - Go to Supabase → Authentication → Providers
   - Enable desired providers (Google, GitHub, etc.)
   - Add redirect URLs from Vercel domain

## Environment Files

### For Local Development
Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here
```

### For Production (Vercel)
Set environment variables in Vercel Dashboard, not in code.

## Troubleshooting

### Build Fails
- Check all environment variables are set
- Ensure all dependencies are in package.json
- Check build logs for specific errors

### Authentication Issues
- Verify Supabase URL and keys are correct
- Check redirect URLs in Supabase settings
- Ensure cookies are enabled in browser

### PWA Not Installing
- Site must be served over HTTPS (Vercel handles this)
- Check manifest.json is accessible
- Verify service worker is registered

### Database Connection Issues
- Check Supabase project is not paused
- Verify environment variables are correct
- Check RLS policies if enabled

## Monitoring

### Vercel Dashboard
- Monitor deployments
- Check function logs
- View analytics

### Supabase Dashboard
- Monitor database usage
- Check authentication logs
- View real-time subscriptions

## Updates and Redeploy

To update the app:

1. Push changes to GitHub:
   ```bash
   git add .
   git commit -m "Update message"
   git push
   ```

2. Vercel automatically redeploys on push to main branch

Or manually trigger:
- Vercel Dashboard → Deployments → Redeploy

## Performance Optimization

1. **Enable Caching**:
   - Already configured in next.config.js
   - PWA caches static assets

2. **Database Indexes**:
   ```sql
   CREATE INDEX idx_transactions_user_id ON transactions(user_id);
   CREATE INDEX idx_sessions_user_id ON sessions(user_id);
   CREATE INDEX idx_session_sales_session_id ON session_sales(session_id);
   ```

3. **Image Optimization**:
   - Icons are already optimized as SVG
   - Use Next.js Image component for any photos

## Security Checklist

- ✅ Environment variables not in code
- ✅ RLS enabled on all tables
- ✅ Authentication required for all routes
- ✅ HTTPS enforced (Vercel default)
- ✅ Security headers configured
- ✅ No sensitive data in client-side code

## Support

For issues:
1. Check Vercel deployment logs
2. Check Supabase logs
3. Open issue on GitHub repository
4. Check browser console for errors

---

## Quick Deploy Button

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FZKSystemId%2Fp2ptracker&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY&envDescription=Required%20Supabase%20credentials&project-name=p2p-tracker&repository-name=p2p-tracker)
