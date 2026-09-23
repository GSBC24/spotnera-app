begin;

-- The three policies removed below are permissive duplicates. Verify the full
-- business policy set before changing access, so a drifted schema fails closed.
do $$
declare
  business_id oid := pg_catalog.to_regclass('public.businesses');
  policy_counts record;
  mismatch_count integer;
begin
  if business_id is null or not exists (
    select 1
    from pg_catalog.pg_class c
    where c.oid = business_id
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
  ) then
    raise exception 'public.businesses must exist with RLS enabled';
  end if;

  select
    count(*) filter (where cmd = 'SELECT') as select_count,
    count(*) filter (where cmd = 'INSERT') as insert_count,
    count(*) filter (where cmd = 'UPDATE') as update_count,
    count(*) filter (where cmd = 'DELETE') as delete_count,
    count(*) filter (where cmd = 'ALL') as all_count,
    count(*) as total_count
  into policy_counts
  from pg_catalog.pg_policies
  where schemaname = 'public' and tablename = 'businesses';

  if policy_counts.select_count <> 2
    or policy_counts.insert_count <> 1
    or policy_counts.update_count <> 2
    or policy_counts.delete_count <> 2
    or policy_counts.all_count <> 0
    or policy_counts.total_count <> 7 then
    raise exception 'public.businesses policy commands differ from verified preflight';
  end if;

  -- These predicates contain only the specified simple owner comparison, or
  -- that comparison OR is_active. Removing whitespace and parentheses cannot
  -- hide an additional operator or term because the full result is compared.
  with expected(policyname, cmd, roles, using_normalized, check_normalized) as (
    values
      ('Public users can read active businesses', 'SELECT', array['anon', 'authenticated']::name[], 'is_activeorowner_id=auth.uid', null::text),
      ('Users can insert owned businesses', 'INSERT', array['authenticated']::name[], null::text, 'owner_id=auth.uid'),
      ('Business owners can update businesses', 'UPDATE', array['authenticated']::name[], 'owner_id=auth.uid', 'owner_id=auth.uid'),
      ('Business owners can delete businesses', 'DELETE', array['authenticated']::name[], 'owner_id=auth.uid', null::text),
      ('Users can read their own businesses', 'SELECT', array['authenticated']::name[], 'owner_id=auth.uid', null::text),
      ('Users can update their own businesses', 'UPDATE', array['authenticated']::name[], 'owner_id=auth.uid', 'owner_id=auth.uid'),
      ('Users can delete their own businesses', 'DELETE', array['authenticated']::name[], 'owner_id=auth.uid', null::text)
  )
  select count(*) into mismatch_count
  from expected e
  left join pg_catalog.pg_policies p
    on p.schemaname = 'public'
    and p.tablename = 'businesses'
    and p.policyname = e.policyname
  where p.policyname is null
    or p.cmd <> e.cmd
    or p.permissive <> 'PERMISSIVE'
    or not (p.roles @> e.roles and p.roles <@ e.roles)
    or pg_catalog.regexp_replace(pg_catalog.lower(coalesce(p.qual, '')), '[[:space:]()]', '', 'g')
      <> coalesce(e.using_normalized, '')
    or pg_catalog.regexp_replace(pg_catalog.lower(coalesce(p.with_check, '')), '[[:space:]()]', '', 'g')
      <> coalesce(e.check_normalized, '');

  if mismatch_count <> 0 then
    raise exception 'public.businesses policy definitions differ from verified preflight';
  end if;
end
$$;

drop policy "Users can read their own businesses" on public.businesses;
drop policy "Users can update their own businesses" on public.businesses;
drop policy "Users can delete their own businesses" on public.businesses;

-- Any failed postcondition rolls back all three drops with the transaction.
do $$
declare
  policy_counts record;
  mismatch_count integer;
begin
  select
    count(*) filter (where cmd = 'SELECT') as select_count,
    count(*) filter (where cmd = 'INSERT') as insert_count,
    count(*) filter (where cmd = 'UPDATE') as update_count,
    count(*) filter (where cmd = 'DELETE') as delete_count,
    count(*) filter (where cmd = 'ALL') as all_count,
    count(*) as total_count
  into policy_counts
  from pg_catalog.pg_policies
  where schemaname = 'public' and tablename = 'businesses';

  if policy_counts.select_count <> 1
    or policy_counts.insert_count <> 1
    or policy_counts.update_count <> 1
    or policy_counts.delete_count <> 1
    or policy_counts.all_count <> 0
    or policy_counts.total_count <> 4 then
    raise exception 'public.businesses policy commands differ from expected cleanup';
  end if;

  with expected(policyname, cmd, roles, using_normalized, check_normalized) as (
    values
      ('Public users can read active businesses', 'SELECT', array['anon', 'authenticated']::name[], 'is_activeorowner_id=auth.uid', null::text),
      ('Users can insert owned businesses', 'INSERT', array['authenticated']::name[], null::text, 'owner_id=auth.uid'),
      ('Business owners can update businesses', 'UPDATE', array['authenticated']::name[], 'owner_id=auth.uid', 'owner_id=auth.uid'),
      ('Business owners can delete businesses', 'DELETE', array['authenticated']::name[], 'owner_id=auth.uid', null::text)
  )
  select count(*) into mismatch_count
  from expected e
  left join pg_catalog.pg_policies p
    on p.schemaname = 'public'
    and p.tablename = 'businesses'
    and p.policyname = e.policyname
  where p.policyname is null
    or p.cmd <> e.cmd
    or p.permissive <> 'PERMISSIVE'
    or not (p.roles @> e.roles and p.roles <@ e.roles)
    or pg_catalog.regexp_replace(pg_catalog.lower(coalesce(p.qual, '')), '[[:space:]()]', '', 'g')
      <> coalesce(e.using_normalized, '')
    or pg_catalog.regexp_replace(pg_catalog.lower(coalesce(p.with_check, '')), '[[:space:]()]', '', 'g')
      <> coalesce(e.check_normalized, '');

  if mismatch_count <> 0 then
    raise exception 'public.businesses canonical policies differ after cleanup';
  end if;
end
$$;

commit;
