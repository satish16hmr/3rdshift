create table if not exists blog_subscribers (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  source text default 'blog',
  subscribed_at timestamptz default now()
);

alter table blog_subscribers enable row level security;

-- Only service role can read/write (no public access)
create policy "service_role_only" on blog_subscribers
  for all using (false);
