begin;

-- Push deliveries are device-specific. Keep customer email attempts in their own
-- ledger, while referencing the existing New Deal event for event identity.
create table public.notification_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('new_deal', 'weekly_summary')),
  event_id uuid references public.notification_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'skipped', 'failed', 'uncertain')),
  attempts integer not null default 0 check (attempts between 0 and 4),
  next_attempt_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  claim_token uuid,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_email_deliveries_kind_shape check (
    (kind = 'new_deal' and event_id is not null and week_start is null)
    or (kind = 'weekly_summary' and event_id is null and week_start is not null)
  )
);

create unique index notification_email_new_deal_once_idx
  on public.notification_email_deliveries(event_id, user_id)
  where kind = 'new_deal';
create unique index notification_email_weekly_once_idx
  on public.notification_email_deliveries(user_id, week_start)
  where kind = 'weekly_summary';
create index notification_email_pending_idx
  on public.notification_email_deliveries(next_attempt_at, id)
  where status = 'pending';
create index notification_email_expired_claim_idx
  on public.notification_email_deliveries(lease_expires_at, id)
  where status = 'sending';

alter table public.notification_email_deliveries enable row level security;
revoke all on public.notification_email_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.notification_email_deliveries to service_role;

-- Reuse the existing insert event. The extra insert snapshots opt-in at deal
-- creation, so changing a preference or saving a business later cannot create
-- a retrospective New Deal email. The worker rechecks consent before sending.
create or replace function public.enqueue_new_deal_push_event()
returns trigger language plpgsql security definer
set search_path = pg_catalog, pg_temp as $$
declare new_event_id uuid;
begin
  insert into public.notification_events(event_type, deal_id, business_id)
  values ('saved_business_new_deal', new.id, new.business_id)
  on conflict do nothing
  returning id into new_event_id;

  if new_event_id is not null and new.is_active = true
      and new.status not in ('paused', 'ended')
      and (new.starts_at is null or new.starts_at <= now())
      and (new.ends_at is null or new.ends_at > now())
      and exists (select 1 from public.businesses b
        where b.id = new.business_id and b.is_active = true) then
    insert into public.notification_email_deliveries(kind, event_id, user_id)
    select 'new_deal', new_event_id, f.user_id
    from public.favorites f
    join public.notification_preferences p on p.user_id = f.user_id
    where f.business_id = new.business_id
      and f.deal_notifications_enabled = true
      and p.new_deal_email = true
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.enqueue_new_deal_push_event()
  from public, anon, authenticated;

-- The worker calls this only during the Norway Monday morning window. Unique
-- (user_id, week_start) also guards Cron and deployment retries.
create function public.enqueue_weekly_email_summaries(p_week_start date)
returns integer language plpgsql security invoker
set search_path = pg_catalog, pg_temp as $$
declare inserted_count integer;
begin
  if p_week_start is null or extract(isodow from p_week_start) <> 1
      or p_week_start <> (now() at time zone 'Europe/Oslo')::date then
    raise exception 'Invalid weekly summary period' using errcode = '22023';
  end if;

  insert into public.notification_email_deliveries(kind, user_id, week_start)
  select 'weekly_summary', p.user_id, p_week_start
  from public.notification_preferences p
  where p.weekly_deals_email = true
    and exists (
      select 1 from public.favorites f
      join public.businesses b on b.id = f.business_id and b.is_active = true
      join public.deals d on d.business_id = b.id
      where f.user_id = p.user_id and f.deal_notifications_enabled = true
        and d.is_active = true and d.status not in ('paused', 'ended')
        and (d.starts_at is null or d.starts_at <= now())
        and (d.ends_at is null or d.ends_at > now())
        and (d.availability_mode <> 'weekly' or exists (
          select 1 from public.deal_schedules s where s.deal_id = d.id))
    )
  on conflict do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
revoke all on function public.enqueue_weekly_email_summaries(date)
  from public, anon, authenticated;
grant execute on function public.enqueue_weekly_email_summaries(date) to service_role;

create function public.claim_customer_email_deliveries(p_limit integer default 10,
  p_not_before timestamptz default null)
returns table(delivery_id uuid, kind text, event_id uuid, user_id uuid,
  week_start date, claim_token uuid, attempts integer)
language plpgsql security invoker set search_path = pg_catalog, pg_temp as $$
begin
  if p_limit < 1 or p_limit > 10 or p_not_before is null then
    raise exception 'Invalid email claim' using errcode = '22023';
  end if;
  return query
  with candidates as (
    select d.id from public.notification_email_deliveries d
    where d.status = 'pending' and d.next_attempt_at <= now()
      and d.attempts < 4 and d.created_at >= p_not_before
    order by d.next_attempt_at, d.id
    for update skip locked limit p_limit
  ), claimed as (
    update public.notification_email_deliveries d
    set status = 'sending', attempts = d.attempts + 1,
      claim_token = gen_random_uuid(), lease_expires_at = now() + interval '5 minutes'
    from candidates c where d.id = c.id
    returning d.id, d.kind, d.event_id, d.user_id, d.week_start,
      d.claim_token, d.attempts
  ) select * from claimed;
end;
$$;
revoke all on function public.claim_customer_email_deliveries(integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_customer_email_deliveries(integer, timestamptz)
  to service_role;

-- An expired sending lease may have reached Resend. Never automatically
-- retry it after Resend's 24-hour idempotency window has passed.
create function public.expire_customer_email_claims(p_limit integer default 10)
returns integer language plpgsql security invoker
set search_path = pg_catalog, pg_temp as $$
declare expired_count integer;
begin
  if p_limit < 1 or p_limit > 10 then
    raise exception 'Invalid batch size' using errcode = '22023';
  end if;
  with expired as (
    select id, claim_token from public.notification_email_deliveries
    where status = 'sending' and claim_token is not null
      and lease_expires_at < now()
    order by lease_expires_at, id for update skip locked limit p_limit
  )
  update public.notification_email_deliveries d
  set status = 'uncertain', claim_token = null, lease_expires_at = null
  from expired e
  where d.id = e.id and d.claim_token = e.claim_token
    and d.status = 'sending' and d.lease_expires_at < now();
  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;
revoke all on function public.expire_customer_email_claims(integer)
  from public, anon, authenticated;
grant execute on function public.expire_customer_email_claims(integer) to service_role;

commit;
