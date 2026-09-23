begin;

alter table public.deals
  add column timed_edit_generation bigint not null default 0,
  add column timed_edit_token_hash text,
  add column timed_edit_expires_at timestamptz,
  add constraint deals_timed_edit_lease_shape_check check (
    (timed_edit_token_hash is null and timed_edit_expires_at is null)
    or (timed_edit_token_hash is not null and timed_edit_expires_at is not null)
  );

create function public.begin_owner_deal_edit(p_deal_id uuid)
returns uuid language plpgsql security definer
set search_path = pg_catalog, pg_temp as $$
declare acquired_token uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform 1 from public.deals d
    join public.businesses current_business on current_business.id = d.business_id
    where d.id = p_deal_id and d.owner_id = auth.uid()
      and current_business.owner_id = auth.uid();
  if not found then
    raise exception 'Deal is not owned by caller' using errcode = '42501';
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended(p_deal_id::text, 0)) then
    raise exception 'Deal edit is already in progress' using errcode = '55P03';
  end if;
  acquired_token := gen_random_uuid();
  update public.deals d set timed_edit_token_hash = md5(acquired_token::text),
    timed_edit_expires_at = clock_timestamp() + interval '2 minutes'
  where d.id = p_deal_id and d.owner_id = auth.uid()
    and exists (select 1 from public.businesses current_business
      where current_business.id = d.business_id
        and current_business.owner_id = auth.uid())
    and (d.timed_edit_expires_at is null or d.timed_edit_expires_at <= clock_timestamp());
  if not found then
    raise exception 'Deal edit is already in progress or not owned by caller'
      using errcode = '55P03';
  end if;
  return acquired_token;
end;
$$;
revoke all on function public.begin_owner_deal_edit(uuid) from public, anon;
grant execute on function public.begin_owner_deal_edit(uuid) to authenticated;

-- A single RPC transaction makes the deal and all schedule rows visible together.
-- NOWAIT serializes concurrent saves of the same deal without a long-lived lease.
create function public.save_owner_deal(p_deal_id uuid, p_edit_token uuid,
  p_payload jsonb, p_schedules jsonb)
returns uuid language plpgsql security definer
set search_path = pg_catalog, pg_temp as $$
declare
  owner_uuid uuid := auth.uid();
  destination_business uuid;
  saved_id uuid;
  old_deal public.deals%rowtype;
  old_windows jsonb;
  new_windows jsonb;
  timing_changed boolean;
