-- Profile photo upload support
-- Run in Supabase SQL editor

-- 1. Add avatar_url column to profiles
alter table profiles add column if not exists avatar_url text;

-- 2. Create storage bucket (public — URLs used in <img> tags without auth)
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

-- 3. Storage RLS policies
create policy "Users can upload own photo"
on storage.objects for insert
with check (bucket_id = 'profile-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update own photo"
on storage.objects for update
using (bucket_id = 'profile-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own photo"
on storage.objects for delete
using (bucket_id = 'profile-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Public read for profile photos"
on storage.objects for select
using (bucket_id = 'profile-photos');
