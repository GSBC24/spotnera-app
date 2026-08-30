alter table public.deals
  add column if not exists is_active boolean not null default true;

update public.deals
set is_active = false
where status in ('paused', 'ended')
  and is_active is distinct from false;

create index if not exists deals_is_active_idx on public.deals(is_active);
