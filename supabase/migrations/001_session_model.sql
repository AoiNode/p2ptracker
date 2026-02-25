-- Migration from FIFO to Session-based model
-- Keep existing tables for backward compatibility during migration

-- 1. Create sessions table first (needed for foreign key reference)
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  total_invest_idr numeric not null,
  total_usdt numeric not null,
  avg_cost numeric not null,
  remaining_usdt numeric not null,
  realized_profit_idr numeric default 0,
  status text default 'active' check (status in ('active', 'closed'))
);

-- 2. Create or alter transactions table with session_id
do $$ 
begin
  -- Check if transactions table exists
  if not exists (select 1 from information_schema.tables where table_name = 'transactions') then
    create table transactions (
      id uuid primary key default gen_random_uuid(),
      tx_time timestamptz not null,
      type text check (type in ('BUY','SELL')),
      price_idr numeric not null,
      amount_usdt numeric not null,
      total_idr numeric not null,
      fee_idr numeric default 0,
      notes text,
      session_id uuid references sessions(id) on delete cascade
    );
  else
    -- Add session_id column if it doesn't exist
    if not exists (select 1 from information_schema.columns 
                   where table_name = 'transactions' and column_name = 'session_id') then
      alter table transactions add column session_id uuid references sessions(id) on delete cascade;
    end if;
  end if;
end $$;

-- 3. Create session_sales table (links SELL to sessions)
create table if not exists session_sales (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  tx_id uuid references transactions(id) on delete cascade,
  sold_usdt numeric not null,
  proceeds_idr numeric not null,
  cost_idr numeric not null,
  profit_idr numeric not null,
  created_at timestamptz default now()
);

-- 4. Add indexes for performance
create index if not exists idx_sessions_status on sessions(status);
create index if not exists idx_sessions_created_at on sessions(created_at);
create index if not exists idx_session_sales_session on session_sales(session_id);
create index if not exists idx_session_sales_tx on session_sales(tx_id);
create index if not exists idx_transactions_session on transactions(session_id);

-- 5. Create view for daily reports
create or replace view daily_reports as
select
  date_trunc('day', t.tx_time)::date as date,
  sum(case when t.type = 'BUY' then t.total_idr else 0 end) as total_buy_idr,
  sum(case when t.type = 'SELL' then t.total_idr else 0 end) as total_sell_idr,
  coalesce(sum(ss.profit_idr), 0) as realized_profit_idr
from transactions t
left join session_sales ss on t.id = ss.tx_id
group by date_trunc('day', t.tx_time)
order by date desc;
