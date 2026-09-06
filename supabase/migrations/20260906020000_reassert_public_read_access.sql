grant usage on schema public to anon, authenticated;
grant select on public.businesses to anon, authenticated;
grant select on public.deals to anon, authenticated;
grant select on public.reviews to anon, authenticated;

alter table public.businesses enable row level security;
alter table public.deals enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "Authenticated users can read active businesses" on public.businesses;
drop policy if exists "Public users can read active businesses" on public.businesses;
create policy "Public users can read active businesses"
  on public.businesses
  for select
  to anon, authenticated
  using (
    is_active or owner_id = auth.uid()
  );

drop policy if exists "Authenticated users can read deals for active businesses" on public.deals;
drop policy if exists "Public users can read deals for active businesses" on public.deals;
drop policy if exists "Public users can read live deals for active businesses" on public.deals;
create policy "Public users can read live deals for active businesses"
  on public.deals
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = deals.business_id
        and (
          businesses.owner_id = auth.uid()
          or (
            businesses.is_active
            and deals.is_active
            and (deals.starts_at is null or deals.starts_at <= now())
            and (deals.ends_at is null or deals.ends_at > now())
          )
        )
    )
  );

drop policy if exists "Public users can read reviews for active businesses" on public.reviews;
create policy "Public users can read reviews for active businesses"
  on public.reviews
  for select
  to anon, authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.businesses
      where businesses.id = reviews.business_id
        and (businesses.is_active or businesses.owner_id = auth.uid())
    )
  );
