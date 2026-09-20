begin;

create table public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  provider text not null,
  push_token text not null,
  device_name text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint notification_devices_platform_check
    check (platform in ('web', 'android', 'ios')),
  constraint notification_devices_provider_check
    check (
      char_length(provider) between 1 and 50
      and provider ~ '^[a-z0-9][a-z0-9._-]*$'
    ),
  constraint notification_devices_push_token_check
    check (octet_length(push_token) between 1 and 2048),
  constraint notification_devices_device_name_check
    check (device_name is null or char_length(device_name) between 1 and 120),
  constraint notification_devices_provider_token_key
    unique (provider, push_token)
);

create index notification_devices_user_id_idx
  on public.notification_devices(user_id);

create index notification_devices_enabled_user_idx
  on public.notification_devices(user_id)
  where enabled;

create function public.set_notification_devices_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_notification_devices_updated_at
before update on public.notification_devices
for each row
execute function public.set_notification_devices_updated_at();

alter table public.notification_devices enable row level security;

revoke all on public.notification_devices from anon, authenticated;
grant select, insert, update, delete on public.notification_devices to authenticated;

create policy "Users can read their own notification devices"
  on public.notification_devices
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own notification devices"
  on public.notification_devices
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own notification devices"
  on public.notification_devices
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own notification devices"
  on public.notification_devices
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
