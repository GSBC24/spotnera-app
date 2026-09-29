begin;

-- Membership is provisioned manually by a trusted database operator. No client role
-- can read or change it; the application checks it after auth.getUser().
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from public, anon, authenticated;
grant select on public.platform_admins to service_role;

alter table public.businesses
  add column verified_at timestamptz,
  add column suspended_at timestamptz;
alter table public.deals add column admin_disabled_at timestamptz;
alter table public.reviews add column admin_hidden_at timestamptz;

create index businesses_suspended_at_idx on public.businesses(suspended_at)
  where suspended_at is not null;
create index deals_admin_disabled_at_idx on public.deals(admin_disabled_at)
  where admin_disabled_at is not null;

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  action text not null check (action in (
    'BUSINESS_VERIFIED', 'BUSINESS_VERIFICATION_REMOVED',
    'BUSINESS_SUSPENDED', 'BUSINESS_RESTORED',
    'DEAL_DISABLED', 'DEAL_RESTORED',
    'REVIEW_HIDDEN', 'REVIEW_RESTORED')),
  admin_user_id uuid not null,
  target_type text not null check (target_type in ('business', 'deal', 'review')),
  target_id uuid not null,
  reason text,
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_at_idx on public.admin_audit_log(created_at desc);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from public, anon, authenticated;
grant select on public.admin_audit_log to service_role;

-- Owner writes must never set or clear administrative state, including writes
-- made through existing SECURITY DEFINER owner deal functions.
create function public.protect_admin_moderation_state()
returns trigger language plpgsql set search_path = pg_catalog, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if tg_table_name = 'businesses' and
      (new.verified_at is not null or new.suspended_at is not null) then
      raise exception 'Administrative business state is read only' using errcode = '42501';
    elsif tg_table_name = 'deals' and new.admin_disabled_at is not null then
      raise exception 'Administrative deal state is read only' using errcode = '42501';
    elsif tg_table_name = 'reviews' and new.admin_hidden_at is not null then
      raise exception 'Administrative review state is read only' using errcode = '42501';
    end if;
    return new;
  end if;
  if current_user <> (
    select pg_catalog.pg_get_userbyid(p.proowner)
    from pg_catalog.pg_proc p
    where p.oid = 'public.perform_admin_action(text,uuid,text,text)'::pg_catalog.regprocedure
  ) then
    if tg_table_name = 'businesses' and
      (new.verified_at is distinct from old.verified_at or
       new.suspended_at is distinct from old.suspended_at) then
      raise exception 'Administrative business state is read only' using errcode = '42501';
    elsif tg_table_name = 'deals' and
      new.admin_disabled_at is distinct from old.admin_disabled_at then
      raise exception 'Administrative deal state is read only' using errcode = '42501';
    elsif tg_table_name = 'reviews' and
      new.admin_hidden_at is distinct from old.admin_hidden_at then
      raise exception 'Administrative review state is read only' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_admin_moderation_state() from public, anon, authenticated;
create trigger protect_business_admin_state before insert or update on public.businesses
  for each row execute function public.protect_admin_moderation_state();
create trigger protect_deal_admin_state before insert or update on public.deals
  for each row execute function public.protect_admin_moderation_state();
create trigger protect_review_admin_state before insert or update on public.reviews
  for each row execute function public.protect_admin_moderation_state();

