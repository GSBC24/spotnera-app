grant usage on schema public to anon, authenticated;

grant select on table public.businesses to anon, authenticated;
grant select on table public.deals to anon, authenticated;

alter table public.businesses enable row level security;
alter table public.deals enable row level security;

drop policy if exists "Authenticated users can read active businesses" on public.businesses;
drop policy if exists "Public users can read active businesses" on public.businesses;
create policy "Public users can read active businesses"
  on public.businesses
  for select
  to anon, authenticated
  using (is_active or owner_id = auth.uid());

drop policy if exists "Authenticated users can read deals for active businesses" on public.deals;
drop policy if exists "Public users can read deals for active businesses" on public.deals;
create policy "Public users can read deals for active businesses"
  on public.deals
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = deals.business_id
        and (businesses.is_active or businesses.owner_id = auth.uid())
    )
  );
