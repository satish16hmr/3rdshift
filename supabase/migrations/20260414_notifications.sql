-- user_alerts: per-user credit alerts (depleted, low)
create table if not exists user_alerts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  workspace_id uuid references workspaces(id) on delete set null,
  type text not null, -- 'credit_depleted', 'credit_low'
  title text not null,
  body text not null,
  link_url text,
  link_text text,
  is_read boolean default false,
  created_at timestamp with time zone default now()
);

alter table user_alerts enable row level security;
create policy "user_alerts_own" on user_alerts for all using (auth.uid() = user_id);
create index if not exists user_alerts_user_id_idx on user_alerts(user_id);
create index if not exists user_alerts_type_created_idx on user_alerts(user_id, type, created_at desc);

-- system_notifications: global announcements (new workers, product updates)
create table if not exists system_notifications (
  id uuid default gen_random_uuid() primary key,
  type text not null, -- 'new_worker', 'product_update'
  title text not null,
  body text not null,
  link_url text,
  link_text text,
  target_plan text[], -- null = all plans
  created_at timestamp with time zone default now(),
  expires_at timestamp with time zone
);

alter table system_notifications enable row level security;
create policy "system_notifications_read" on system_notifications for select using (true);

-- user_notification_reads: tracks which global notifications a user has read
create table if not exists user_notification_reads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  notification_id uuid references system_notifications(id) on delete cascade,
  read_at timestamp with time zone default now(),
  unique(user_id, notification_id)
);

alter table user_notification_reads enable row level security;
create policy "user_notification_reads_own" on user_notification_reads for all using (auth.uid() = user_id);
