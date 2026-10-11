begin;

-- A business INSERT has no deal/review moderation columns. Select the table
-- before reading NEW so PostgreSQL never resolves another table's fields.
create or replace function public.protect_admin_moderation_state()
returns trigger language plpgsql set search_path = pg_catalog, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if tg_table_name = 'businesses' then
      if new.verified_at is not null or new.suspended_at is not null then
        raise exception 'Administrative business state is read only' using errcode = '42501';
      end if;
    elsif tg_table_name = 'deals' then
      if new.admin_disabled_at is not null then
        raise exception 'Administrative deal state is read only' using errcode = '42501';
      end if;
    elsif tg_table_name = 'reviews' then
      if new.admin_hidden_at is not null then
        raise exception 'Administrative review state is read only' using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  if current_user <> (
    select pg_catalog.pg_get_userbyid(p.proowner)
    from pg_catalog.pg_proc p
    where p.oid = 'public.perform_admin_action(text,uuid,text,text)'::pg_catalog.regprocedure
  ) then
    if tg_table_name = 'businesses' then
      if new.verified_at is distinct from old.verified_at or
         new.suspended_at is distinct from old.suspended_at then
        raise exception 'Administrative business state is read only' using errcode = '42501';
      end if;
    elsif tg_table_name = 'deals' then
      if new.admin_disabled_at is distinct from old.admin_disabled_at then
        raise exception 'Administrative deal state is read only' using errcode = '42501';
      end if;
    elsif tg_table_name = 'reviews' then
      if new.admin_hidden_at is distinct from old.admin_hidden_at then
        raise exception 'Administrative review state is read only' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

commit;
