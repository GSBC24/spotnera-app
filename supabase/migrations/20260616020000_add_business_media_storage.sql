alter table public.businesses
  add column if not exists logo_url text,
  add column if not exists cover_image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-assets',
  'business-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public users can read business assets" on storage.objects;
create policy "Public users can read business assets"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'business-assets');

drop policy if exists "Users can upload business assets to their folder" on storage.objects;
create policy "Users can upload business assets to their folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update business assets in their folder" on storage.objects;
create policy "Users can update business assets in their folder"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete business assets in their folder" on storage.objects;
create policy "Users can delete business assets in their folder"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
