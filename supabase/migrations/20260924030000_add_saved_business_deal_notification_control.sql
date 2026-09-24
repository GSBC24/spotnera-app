-- A saved business remains eligible by default; the owner of the saved relationship
-- can turn off deal notifications without changing the global preferences.
begin;

alter table public.favorites
  add column deal_notifications_enabled boolean not null default true;

-- An older analytics policy also allowed owners to read individual favorite
-- rows. Owner counts now use the aggregate RPC, so keep this private setting
-- readable only by the customer who saved the business.
drop policy if exists "Users can read their own favorites" on public.favorites;
create policy "Users can read their own favorites"
  on public.favorites for select to authenticated
  using (user_id = auth.uid());

revoke update on public.favorites from public, anon, authenticated;
grant update (deal_notifications_enabled) on public.favorites to authenticated;

create policy "Users can update their own saved business deal notifications"
  on public.favorites for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Both audience scanners continue to require the existing global preference,
-- eligible device, and event-specific rules in addition to this per-business gate.

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
    where f.deal_notifications_enabled = true
      and f.business_id = event_row.business_id
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

create or replace function public.scan_timed_push_audience(p_limit integer default 20)
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
    where f.deal_notifications_enabled = true
      and f.business_id = e.business_id
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

commit;
