begin;

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type = 'saved_business_new_deal'),
  deal_id uuid not null references public.deals(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  cursor_user_id uuid,
  cursor_device_id uuid,
  scan_complete boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notification_events_one_per_deal unique (event_type, deal_id),
  constraint notification_events_cursor_pair check
    ((cursor_user_id is null) = (cursor_device_id is null))
);

create index notification_events_unscanned_idx
  on public.notification_events (created_at, id) where not scan_complete;

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.notification_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references public.notification_devices(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'skipped', 'failed', 'stale', 'uncertain')),
  attempts integer not null default 0 check (attempts between 0 and 4),
  next_attempt_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  claim_token uuid,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_deliveries_one_per_device unique (event_id, device_id)
);

create index notification_deliveries_pending_idx
  on public.notification_deliveries (next_attempt_at, id)
  where status in ('pending', 'sending');

alter table public.notification_events enable row level security;
alter table public.notification_deliveries enable row level security;
revoke all on public.notification_events from public, anon, authenticated;
revoke all on public.notification_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.notification_events to service_role;
grant select, insert, update, delete on public.notification_deliveries to service_role;

create function public.enqueue_new_deal_push_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  insert into public.notification_events (event_type, deal_id, business_id)
  values ('saved_business_new_deal', new.id, new.business_id)
  on conflict (event_type, deal_id) do nothing;
  return new;
end;
$$;

revoke all on function public.enqueue_new_deal_push_event() from public, anon, authenticated;
create trigger enqueue_new_deal_push_event_after_insert
after insert on public.deals
for each row execute function public.enqueue_new_deal_push_event();

-- One event is scanned per call. This V1 audience is incremental, not a
-- frozen snapshot: a newly eligible device behind the cursor can miss this
-- event. Eligibility is checked again by the processor before sending.
create function public.scan_new_deal_push_audience(p_limit integer default 10)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  event_row public.notification_events%rowtype;
  target_row record;
  scanned integer := 0;
begin
  if p_limit < 1 or p_limit > 10 then
    raise exception 'Invalid batch size';
  end if;

  select e.* into event_row
  from public.notification_events e
  join public.deals d on d.id = e.deal_id
  where not e.scan_complete
    and (
      d.availability_mode <> 'weekly'
      or exists (select 1 from public.deal_schedules s where s.deal_id = d.id)
    )
  order by e.created_at, e.id
  for update of e skip locked
  limit 1;

  if not found then return 0; end if;

  for target_row in
    select f.user_id, n.id as device_id
    from public.favorites f
    join public.notification_preferences p on p.user_id = f.user_id
      and p.saved_business_new_deals = true
    join public.notification_devices n on n.user_id = f.user_id
      and n.provider = 'webpush'
      and n.platform = 'web'
      and n.enabled = true
      and n.disabled_at is null
      and (n.expires_at is null or n.expires_at > now())
    where f.business_id = event_row.business_id
      and (
        event_row.cursor_user_id is null
        or (f.user_id, n.id) > (event_row.cursor_user_id, event_row.cursor_device_id)
      )
    order by f.user_id, n.id
    limit p_limit
  loop
    insert into public.notification_deliveries (event_id, user_id, device_id)
    values (event_row.id, target_row.user_id, target_row.device_id)
    on conflict (event_id, device_id) do nothing;

    update public.notification_events
    set cursor_user_id = target_row.user_id,
        cursor_device_id = target_row.device_id
    where id = event_row.id;
    scanned := scanned + 1;
  end loop;

  if scanned < p_limit then
    update public.notification_events set scan_complete = true
    where id = event_row.id;
  end if;

  return scanned;
end;
$$;

revoke all on function public.scan_new_deal_push_audience(integer) from public, anon, authenticated;
grant execute on function public.scan_new_deal_push_audience(integer) to service_role;

create function public.claim_new_deal_push_deliveries(p_limit integer default 10)
returns table (
  delivery_id uuid,
  event_id uuid,
  user_id uuid,
  device_id uuid,
  claim_token uuid,
  attempts integer
)
language sql
security invoker
set search_path = pg_catalog, pg_temp
as $$
  with candidates as (
    select d.id
    from public.notification_deliveries d
    where p_limit between 1 and 10
      and d.attempts < 4
      and (
        d.status = 'pending' and d.next_attempt_at <= now()
      )
    order by d.next_attempt_at, d.id
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.notification_deliveries d
    set status = 'sending',
        attempts = d.attempts + 1,
        claim_token = gen_random_uuid(),
        lease_expires_at = now() + interval '5 minutes'
    from candidates c
    where d.id = c.id
    returning d.id, d.event_id, d.user_id, d.device_id, d.claim_token, d.attempts
  )
  select * from claimed;
$$;

revoke all on function public.claim_new_deal_push_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_new_deal_push_deliveries(integer) to service_role;

-- A worker crash can happen after a provider accepted a push but before the
-- delivery ledger was updated. Do not automatically resend that ambiguous
-- attempt: it could show the same notification twice.
create function public.expire_new_deal_push_claims(p_limit integer default 10)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  expired_count integer;
begin
  if p_limit < 1 or p_limit > 10 then
    raise exception 'Invalid batch size';
  end if;

  with expired as (
    select id, claim_token from public.notification_deliveries
    where status = 'sending' and claim_token is not null
      and lease_expires_at < now()
    order by lease_expires_at, id
    for update skip locked
    limit p_limit
  )
  update public.notification_deliveries d
  set status = 'uncertain', claim_token = null, lease_expires_at = null
  from expired e
  where d.id = e.id
    and d.claim_token = e.claim_token
    and d.status = 'sending'
    and d.lease_expires_at < now();

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

revoke all on function public.expire_new_deal_push_claims(integer) from public, anon, authenticated;
grant execute on function public.expire_new_deal_push_claims(integer) to service_role;

commit;
