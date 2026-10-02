-- Add description and screenshot_url to support_requests
alter table public.support_requests
  add column if not exists description text,
  add column if not exists screenshot_url text;
