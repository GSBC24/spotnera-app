begin;

create table public.business_opening_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 1 and 7),
  is_closed boolean not null default false,
  open_time time without time zone,
  close_time time without time zone,
  spans_midnight boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_opening_hours_one_day unique (business_id, day_of_week),
  constraint business_opening_hours_valid_window check (
    (is_closed and open_time is null and close_time is null and not spans_midnight)
    or (not is_closed and open_time is not null and close_time is not null
      and open_time <> close_time
      and ((spans_midnight and close_time < open_time)
        or (not spans_midnight and close_time > open_time)))
  )
);

alter table public.business_opening_hours enable row level security;

revoke all on public.business_opening_hours from anon, authenticated;
grant select on public.business_opening_hours to anon, authenticated;
grant insert, update, delete on public.business_opening_hours to authenticated;

create policy "Read hours for public or owned businesses"
  on public.business_opening_hours for select to anon, authenticated
  using (exists (
    select 1 from public.businesses
    where businesses.id = business_opening_hours.business_id
      and (businesses.is_active or businesses.owner_id = auth.uid())
  ));

create policy "Owners insert business hours"
  on public.business_opening_hours for insert to authenticated
  with check (exists (
    select 1 from public.businesses
    where businesses.id = business_opening_hours.business_id
      and businesses.owner_id = auth.uid()
  ));

create policy "Owners update business hours"
  on public.business_opening_hours for update to authenticated
  using (exists (
    select 1 from public.businesses
    where businesses.id = business_opening_hours.business_id
      and businesses.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.businesses
    where businesses.id = business_opening_hours.business_id
      and businesses.owner_id = auth.uid()
  ));

create policy "Owners delete business hours"
  on public.business_opening_hours for delete to authenticated
  using (exists (
    select 1 from public.businesses
    where businesses.id = business_opening_hours.business_id
      and businesses.owner_id = auth.uid()
  ));

commit;
