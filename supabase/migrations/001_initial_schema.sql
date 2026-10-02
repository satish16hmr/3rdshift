-- 3rdShift Product Schema
-- Run this in the Supabase SQL editor

-- PROFILES
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  plan text not null default 'none',
  billing_cycle text default 'annual',
  stripe_customer_id text,
  stripe_subscription_id text,
  heavy_credits_remaining int not null default 0,
  heavy_credits_reset_at timestamptz,
  worker_slots_used int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Users read own profile" on profiles for select using (auth.uid() = id);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- TASKS
create table if not exists tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  worker_slug text not null,
  category text not null,
  task_type text not null default 'light',
  status text not null default 'pending',
  input jsonb not null,
  output jsonb,
  output_format text,
  model_used text,
  credits_charged int not null default 0,
  error_message text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

alter table tasks enable row level security;
create policy "Users read own tasks" on tasks for select using (auth.uid() = user_id);
create policy "Users create own tasks" on tasks for insert with check (auth.uid() = user_id);

create index if not exists idx_tasks_user_id on tasks(user_id);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_worker on tasks(worker_slug);

-- WORKER MEMORY
create table if not exists worker_memory (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  worker_slug text not null,
  memory_type text not null,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, worker_slug, memory_type)
);

alter table worker_memory enable row level security;
create policy "Users manage own memory" on worker_memory for all using (auth.uid() = user_id);

-- SCHEDULED TASKS (Phase 3)
create table if not exists scheduled_tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  worker_slug text not null,
  schedule text not null,
  input_template jsonb not null,
  is_active boolean default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz default now()
);

alter table scheduled_tasks enable row level security;
create policy "Users manage own schedules" on scheduled_tasks for all using (auth.uid() = user_id);
