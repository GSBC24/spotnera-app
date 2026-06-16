alter table public.businesses
  alter column owner_id drop not null,
  drop constraint if exists businesses_owner_id_fkey,
  add constraint businesses_owner_id_fkey
    foreign key (owner_id) references auth.users(id) on delete set null;

alter table public.deals
  alter column owner_id drop not null,
  drop constraint if exists deals_owner_id_fkey,
  add constraint deals_owner_id_fkey
    foreign key (owner_id) references auth.users(id) on delete set null;

grant select on public.businesses to anon, authenticated;
grant select on public.deals to anon, authenticated;
grant insert, update, delete on public.businesses to authenticated;
grant insert, update, delete on public.deals to authenticated;

drop policy if exists "Authenticated users can read active businesses" on public.businesses;
drop policy if exists "Public users can read active businesses" on public.businesses;
create policy "Public users can read active businesses"
  on public.businesses
  for select
  to anon, authenticated
  using (is_active or owner_id = auth.uid());

drop policy if exists "Users can insert owned businesses" on public.businesses;
drop policy if exists "Authenticated users can insert businesses" on public.businesses;
create policy "Authenticated users can insert businesses"
  on public.businesses
  for insert
  to authenticated
  with check (owner_id is null or owner_id = auth.uid());

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

drop policy if exists "Business owners can insert deals" on public.deals;
drop policy if exists "Authenticated users can insert deals" on public.deals;
create policy "Authenticated users can insert deals"
  on public.deals
  for insert
  to authenticated
  with check (
    (owner_id is null or owner_id = auth.uid())
    and exists (
      select 1
      from public.businesses
      where businesses.id = deals.business_id
        and (businesses.owner_id is null or businesses.owner_id = auth.uid())
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
