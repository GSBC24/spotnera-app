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
