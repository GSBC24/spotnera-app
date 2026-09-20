begin;

alter table public.deals
  add column availability_mode text not null default 'continuous',
  add column availability_timezone text not null default 'Europe/Oslo';

alter table public.deals
  add constraint deals_availability_mode_check
    check (availability_mode in ('continuous', 'weekly')),
  add constraint deals_availability_timezone_check
    check (
      char_length(availability_timezone) between 1 and 100
      and availability_timezone ~ '^(UTC|[A-Za-z][A-Za-z0-9._+-]*(/[A-Za-z0-9._+-]+)+)$'
      and pg_catalog.timezone(
        availability_timezone,
        timestamptz '2000-01-01 00:00:00+00'
      ) is not null
    );

create table public.deal_schedules (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  day_of_week integer not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  spans_midnight boolean not null default false,
  created_at timestamptz not null default now(),
  constraint deal_schedules_day_of_week_check check (day_of_week between 1 and 7),
  constraint deal_schedules_distinct_times_check check (start_time <> end_time),
  constraint deal_schedules_overnight_check check (
    (spans_midnight and end_time < start_time)
    or (not spans_midnight and end_time > start_time)
  ),
  constraint deal_schedules_exact_window_key
    unique (deal_id, day_of_week, start_time, end_time)
);

create index deal_schedules_deal_id_idx
  on public.deal_schedules(deal_id);

alter table public.deal_schedules enable row level security;

revoke all on public.deal_schedules from anon, authenticated;
grant select on public.deal_schedules to anon, authenticated;
grant insert, update, delete on public.deal_schedules to authenticated;

create policy "Public users can read schedules for readable deals"
  on public.deal_schedules
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.deals
      where deals.id = deal_schedules.deal_id
    )
  );

create policy "Deal owners can insert schedules"
  on public.deal_schedules
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.deals
      where deals.id = deal_schedules.deal_id
        and deals.owner_id = auth.uid()
    )
  );

create policy "Deal owners can update schedules"
  on public.deal_schedules
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.deals
      where deals.id = deal_schedules.deal_id
        and deals.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.deals
      where deals.id = deal_schedules.deal_id
        and deals.owner_id = auth.uid()
    )
  );

create policy "Deal owners can delete schedules"
  on public.deal_schedules
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.deals
      where deals.id = deal_schedules.deal_id
        and deals.owner_id = auth.uid()
    )
  );

commit;
