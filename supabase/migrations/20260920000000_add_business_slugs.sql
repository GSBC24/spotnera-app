begin;

create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;

alter table public.businesses
  add column if not exists slug text;

create or replace function public.normalize_business_slug(source_name text)
returns text
language sql
stable
strict
set search_path = pg_catalog, extensions, pg_temp
as $$
  select coalesce(
    nullif(
      trim(
        both '-' from regexp_replace(
          lower(
            extensions.unaccent(
              replace(
                replace(
                  replace(lower(source_name), 'æ', 'ae'),
                  'ø',
                  'o'
                ),
                'å',
                'a'
              )
            )
          ),
          '[^a-z0-9]+',
          '-',
          'g'
        )
      ),
      ''
    ),
    'business'
  );
$$;

create or replace function public.allocate_business_slug(source_name text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  base_slug text := left(public.normalize_business_slug(source_name), 100);
  candidate_slug text;
  suffix_number integer := 1;
begin
  if base_slug ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    base_slug := 'business-' || base_slug;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public.businesses.slug-allocation', 0)
  );

  candidate_slug := base_slug;

  while exists (
    select 1
    from public.businesses
    where slug = candidate_slug
  ) loop
    suffix_number := suffix_number + 1;
    candidate_slug := left(base_slug, 120 - length(suffix_number::text) - 1)
      || '-'
      || suffix_number::text;
  end loop;

  return candidate_slug;
end;
$$;

create or replace function public.assign_business_slug()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  new.slug := public.allocate_business_slug(new.name);
  return new;
end;
$$;

create or replace function public.preserve_business_slug()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  new.slug := old.slug;
  return new;
end;
$$;

revoke all on function public.normalize_business_slug(text) from public, anon, authenticated;
revoke all on function public.allocate_business_slug(text) from public, anon, authenticated;
revoke all on function public.assign_business_slug() from public, anon, authenticated;
revoke all on function public.preserve_business_slug() from public, anon, authenticated;

do $$
declare
  business_row record;
begin
  for business_row in
    select id, name
    from public.businesses
    where slug is null
    order by created_at asc, id asc
  loop
    update public.businesses
    set slug = public.allocate_business_slug(business_row.name)
    where id = business_row.id;
  end loop;
end;
$$;

alter table public.businesses
  add constraint businesses_slug_format_check
  check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and char_length(slug) <= 120
  );

create unique index businesses_slug_key
  on public.businesses (slug);

alter table public.businesses
  alter column slug set not null;

drop trigger if exists assign_business_slug_before_insert on public.businesses;
create trigger assign_business_slug_before_insert
before insert on public.businesses
for each row
execute function public.assign_business_slug();

drop trigger if exists preserve_business_slug_before_update on public.businesses;
create trigger preserve_business_slug_before_update
before update of slug on public.businesses
for each row
execute function public.preserve_business_slug();

commit;
