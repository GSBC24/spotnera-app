-- Admin Reviews uses these fields with the server-only service role.
-- id and admin_hidden_at were granted for Admin Overview.
grant select (business_id, user_id, rating, comment, created_at)
  on public.reviews to service_role;
