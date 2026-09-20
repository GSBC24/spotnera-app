begin;

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  saved_business_new_deals boolean not null default true,
  saved_business_deal_starting_soon boolean not null default true,
  saved_business_deal_ending_soon boolean not null default false,
  weekly_deals_email boolean not null default false,
  new_deal_email boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.set_notification_preferences_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_notification_preferences_updated_at
before update on public.notification_preferences
for each row
execute function public.set_notification_preferences_updated_at();

alter table public.notification_preferences enable row level security;

revoke all on public.notification_preferences from anon, authenticated;
grant select, insert, update on public.notification_preferences to authenticated;

create policy "Users can read their own notification preferences"
  on public.notification_preferences
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own notification preferences"
  on public.notification_preferences
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own notification preferences"
  on public.notification_preferences
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
