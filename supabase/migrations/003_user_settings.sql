-- Create user settings table to store preferences like monthly target
create table if not exists user_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text unique not null,
  setting_value text not null,
  updated_at timestamptz default now()
);

-- Insert default monthly target if not exists
insert into user_settings (setting_key, setting_value) 
values ('monthly_target', '3000000')
on conflict (setting_key) do nothing;

-- Create index for faster lookups
create index if not exists idx_user_settings_key on user_settings(setting_key);
