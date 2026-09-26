begin;

alter table public.profiles
  add column age_range text,
  add constraint profiles_age_range_allowed check (
    age_range is null or age_range in ('18–24', '25–34', '35–44', '45–54', '55–64', '65+')
  ),
  add constraint profiles_interests_max_five check (cardinality(interests) <= 5);

-- Fail safely if older profile data would violate the new uniqueness rule.
do $$
begin
  if exists (
    select 1
    from public.profiles p
    cross join lateral unnest(p.interests) as interest(value)
    group by p.id
    having count(*) <> count(distinct interest.value)
      or bool_or(btrim(interest.value) = '')
  ) then
    raise exception 'Existing profile interests contain duplicates, nulls, or empty values';
  end if;
end;
$$;

create function public.validate_profile_interests()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
declare
  interest text;
  seen text[] := '{}';
begin
  if cardinality(new.interests) > 5 then
    raise check_violation using message = 'Select at most five interests';
  end if;
  foreach interest in array new.interests loop
    if interest is null or btrim(interest) = '' or interest = any(seen) then
      raise check_violation using message = 'Interests must be nonempty and unique';
    end if;
    seen := array_append(seen, interest);
  end loop;
  return new;
end;
$$;

create trigger validate_profile_interests
before insert or update of interests on public.profiles
for each row execute function public.validate_profile_interests();

-- Existing profile RLS allows authenticated users to read and update only id = auth.uid().
-- No new policy or business-facing grant is added for either field.
commit;
