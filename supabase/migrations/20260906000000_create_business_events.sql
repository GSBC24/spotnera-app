create table if not exists public.business_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  event_type text not null,
  deal_id uuid null references public.deals(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint business_events_event_type_check check (
    event_type in (
      'profile_view',
      'deal_view',
      'website_click',
      'call_click',
      'email_click',
      'social_click',
      'favorite_add',
      'favorite_remove',
      'business_share',
      'business_link_copy'
    )
  ),
  constraint business_events_deal_view_has_deal_check check (
    (event_type = 'deal_view' and deal_id is not null)
    or (event_type <> 'deal_view' and deal_id is null)
  )
);

create index if not exists business_events_business_id_idx
  on public.business_events(business_id);

create index if not exists business_events_event_type_idx
  on public.business_events(event_type);

create index if not exists business_events_created_at_idx
  on public.business_events(created_at desc);

create index if not exists business_events_business_created_idx
  on public.business_events(business_id, created_at desc);

alter table public.business_events enable row level security;

grant usage on schema public to anon, authenticated;
revoke all on public.business_events from anon, authenticated;
grant insert on public.business_events to anon, authenticated;
grant select on public.business_events to authenticated;

drop policy if exists "Owners can read analytics for their businesses" on public.business_events;
create policy "Owners can read analytics for their businesses"
  on public.business_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = business_events.business_id
        and businesses.owner_id = auth.uid()
    )
  );

drop policy if exists "Visitors can insert public business engagement events" on public.business_events;
create policy "Visitors can insert public business engagement events"
  on public.business_events
  for insert
  to anon, authenticated
  with check (
    event_type in (
      'profile_view',
      'deal_view',
      'website_click',
      'call_click',
      'email_click',
      'social_click',
      'favorite_add',
      'favorite_remove',
      'business_share',
      'business_link_copy'
    )
    and exists (
      select 1
      from public.businesses
      where businesses.id = business_events.business_id
        and businesses.is_active
    )
    and (
      (
        event_type <> 'deal_view'
        and deal_id is null
      )
      or exists (
        select 1
        from public.deals
        where deals.id = business_events.deal_id
          and deals.business_id = business_events.business_id
          and deals.is_active
          and (deals.starts_at is null or deals.starts_at <= now())
          and (deals.ends_at is null or deals.ends_at > now())
      )
    )
    and (
      event_type not in ('favorite_add', 'favorite_remove')
      or auth.uid() is not null
    )
  );

create or replace function public.get_owner_business_event_counts(range_key text default '30d')
returns table (
  business_id uuid,
  event_type text,
  event_date date,
  event_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select case
      when range_key = '7d' then now() - interval '7 days'
      when range_key = '30d' then now() - interval '30 days'
      else null
    end as starts_at
  )
  select
    business_events.business_id,
    business_events.event_type,
    business_events.created_at::date as event_date,
    count(*) as event_count
  from public.business_events
  join public.businesses
    on businesses.id = business_events.business_id
  cross join params
  where businesses.owner_id = auth.uid()
    and business_events.event_type in (
      'profile_view',
      'deal_view',
      'website_click',
      'call_click',
      'email_click',
      'social_click',
      'business_share',
      'business_link_copy'
    )
    and (params.starts_at is null or business_events.created_at >= params.starts_at)
  group by
    business_events.business_id,
    business_events.event_type,
    business_events.created_at::date
  order by event_date asc, event_type asc;
$$;

revoke all on function public.get_owner_business_event_counts(text) from public;
grant execute on function public.get_owner_business_event_counts(text) to authenticated;
