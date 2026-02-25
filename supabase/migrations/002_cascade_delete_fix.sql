-- Fix cascade delete for transactions when session is deleted
-- This migration ensures that when a session is deleted, all related transactions are also deleted

-- Drop existing foreign key constraint and recreate with CASCADE
do $$ 
begin
  -- First, check if the constraint exists and drop it
  if exists (
    select 1 
    from information_schema.table_constraints 
    where table_name = 'transactions' 
    and constraint_type = 'FOREIGN KEY'
    and constraint_name like '%session_id%'
  ) then
    -- Find and drop the existing foreign key constraint
    execute (
      select 'ALTER TABLE transactions DROP CONSTRAINT ' || constraint_name || ';'
      from information_schema.table_constraints
      where table_name = 'transactions'
      and constraint_type = 'FOREIGN KEY'
      and constraint_name like '%session_id%'
      limit 1
    );
  end if;

  -- Add the foreign key constraint with ON DELETE CASCADE
  alter table transactions 
    add constraint transactions_session_id_fkey 
    foreign key (session_id) 
    references sessions(id) 
    on delete cascade;
    
  raise notice 'Successfully updated transactions foreign key to cascade on session delete';
end $$;

-- Verify the cascade delete is working by checking the constraint
select 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  rc.update_rule,
  rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu 
  on tc.constraint_name = kcu.constraint_name
join information_schema.referential_constraints rc
  on tc.constraint_name = rc.constraint_name
where tc.table_name = 'transactions'
  and tc.constraint_type = 'FOREIGN KEY'
  and kcu.column_name = 'session_id';
