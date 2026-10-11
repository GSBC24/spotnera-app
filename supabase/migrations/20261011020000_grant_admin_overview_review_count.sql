-- Admin Overview counts visible reviews using the server-only service role.
grant select (id, admin_hidden_at)
  on public.reviews to service_role;
