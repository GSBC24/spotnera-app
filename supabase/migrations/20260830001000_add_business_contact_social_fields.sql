alter table public.businesses
add column if not exists phone text,
add column if not exists email text,
add column if not exists facebook_url text,
add column if not exists instagram_url text,
add column if not exists tiktok_url text,
add column if not exists snapchat_url text;
