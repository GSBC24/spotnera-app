begin;

-- The original device table did not have enough information to represent a
-- Web Push subscription. Abort rather than guessing how to migrate any
-- unexpected legacy webpush rows.
do $$
begin
  if exists (
    select 1
    from public.notification_devices
    where provider = 'webpush'
  ) then
    raise exception
      'notification_devices already contains webpush rows; review them before applying this migration';
  end if;
end;
$$;

alter table public.notification_devices
  alter column push_token drop not null,
  add column endpoint text,
  add column p256dh text,
  add column auth text,
  add column expires_at timestamptz,
  add column disabled_at timestamptz;

alter table public.notification_devices
  add constraint notification_devices_webpush_endpoint_key unique (endpoint),
  add constraint notification_devices_endpoint_check
    check (endpoint is null or char_length(endpoint) between 1 and 4096),
  add constraint notification_devices_p256dh_check
    check (p256dh is null or octet_length(p256dh) between 1 and 512),
  add constraint notification_devices_auth_check
    check (auth is null or octet_length(auth) between 1 and 256),
  add constraint notification_devices_provider_payload_check
    check (
      (
        provider = 'webpush'
        and platform = 'web'
        and push_token is null
        and endpoint is not null
        and p256dh is not null
        and auth is not null
      )
      or
      (
        provider <> 'webpush'
        and push_token is not null
        and endpoint is null
        and p256dh is null
        and auth is null
      )
    );

-- Change defaults only. Existing preference rows and stored choices are not
-- updated or rewritten.
alter table public.notification_preferences
  alter column saved_business_new_deals set default false,
  alter column saved_business_deal_starting_soon set default false;

commit;
