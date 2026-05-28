create extension if not exists pgcrypto;

do $$
begin
  create type public.deal_status as enum ('active', 'scheduled', 'paused', 'ended');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  description text,
  city text not null,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_name_length check (char_length(name) between 2 and 120),
  constraint business_category_length check (char_length(category) between 2 and 80),
  constraint business_city_length check (char_length(city) between 2 and 120),
  constraint business_latitude_range check (latitude between -90 and 90),
  constraint business_longitude_range check (longitude between -180 and 180)
);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status public.deal_status not null default 'active',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deal_title_length check (char_length(title) between 2 and 140),
  constraint deal_time_order check (
    starts_at is null or ends_at is null or starts_at < ends_at
  )
);

create index if not exists businesses_owner_id_idx on public.businesses(owner_id);
create index if not exists businesses_city_idx on public.businesses(city);
create index if not exists businesses_location_idx on public.businesses(latitude, longitude);
create index if not exists deals_business_id_idx on public.deals(business_id);
create index if not exists deals_owner_id_idx on public.deals(owner_id);
create index if not exists deals_status_idx on public.deals(status);

alter table public.businesses enable row level security;
alter table public.deals enable row level security;

drop policy if exists "Authenticated users can read active businesses" on public.businesses;
create policy "Authenticated users can read active businesses"
  on public.businesses
  for select
  to authenticated
  using (is_active or owner_id = auth.uid());

drop policy if exists "Users can insert owned businesses" on public.businesses;
create policy "Users can insert owned businesses"
  on public.businesses
  for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "Business owners can update businesses" on public.businesses;
create policy "Business owners can update businesses"
  on public.businesses
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Business owners can delete businesses" on public.businesses;
create policy "Business owners can delete businesses"
  on public.businesses
  for delete
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "Authenticated users can read deals for active businesses" on public.deals;
create policy "Authenticated users can read deals for active businesses"
  on public.deals
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = deals.business_id
        and (businesses.is_active or businesses.owner_id = auth.uid())
    )
  );

drop policy if exists "Business owners can insert deals" on public.deals;
create policy "Business owners can insert deals"
  on public.deals
  for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1
      from public.businesses
      where businesses.id = deals.business_id
        and businesses.owner_id = auth.uid()
    )
  );

drop policy if exists "Business owners can update deals" on public.deals;
create policy "Business owners can update deals"
  on public.deals
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1
      from public.businesses
      where businesses.id = deals.business_id
        and businesses.owner_id = auth.uid()
    )
  );

drop policy if exists "Business owners can delete deals" on public.deals;
create policy "Business owners can delete deals"
  on public.deals
  for delete
  to authenticated
  using (owner_id = auth.uid());
