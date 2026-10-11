-- Business Inspect reads these private owner fields with the server-only service role.
-- RLS remains owner-only for authenticated clients.
grant select (id, first_name, last_name, phone)
  on public.profiles to service_role;
