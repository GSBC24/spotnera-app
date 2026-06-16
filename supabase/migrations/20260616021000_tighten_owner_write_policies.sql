drop policy if exists "Authenticated users can insert businesses" on public.businesses;
create policy "Authenticated users can insert businesses"
  on public.businesses
  for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "Authenticated users can insert deals" on public.deals;
create policy "Authenticated users can insert deals"
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