begin
  if owner_uuid is null or jsonb_typeof(p_payload) <> 'object'
      or jsonb_typeof(p_schedules) <> 'array'
      or jsonb_array_length(p_schedules) > 7 then
    raise exception 'Invalid owner deal save' using errcode = '22023';
  end if;
  destination_business := (p_payload->>'business_id')::uuid;
  perform 1 from public.businesses
    where id = destination_business and owner_id = owner_uuid;
  if not found then
    raise exception 'Business is not owned by caller' using errcode = '42501';
  end if;
  if (p_payload->>'availability_mode') not in ('continuous', 'weekly') then
    raise exception 'Invalid availability mode' using errcode = '22023';
  end if;
  if (p_payload->>'availability_mode') = 'continuous'
      and jsonb_array_length(p_schedules) <> 0 then
    raise exception 'Continuous deals cannot have weekly windows' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_schedules) as s(day_of_week integer)
    group by s.day_of_week having count(*) > 1
  ) then
    raise exception 'Duplicate weekday' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_array(s.day_of_week, s.start_time,
    s.end_time, s.spans_midnight) order by s.day_of_week, s.start_time), '[]'::jsonb)
  into new_windows from jsonb_to_recordset(p_schedules) as s(
    day_of_week integer, start_time time, end_time time, spans_midnight boolean);

  if p_deal_id is null then
    insert into public.deals(business_id, owner_id, title, description,
      promotion_type, is_active, starts_at, ends_at, availability_mode,
      availability_timezone, status, updated_at)
    values (destination_business, owner_uuid, p_payload->>'title',
      p_payload->>'description', p_payload->>'promotion_type',
      (p_payload->>'is_active')::boolean,
      (p_payload->>'starts_at')::timestamptz,
      (p_payload->>'ends_at')::timestamptz,
      p_payload->>'availability_mode', p_payload->>'availability_timezone',
      (p_payload->>'status')::public.deal_status, now())
    returning id into saved_id;
  else
    if not pg_try_advisory_xact_lock(hashtextextended(p_deal_id::text, 0)) then
      raise exception 'Deal edit is already in progress' using errcode = '55P03';
    end if;
    select d.* into old_deal from public.deals d
      join public.businesses current_business on current_business.id = d.business_id
      where d.id = p_deal_id and d.owner_id = owner_uuid
        and current_business.owner_id = owner_uuid
      for update of d nowait;
    if not found then
      raise exception 'Deal is not owned by caller' using errcode = '42501';
    end if;
    if p_edit_token is null or old_deal.timed_edit_token_hash
        is distinct from md5(p_edit_token::text)
        or old_deal.timed_edit_expires_at <= clock_timestamp() then
      raise exception 'Deal edit lease expired' using errcode = '55P03';
    end if;
    saved_id := old_deal.id;
    select coalesce(jsonb_agg(jsonb_build_array(s.day_of_week, s.start_time,
      s.end_time, s.spans_midnight) order by s.day_of_week, s.start_time), '[]'::jsonb)
    into old_windows from public.deal_schedules s where s.deal_id = saved_id;
    timing_changed := old_deal.availability_mode is distinct from p_payload->>'availability_mode'
      or old_deal.availability_timezone is distinct from p_payload->>'availability_timezone'
      or old_deal.starts_at is distinct from (p_payload->>'starts_at')::timestamptz
      or old_deal.ends_at is distinct from (p_payload->>'ends_at')::timestamptz
      or old_windows is distinct from new_windows;
    update public.deals set business_id = destination_business,
      title = p_payload->>'title', description = p_payload->>'description',
      promotion_type = p_payload->>'promotion_type',
      is_active = (p_payload->>'is_active')::boolean,
      starts_at = (p_payload->>'starts_at')::timestamptz,
      ends_at = (p_payload->>'ends_at')::timestamptz,
      availability_mode = p_payload->>'availability_mode',
      availability_timezone = p_payload->>'availability_timezone',
      status = (p_payload->>'status')::public.deal_status,
      timed_edit_generation = timed_edit_generation + case when timing_changed then 1 else 0 end,
      timed_edit_token_hash = null, timed_edit_expires_at = null,
      updated_at = now() where id = saved_id;
    delete from public.deal_schedules where deal_id = saved_id;
  end if;
  insert into public.deal_schedules(deal_id, day_of_week, start_time,
    end_time, spans_midnight)
  select saved_id, s.day_of_week, s.start_time, s.end_time, s.spans_midnight
  from jsonb_to_recordset(p_schedules) as s(day_of_week integer,
    start_time time, end_time time, spans_midnight boolean);
  return saved_id;
