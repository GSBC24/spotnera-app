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

drop policy if exists "Users can read their own favorites" on public.favorites;
create policy "Users can read their own favorites"
  on public.favorites
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.businesses
      where businesses.id = favorites.business_id
        and businesses.owner_id = auth.uid()
    )
  );
