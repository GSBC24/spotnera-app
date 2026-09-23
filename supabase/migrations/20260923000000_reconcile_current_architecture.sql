begin;

-- Production preflight found mandatory owners and cascading owner foreign keys.
-- Refuse to proceed if either ownership contract has drifted. Do not rewrite
-- ownership data or replace constraints that are already correct.
do $$
declare
  relation_name text;
  relation_id regclass;
  owner_column smallint;
  user_id_column smallint;
begin
  select attnum into user_id_column
  from pg_catalog.pg_attribute
  where attrelid = 'auth.users'::regclass
    and attname = 'id'
    and not attisdropped;

  foreach relation_name in array array['businesses', 'deals'] loop
    relation_id := pg_catalog.to_regclass('public.' || relation_name);

    select attnum into owner_column
    from pg_catalog.pg_attribute
    where attrelid = relation_id
      and attname = 'owner_id'
      and not attisdropped
      and attnotnull
      and atttypid = 'pg_catalog.uuid'::regtype
      and not exists (
        select 1
        from pg_catalog.pg_attrdef
        where adrelid = relation_id and adnum = attnum
      );

    if relation_id is null or owner_column is null or user_id_column is null
      or not exists (
        select 1
        from pg_catalog.pg_constraint c
        where c.conrelid = relation_id
          and c.conname = relation_name || '_owner_id_fkey'
          and c.contype = 'f'
          and c.convalidated
          and c.confrelid = 'auth.users'::regclass
          and c.conkey = array[owner_column]::smallint[]
          and c.confkey = array[user_id_column]::smallint[]
          and c.confdeltype = 'c'
      ) then
      raise exception 'Ownership schema for public.% is not NOT NULL with ON DELETE CASCADE',
        relation_name;
    end if;

    owner_column := null;
  end loop;
end
$$;

-- The production policies have equivalent checks. Remove only the duplicate;
-- the canonical policy and every SELECT/UPDATE/DELETE policy remain in place.
drop policy if exists "Users can create their own businesses"
  on public.businesses;

do $$
begin
  if (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'businesses'
      and cmd = 'INSERT'
  ) <> 1 or not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'businesses'
      and policyname = 'Users can insert owned businesses'
      and cmd = 'INSERT'
      and permissive = 'PERMISSIVE'
      and roles = array['authenticated'::name]
  ) or exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'businesses'
      and cmd = 'ALL'
  ) then
    raise exception 'Business INSERT policies differ from the preflight';
  end if;
end
$$;

insert into storage.buckets
  (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-assets',
  'business-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Preflight found no storage.objects policies. If a policy with one of these
-- names appears before deployment, fail for review rather than replace it.
create policy "Public users can read business assets"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'business-assets');

create policy "Users can upload business assets to their folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

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

create policy "Users can delete business assets in their folder"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- SECURITY DEFINER is required because owners cannot SELECT other users'
-- favorite rows. The function emits only grouped counts for owned businesses.
-- A migration role with favorites RLS bypass must own this function;
-- row_security=off makes an insufficient owner fail instead of undercounting.
create or replace function public.get_owner_business_favorite_counts()
returns table (business_id uuid, favorite_count bigint)
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
set row_security = off
as $$
  select b.id, count(f.id)::bigint
  from public.businesses b
  left join public.favorites f on f.business_id = b.id
  where auth.uid() is not null
    and b.owner_id = auth.uid()
  group by b.id;
$$;

revoke all on function public.get_owner_business_favorite_counts()
  from public, anon;
grant execute on function public.get_owner_business_favorite_counts()
  to authenticated;

commit;
