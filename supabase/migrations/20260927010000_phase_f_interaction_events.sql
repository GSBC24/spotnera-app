begin;

alter table public.business_events
  add column source text,
  add constraint business_events_source_check check (
    source is null or source in ('deals', 'saved', 'map', 'business_profile', 'search')
  );

alter table public.business_events drop constraint business_events_event_type_check;
alter table public.business_events add constraint business_events_event_type_check check (
  event_type in (
    'profile_view', 'business_view', 'deal_view', 'deal_click', 'deal_save',
    'website_click', 'directions_click', 'call_click', 'email_click',
    'social_click', 'favorite_add', 'favorite_remove', 'business_share', 'business_link_copy'
  )
);

alter table public.business_events drop constraint business_events_deal_view_has_deal_check;
alter table public.business_events add constraint business_events_deal_context_check check (
  (event_type in ('deal_view', 'deal_click', 'deal_save') and deal_id is not null)
  or (event_type not in ('deal_view', 'deal_click', 'deal_save') and deal_id is null)
);

create index business_events_business_type_created_idx
  on public.business_events (business_id, event_type, created_at desc);
create index business_events_deal_type_created_idx
  on public.business_events (deal_id, event_type, created_at desc)
  where deal_id is not null;

-- Browser clients use the validated server route. Owners retain aggregate access only.
revoke insert, select on public.business_events from anon, authenticated;
drop policy if exists "Visitors can insert public business engagement events" on public.business_events;
drop policy if exists "Owners can read analytics for their businesses" on public.business_events;

create or replace function public.get_owner_business_event_counts(range_key text default '30d')
returns table (business_id uuid, event_type text, event_date date, event_count bigint)
language plpgsql stable security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if range_key is null or range_key not in ('7d', '30d', 'all') then
    raise exception 'Invalid analytics range' using errcode = '22023';
  end if;

  return query
    with params as (
      select case
        when range_key = '7d' then now() - interval '7 days'
        when range_key = '30d' then now() - interval '30 days'
        when range_key = 'all' then null
      end as starts_at
    )
    select e.business_id,
      -- Keep the existing owner Profile views metric while new raw rows use business_view.
      case when e.event_type = 'business_view' then 'profile_view' else e.event_type end as event_type,
      e.created_at::date as event_date,
      count(*) as event_count
    from public.business_events e
    join public.businesses b on b.id = e.business_id
    cross join params
    where b.owner_id = (select auth.uid())
      and e.event_type in (
        'profile_view', 'business_view', 'deal_view', 'deal_click', 'deal_save',
        'website_click', 'directions_click', 'call_click', 'email_click',
        'social_click', 'business_share', 'business_link_copy'
      )
      and (params.starts_at is null or e.created_at >= params.starts_at)
    group by e.business_id,
      case when e.event_type = 'business_view' then 'profile_view' else e.event_type end,
      e.created_at::date
    order by 3 asc, 2 asc;
end;
$$;

revoke all on function public.get_owner_business_event_counts(text) from public, anon;
grant execute on function public.get_owner_business_event_counts(text) to authenticated;

commit;
