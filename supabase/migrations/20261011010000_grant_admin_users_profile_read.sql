-- Admin Users reads these profile fields with the server-only service role.
-- The other requested columns were granted for Business Inspect.
grant select (username, full_name, created_at)
  on public.profiles to service_role;
