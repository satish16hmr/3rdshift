-- Support requests from JARVIS escalation
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  user_email text,
  subject text not null,
  message text not null,
  context text, -- last few JARVIS messages for context
  status text not null default 'open', -- open | resolved
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_requests enable row level security;

-- Users can insert their own requests
create policy "Users can create support requests"
  on public.support_requests for insert
  with check (auth.uid() = user_id or user_id is null);

-- Users can read their own requests
create policy "Users can read own support requests"
  on public.support_requests for select
  using (auth.uid() = user_id);

-- Service role has full access
create policy "Service role full access"
  on public.support_requests for all
  using (true);
