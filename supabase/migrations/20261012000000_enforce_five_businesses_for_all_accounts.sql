begin;

-- Business creation now has the same five-business cap for every account.
-- Preserve the existing owner lock and trigger so concurrent inserts serialize.
do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Business limit migration requires postgres';
  end if;
end;
$$;

create or replace function public.enforce_owner_business_limit()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  business_count integer;
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Business creation requires READ COMMITTED isolation';
  end if;

  if new.owner_id is null then
    raise exception 'A new business must have an owner';
  end if;

  perform 1 from auth.users where id = new.owner_id for update;
  if not found then
    raise exception 'Business owner account does not exist';
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

commit;
