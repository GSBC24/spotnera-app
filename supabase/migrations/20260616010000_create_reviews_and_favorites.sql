create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_rating_range check (rating between 1 and 5),
  constraint reviews_comment_length check (comment is null or char_length(comment) <= 1000),
  constraint reviews_one_per_user_business unique (business_id, user_id)
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorites_one_per_user_business unique (business_id, user_id)
);

create index if not exists reviews_business_id_idx on public.reviews(business_id);
create index if not exists reviews_user_id_idx on public.reviews(user_id);
create index if not exists favorites_business_id_idx on public.favorites(business_id);
create index if not exists favorites_user_id_idx on public.favorites(user_id);

alter table public.reviews enable row level security;
alter table public.favorites enable row level security;

grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;
grant select, insert, delete on public.favorites to authenticated;

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
        and businesses.is_active
    )
  );

drop policy if exists "Users can insert their own reviews" on public.reviews;
create policy "Users can insert their own reviews"
  on public.reviews
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.businesses
      where businesses.id = reviews.business_id
        and businesses.is_active
    )
  );

drop policy if exists "Users can update their own reviews" on public.reviews;
create policy "Users can update their own reviews"
  on public.reviews
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.businesses
      where businesses.id = reviews.business_id
        and businesses.is_active
    )
  );

drop policy if exists "Users can delete their own reviews" on public.reviews;
create policy "Users can delete their own reviews"
  on public.reviews
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can read their own favorites" on public.favorites;
create policy "Users can read their own favorites"
  on public.favorites
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own favorites" on public.favorites;
create policy "Users can insert their own favorites"
  on public.favorites
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.businesses
      where businesses.id = favorites.business_id
        and businesses.is_active
    )
  );

drop policy if exists "Users can delete their own favorites" on public.favorites;
create policy "Users can delete their own favorites"
  on public.favorites
  for delete
  to authenticated
  using (user_id = auth.uid());