-- Atomic state change and audit entry. The authenticated JWT identity is checked
-- inside the transaction; a second identical submission is a no-op.
create function public.perform_admin_action(
  p_action text, p_target_id uuid, p_reason text default null, p_admin_note text default null
) returns boolean language plpgsql security definer
set search_path = pg_catalog, pg_temp as $$
declare
  changed_count integer;
  target_kind text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_target_id is null or p_action not in (
    'BUSINESS_VERIFIED', 'BUSINESS_VERIFICATION_REMOVED',
    'BUSINESS_SUSPENDED', 'BUSINESS_RESTORED',
    'DEAL_DISABLED', 'DEAL_RESTORED', 'REVIEW_HIDDEN', 'REVIEW_RESTORED'
  ) or p_action is null then
    raise exception 'Invalid admin action' using errcode = '22023';
  end if;
  if p_admin_note is not null and char_length(trim(p_admin_note)) > 500 then
    raise exception 'Admin note is too long' using errcode = '22023';
  end if;
  if p_action in ('BUSINESS_SUSPENDED', 'DEAL_DISABLED', 'REVIEW_HIDDEN') and
    (p_reason is null or p_reason not in ('Misleading information', 'Spam',
      'Inappropriate content', 'Fake business', 'Terms violation', 'Other')) then
    raise exception 'A moderation reason is required' using errcode = '22023';
  end if;
  if p_action = 'BUSINESS_VERIFIED' then
    update public.businesses set verified_at = now()
      where id = p_target_id and verified_at is null;
  elsif p_action = 'BUSINESS_VERIFICATION_REMOVED' then
    update public.businesses set verified_at = null
      where id = p_target_id and verified_at is not null;
  elsif p_action = 'BUSINESS_SUSPENDED' then
    update public.businesses set suspended_at = now()
      where id = p_target_id and suspended_at is null;
  elsif p_action = 'BUSINESS_RESTORED' then
    update public.businesses set suspended_at = null
      where id = p_target_id and suspended_at is not null;
  elsif p_action = 'DEAL_DISABLED' then
    update public.deals set admin_disabled_at = now()
      where id = p_target_id and admin_disabled_at is null;
  elsif p_action = 'DEAL_RESTORED' then
    update public.deals set admin_disabled_at = null
      where id = p_target_id and admin_disabled_at is not null;
  elsif p_action = 'REVIEW_HIDDEN' then
    update public.reviews set admin_hidden_at = now()
      where id = p_target_id and admin_hidden_at is null;
  elsif p_action = 'REVIEW_RESTORED' then
    update public.reviews set admin_hidden_at = null
      where id = p_target_id and admin_hidden_at is not null;
  end if;
  get diagnostics changed_count = row_count;
  if changed_count = 0 then return false; end if;
  target_kind := case when p_action like 'BUSINESS_%' then 'business'
    when p_action like 'DEAL_%' then 'deal' else 'review' end;
  insert into public.admin_audit_log
    (action, admin_user_id, target_type, target_id, reason, admin_note)
  values (p_action, auth.uid(), target_kind, p_target_id,
    case when p_action in ('BUSINESS_SUSPENDED', 'DEAL_DISABLED', 'REVIEW_HIDDEN')
      then p_reason else null end, nullif(trim(p_admin_note), ''));
  return true;
end;
$$;
revoke all on function public.perform_admin_action(text, uuid, text, text)
  from public, anon;
grant execute on function public.perform_admin_action(text, uuid, text, text)
  to authenticated;

-- These are the existing public SELECT policies with only the moderation gates
-- added. Owners retain reads of their own suspended, disabled, and hidden data.
drop policy "Public users can read active businesses" on public.businesses;
create policy "Public users can read active businesses" on public.businesses
  for select to anon, authenticated
  using (owner_id = auth.uid() or (is_active and suspended_at is null));

drop policy "Public users can read live deals for active businesses" on public.deals;
create policy "Public users can read live deals for active businesses" on public.deals
  for select to anon, authenticated using (
    exists (select 1 from public.businesses b where b.id = deals.business_id
      and (b.owner_id = auth.uid() or
        (b.is_active and b.suspended_at is null and deals.is_active
         and deals.admin_disabled_at is null
         and (deals.ends_at is null or deals.ends_at > now()))))
  );

drop policy "Public users can read reviews for active businesses" on public.reviews;
create policy "Public users can read reviews for active businesses" on public.reviews
  for select to anon, authenticated using (
    user_id = auth.uid() or exists (
      select 1 from public.businesses b where b.id = reviews.business_id
        and (b.owner_id = auth.uid() or
          (b.is_active and b.suspended_at is null and reviews.admin_hidden_at is null))
    )
  );

commit;
