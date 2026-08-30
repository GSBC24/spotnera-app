alter table public.profiles
add column if not exists first_name text,
add column if not exists last_name text,
add column if not exists phone text,
add column if not exists date_of_birth date,
add column if not exists gender text,
add column if not exists address text,
add column if not exists country text,
add column if not exists onboarding_completed boolean not null default false;

update public.profiles
set onboarding_completed = true
where onboarding_completed_at is not null
  and city is not null;
