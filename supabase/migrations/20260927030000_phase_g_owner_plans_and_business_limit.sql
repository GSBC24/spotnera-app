begin;

-- SQL Editor and linked Supabase migrations run as postgres. Fail before any
-- DDL if a different role would become the SECURITY DEFINER function owner.
do $$
begin
  if current_user <> 'postgres'
    or not exists (
      select 1 from pg_catalog.pg_roles
      where rolname = current_user and (rolsuper or rolbypassrls)
    )
    or not pg_catalog.has_table_privilege(current_user, 'auth.users', 'SELECT')
    or not pg_catalog.has_table_privilege(current_user, 'auth.users', 'UPDATE')
    or not pg_catalog.has_table_privilege(current_user, 'public.businesses', 'SELECT') then
    raise exception 'Phase G requires postgres with auth.users lock and business read privileges';
  end if;
end;
$$;

create table public.owner_account_plans (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'FREE' check (plan in ('FREE', 'PREMIUM')),
  updated_at timestamptz not null default now()
);

alter table public.owner_account_plans enable row level security;

create policy "Owners can read their account plan"
  on public.owner_account_plans for select to authenticated
  using (owner_id = (select auth.uid()));

revoke all on public.owner_account_plans from public, anon, authenticated, service_role;
grant select on public.owner_account_plans to authenticated;

-- Check effective grants, including any inherited grants from other roles.
do $$
begin
  if pg_catalog.has_table_privilege('anon', 'public.owner_account_plans', 'SELECT')
    or pg_catalog.has_table_privilege('anon', 'public.owner_account_plans', 'INSERT')
    or pg_catalog.has_table_privilege('anon', 'public.owner_account_plans', 'UPDATE')
    or pg_catalog.has_table_privilege('anon', 'public.owner_account_plans', 'DELETE')
    or not pg_catalog.has_table_privilege('authenticated', 'public.owner_account_plans', 'SELECT')
    or pg_catalog.has_table_privilege('authenticated', 'public.owner_account_plans', 'INSERT')
    or pg_catalog.has_table_privilege('authenticated', 'public.owner_account_plans', 'UPDATE')
    or pg_catalog.has_table_privilege('authenticated', 'public.owner_account_plans', 'DELETE')
    or pg_catalog.has_table_privilege('service_role', 'public.owner_account_plans', 'SELECT')
    or pg_catalog.has_table_privilege('service_role', 'public.owner_account_plans', 'INSERT')
    or pg_catalog.has_table_privilege('service_role', 'public.owner_account_plans', 'UPDATE')
    or pg_catalog.has_table_privilege('service_role', 'public.owner_account_plans', 'DELETE') then
    raise exception 'Phase G owner plan grants differ from intended access';
  end if;
end;
$$;

-- An absent row means FREE, including for all existing owners. Only a trusted
-- database administrator may add or change a PREMIUM row in this phase.
create function public.enforce_owner_business_limit()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_plan text;
  business_count integer;
begin
  -- Higher isolation levels can retain a pre-lock snapshot for the count.
  -- The normal Supabase insert path is READ COMMITTED; reject other modes.
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Business creation requires READ COMMITTED isolation';
  end if;

  if new.owner_id is null then
    raise exception 'A new business must have an owner';
  end if;

  -- This row lock serializes every insert for the same owner. Under the normal
  -- READ COMMITTED isolation level, the count below sees preceding commits.
  perform 1 from auth.users where id = new.owner_id for update;
  if not found then
    raise exception 'Business owner account does not exist';
  end if;

  select plan into current_plan
  from public.owner_account_plans
  where owner_id = new.owner_id;

  if coalesce(current_plan, 'FREE') = 'PREMIUM' then
    return new;
  end if;

  select count(*) into business_count
  from public.businesses
  where owner_id = new.owner_id;

  if business_count >= 5 then
    raise exception using
      errcode = 'P0001',
      message = 'FREE_BUSINESS_LIMIT_REACHED';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_owner_business_limit() from public, anon, authenticated, service_role;

do $$
begin
  if pg_catalog.has_function_privilege('anon', 'public.enforce_owner_business_limit()', 'EXECUTE')
    or pg_catalog.has_function_privilege('authenticated', 'public.enforce_owner_business_limit()', 'EXECUTE')
    or pg_catalog.has_function_privilege('service_role', 'public.enforce_owner_business_limit()', 'EXECUTE') then
    raise exception 'Phase G trigger function must not be callable by application roles';
  end if;
end;
$$;

create trigger enforce_owner_business_limit_before_insert
before insert on public.businesses
for each row execute function public.enforce_owner_business_limit();

commit;