end;
$$;
revoke all on function public.save_owner_deal(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_owner_deal(uuid, uuid, jsonb, jsonb) to authenticated;
-- Schedule writes from clients would bypass the atomic save contract.
revoke insert, update, delete on public.deal_schedules from authenticated;
revoke insert, update on public.deals from authenticated;

alter table public.notification_preferences
  add column starting_soon_minutes smallint,
  add column ending_soon_minutes smallint,
  add constraint notification_preferences_starting_minutes_check
    check (starting_soon_minutes is null or starting_soon_minutes in (30, 60, 120)),
  add constraint notification_preferences_ending_minutes_check
    check (ending_soon_minutes is null or ending_soon_minutes in (30, 60));

-- Historical Starting Soon true values are not evidence of Phase 4 consent.
-- Ending Soon has always defaulted false, so its existing true values are explicit.
update public.notification_preferences
set ending_soon_minutes = 30
where saved_business_deal_ending_soon = true;

alter table public.notification_events
  drop constraint notification_events_one_per_deal,
  drop constraint notification_events_event_type_check,
  add column occurrence_key text not null default 'deal',
  add column occurrence_start_at timestamptz,
  add column occurrence_end_at timestamptz,
  add column occurrence_local_date date,
  add column occurrence_timezone text,
  add column source_fingerprint text,
  add column source_observed_at timestamptz,
  add column next_scan_at timestamptz,
  add column timed_edit_generation bigint,
  add constraint notification_events_event_type_check check (
    event_type in ('saved_business_new_deal',
      'saved_business_deal_starting_soon', 'saved_business_deal_ending_soon')
  ),
  add constraint notification_events_timed_shape_check check (
    event_type = 'saved_business_new_deal'
    or (occurrence_start_at is not null or occurrence_end_at is not null)
      and occurrence_local_date is not null
      and occurrence_timezone is not null and source_fingerprint is not null
      and source_observed_at is not null
      and timed_edit_generation is not null
      and char_length(occurrence_key) between 1 and 40
  );

create unique index notification_events_new_deal_once_idx
  on public.notification_events(event_type, deal_id)
  where event_type = 'saved_business_new_deal';
create unique index notification_events_timed_occurrence_idx
  on public.notification_events(event_type, deal_id, occurrence_key)
  where event_type in ('saved_business_deal_starting_soon',
    'saved_business_deal_ending_soon');
create index notification_events_timed_scan_idx
  on public.notification_events(next_scan_at, id)
  where event_type in ('saved_business_deal_starting_soon',
    'saved_business_deal_ending_soon') and scan_complete = false;

alter table public.notification_deliveries
  add column lead_minutes smallint,
  add column intended_due_at timestamptz,
  add column deadline_at timestamptz,
  add column logical_alert_key text,
  add column timed_edit_generation bigint,
  add constraint notification_deliveries_timed_shape_check check (
    (lead_minutes is null and intended_due_at is null and deadline_at is null
      and logical_alert_key is null and timed_edit_generation is null)
    or (lead_minutes in (30, 60, 120) and intended_due_at is not null
      and deadline_at is not null and intended_due_at < deadline_at
      and logical_alert_key is not null and timed_edit_generation is not null)
  );
create unique index notification_deliveries_logical_alert_idx
  on public.notification_deliveries(device_id, logical_alert_key)
  where logical_alert_key is not null;
create index notification_deliveries_timed_due_idx
  on public.notification_deliveries(deadline_at, intended_due_at, id)
  where status = 'pending' and intended_due_at is not null;

-- The first candidate after a timing edit is conservatively suppressed for a
-- device that already received (or may have received) that boundary type.
-- Subsequent weekly occurrences remain eligible. This ledger survives event
-- snapshot updates and schedule-row replacement.
create table public.notification_timed_edit_suppressions (
  deal_id uuid not null references public.deals(id) on delete cascade,
  event_type text not null check (event_type in
    ('saved_business_deal_starting_soon', 'saved_business_deal_ending_soon')),
  device_id uuid not null references public.notification_devices(id) on delete cascade,
  timed_edit_generation bigint not null,
  occurrence_key text not null,
  primary key (deal_id, event_type, device_id, timed_edit_generation)
);
alter table public.notification_timed_edit_suppressions enable row level security;
revoke all on public.notification_timed_edit_suppressions from public, anon, authenticated;
grant select, insert on public.notification_timed_edit_suppressions to service_role;

-- The original New Deal trigger must use its partial unique index.
create or replace function public.enqueue_new_deal_push_event()
returns trigger language plpgsql security definer
set search_path = pg_catalog, pg_temp as $$
begin
  insert into public.notification_events(event_type, deal_id, business_id)
  values ('saved_business_new_deal', new.id, new.business_id)
  on conflict do nothing;
  return new;
end;
$$;

-- Phase 3 scanners and claimers must never consume timed events.
create or replace function public.scan_new_deal_push_audience(p_limit integer default 10)
returns integer language plpgsql security invoker
set search_path = pg_catalog, pg_temp as $$
declare
  event_row public.notification_events%rowtype;
  target_row record;
  scanned integer := 0;
begin
  if p_limit < 1 or p_limit > 10 then raise exception 'Invalid batch size'; end if;
  select e.* into event_row
  from public.notification_events e
  join public.deals d on d.id = e.deal_id
  where e.event_type = 'saved_business_new_deal' and not e.scan_complete
    and (d.availability_mode <> 'weekly'
      or exists (select 1 from public.deal_schedules s where s.deal_id = d.id))
  order by e.created_at, e.id
  for update of e skip locked limit 1;
  if not found then return 0; end if;
  for target_row in
    select f.user_id, n.id as device_id
    from public.favorites f
    join public.notification_preferences p on p.user_id = f.user_id
      and p.saved_business_new_deals = true
    join public.notification_devices n on n.user_id = f.user_id
      and n.provider = 'webpush' and n.platform = 'web'
      and n.enabled = true and n.disabled_at is null
      and (n.expires_at is null or n.expires_at > now())
    where f.business_id = event_row.business_id
      and (event_row.cursor_user_id is null
        or (f.user_id, n.id) > (event_row.cursor_user_id, event_row.cursor_device_id))
    order by f.user_id, n.id limit p_limit
  loop
    insert into public.notification_deliveries(event_id, user_id, device_id)
    values (event_row.id, target_row.user_id, target_row.device_id)
    on conflict (event_id, device_id) do nothing;
    update public.notification_events
    set cursor_user_id = target_row.user_id, cursor_device_id = target_row.device_id
    where id = event_row.id;
    scanned := scanned + 1;
  end loop;
  if scanned < p_limit then
    update public.notification_events set scan_complete = true where id = event_row.id;
  end if;
  return scanned;
end;
$$;

create or replace function public.claim_new_deal_push_deliveries(p_limit integer default 10)
returns table(delivery_id uuid, event_id uuid, user_id uuid, device_id uuid,
  claim_token uuid, attempts integer)
language sql security invoker set search_path = pg_catalog, pg_temp as $$
  with candidates as (
    select d.id from public.notification_deliveries d
    join public.notification_events e on e.id = d.event_id
    where p_limit between 1 and 10 and e.event_type = 'saved_business_new_deal'
      and d.attempts < 4 and d.status = 'pending' and d.next_attempt_at <= now()
    order by d.next_attempt_at, d.id for update of d skip locked limit p_limit
  ), claimed as (
    update public.notification_deliveries d
    set status = 'sending', attempts = d.attempts + 1,
      claim_token = gen_random_uuid(), lease_expires_at = now() + interval '5 minutes'
    from candidates c where d.id = c.id
    returning d.id, d.event_id, d.user_id, d.device_id, d.claim_token, d.attempts
  ) select * from claimed;
$$;

create table public.notification_timed_discovery_state (
  singleton boolean primary key default true check (singleton),
  cursor_deal_id uuid
);
insert into public.notification_timed_discovery_state(singleton) values (true);
alter table public.notification_timed_discovery_state enable row level security;
revoke all on public.notification_timed_discovery_state from public, anon, authenticated;
grant select, update on public.notification_timed_discovery_state to service_role;

create function public.next_timed_discovery_deals(p_limit integer default 10)
returns table(deal_id uuid) language plpgsql security invoker
set search_path = pg_catalog, pg_temp as $$
declare cursor_id uuid;
declare batch_ids uuid[];
begin
  if p_limit < 1 or p_limit > 20 then raise exception 'Invalid batch size'; end if;
  select s.cursor_deal_id into cursor_id
  from public.notification_timed_discovery_state s where singleton = true for update;
  select array_agg(batch.id order by batch.id) into batch_ids from (
    select d.id from public.deals d
    where cursor_id is null or d.id > cursor_id
    order by d.id limit p_limit
  ) batch;
  update public.notification_timed_discovery_state
  set cursor_deal_id = batch_ids[array_length(batch_ids, 1)] where singleton = true;
  return query select unnest(batch_ids);
end;
$$;
revoke all on function public.next_timed_discovery_deals(integer) from public, anon, authenticated;
grant execute on function public.next_timed_discovery_deals(integer) to service_role;

create function public.scan_timed_push_audience(p_limit integer default 20)
returns integer language plpgsql security invoker
set search_path = pg_catalog, pg_temp as $$
declare
  e public.notification_events%rowtype;
  target record;
  scanned integer := 0;
  lead integer;
  boundary_at timestamptz;
  due_at timestamptz;
  cutoff_at timestamptz;
begin
  if p_limit < 1 or p_limit > 20 then raise exception 'Invalid batch size'; end if;
  select ne.* into e from public.notification_events ne
  where ne.event_type in ('saved_business_deal_starting_soon',
    'saved_business_deal_ending_soon') and not ne.scan_complete
    and ne.next_scan_at <= now()
    and exists (select 1 from public.deals d
      join public.businesses b on b.id = d.business_id
      where d.id = ne.deal_id and d.is_active = true
        and d.timed_edit_token_hash is null
        and d.timed_edit_generation = ne.timed_edit_generation
        and d.status not in ('paused', 'ended') and b.is_active = true)
  order by ne.next_scan_at,
    least(coalesce(ne.occurrence_start_at, 'infinity'::timestamptz),
    coalesce(ne.occurrence_end_at, 'infinity'::timestamptz)) - interval '120 minutes',
    ne.id
  for update skip locked limit 1;
  if not found then return 0; end if;
  boundary_at := case when e.event_type = 'saved_business_deal_starting_soon'
    then e.occurrence_start_at else e.occurrence_end_at end;
  if boundary_at is null or boundary_at <= now() then
    update public.notification_events set scan_complete = true where id = e.id;
    return 0;
  end if;

  for target in
    select f.user_id, n.id as device_id,
      case when e.event_type = 'saved_business_deal_starting_soon'
        then p.starting_soon_minutes else p.ending_soon_minutes end as minutes
    from public.favorites f
    join public.notification_preferences p on p.user_id = f.user_id
    join public.notification_devices n on n.user_id = f.user_id
      and n.provider = 'webpush' and n.platform = 'web'
      and n.enabled = true and n.disabled_at is null
      and (n.expires_at is null or n.expires_at > now())
    where f.business_id = e.business_id
      and ((e.event_type = 'saved_business_deal_starting_soon'
        and p.saved_business_deal_starting_soon = true
        and p.starting_soon_minutes in (30, 60, 120))
        or (e.event_type = 'saved_business_deal_ending_soon'
        and p.saved_business_deal_ending_soon = true
        and p.ending_soon_minutes in (30, 60)))
      and (e.cursor_user_id is null
        or (f.user_id, n.id) > (e.cursor_user_id, e.cursor_device_id))
    order by f.user_id, n.id limit p_limit
  loop
    lead := target.minutes;
    due_at := boundary_at - make_interval(mins => lead);
    cutoff_at := least(due_at + interval '10 minutes', boundary_at);
    if cutoff_at > now() and (e.event_type = 'saved_business_deal_starting_soon'
      or e.occurrence_start_at is null or due_at >= e.occurrence_start_at) then
      if exists (
        select 1 from public.notification_deliveries old_delivery
        join public.notification_events old_event on old_event.id = old_delivery.event_id
        where old_event.deal_id = e.deal_id and old_event.event_type = e.event_type
          and old_delivery.device_id = target.device_id
          and old_delivery.status in ('sent', 'uncertain')
          and old_delivery.timed_edit_generation < e.timed_edit_generation
      ) then
        insert into public.notification_timed_edit_suppressions
          (deal_id, event_type, device_id, timed_edit_generation, occurrence_key)
        values (e.deal_id, e.event_type, target.device_id,
          e.timed_edit_generation, e.occurrence_key)
        on conflict do nothing;
      end if;
      if not exists (
        select 1 from public.notification_timed_edit_suppressions suppression
        where suppression.deal_id = e.deal_id
          and suppression.event_type = e.event_type
          and suppression.device_id = target.device_id
          and suppression.timed_edit_generation = e.timed_edit_generation
          and suppression.occurrence_key = e.occurrence_key
      ) then
      insert into public.notification_deliveries
        (event_id, user_id, device_id, lead_minutes, intended_due_at,
          deadline_at, next_attempt_at, logical_alert_key, timed_edit_generation)
      values (e.id, target.user_id, target.device_id, lead, due_at,
        cutoff_at, greatest(due_at, now()),
        e.deal_id::text || ':' || e.event_type || ':' || e.occurrence_local_date::text,
        e.timed_edit_generation)
      on conflict do nothing;
      update public.notification_deliveries d
      set lead_minutes = lead, intended_due_at = due_at,
        deadline_at = cutoff_at,
        timed_edit_generation = e.timed_edit_generation,
        next_attempt_at = greatest(d.next_attempt_at, due_at, now())
      where d.event_id = e.id and d.device_id = target.device_id
        and d.status = 'pending' and d.attempts < 4;
      end if;
    end if;
    update public.notification_events set cursor_user_id = target.user_id,
      cursor_device_id = target.device_id where id = e.id;
    scanned := scanned + 1;
  end loop;
  update public.notification_events
  set cursor_user_id = case when scanned < p_limit then null else cursor_user_id end,
    cursor_device_id = case when scanned < p_limit then null else cursor_device_id end,
    next_scan_at = now() + interval '2 minutes' where id = e.id;
  return scanned;
end;
$$;
revoke all on function public.scan_timed_push_audience(integer) from public, anon, authenticated;
grant execute on function public.scan_timed_push_audience(integer) to service_role;

create function public.claim_timed_push_deliveries(p_limit integer default 5)
returns table(delivery_id uuid, event_id uuid, user_id uuid, device_id uuid,
  claim_token uuid, attempts integer)
language sql security invoker set search_path = pg_catalog, pg_temp as $$
  with candidates as (
    select d.id from public.notification_deliveries d
    join public.notification_events e on e.id = d.event_id
    join public.deals deal on deal.id = e.deal_id
    where p_limit between 1 and 10
      and e.event_type in ('saved_business_deal_starting_soon',
        'saved_business_deal_ending_soon')
      and d.attempts < 4 and d.status = 'pending'
      and d.intended_due_at <= now() and d.next_attempt_at <= now()
      and d.deadline_at > now()
      and deal.timed_edit_token_hash is null
      and deal.timed_edit_generation = e.timed_edit_generation
      and d.timed_edit_generation = e.timed_edit_generation
      and e.source_observed_at <= now() - interval '2 minutes'
    order by d.deadline_at, d.intended_due_at, d.id
    for update of d skip locked limit p_limit
  ), claimed as (
    update public.notification_deliveries d
    set status = 'sending', attempts = d.attempts + 1,
      claim_token = gen_random_uuid(), lease_expires_at = now() + interval '5 minutes'
    from candidates c where d.id = c.id
    returning d.id, d.event_id, d.user_id, d.device_id, d.claim_token, d.attempts
  ) select * from claimed;
$$;
revoke all on function public.claim_timed_push_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_timed_push_deliveries(integer) to service_role;

create function public.skip_expired_timed_push_deliveries(p_limit integer default 20)
returns integer language plpgsql security invoker
set search_path = pg_catalog, pg_temp as $$
declare skipped integer;
begin
  if p_limit < 1 or p_limit > 20 then raise exception 'Invalid batch size'; end if;
  with expired as (
    select id from public.notification_deliveries
    where status = 'pending' and deadline_at is not null and deadline_at <= now()
    order by deadline_at, id for update skip locked limit p_limit
  ) update public.notification_deliveries d set status = 'skipped'
    from expired x where d.id = x.id;
  get diagnostics skipped = row_count;
  return skipped;
end;
$$;
revoke all on function public.skip_expired_timed_push_deliveries(integer) from public, anon, authenticated;
grant execute on function public.skip_expired_timed_push_deliveries(integer) to service_role;

commit;
