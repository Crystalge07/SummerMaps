-- Pathline schema — run in Supabase SQL editor

create extension if not exists "pgcrypto";

create table if not exists device_profiles (
  device_id uuid primary key,
  code text unique not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  a_device_id uuid not null references device_profiles(device_id) on delete cascade,
  b_device_id uuid not null references device_profiles(device_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (a_device_id, b_device_id),
  check (a_device_id < b_device_id)
);

create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null,
  prompt text,
  lat double precision not null,
  lng double precision not null,
  photo_url text not null,
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists checkins_device_created_idx on checkins (device_id, created_at desc);
create index if not exists checkins_created_idx on checkins (created_at desc);
create index if not exists friendships_a_idx on friendships (a_device_id);
create index if not exists friendships_b_idx on friendships (b_device_id);
create index if not exists device_profiles_code_idx on device_profiles (code);

alter table device_profiles enable row level security;
alter table friendships enable row level security;
alter table checkins enable row level security;

create policy "profiles_read" on device_profiles for select using (true);
create policy "profiles_upsert" on device_profiles for insert with check (true);
create policy "profiles_update" on device_profiles for update using (true);
create policy "friendships_read" on friendships for select using (true);
create policy "friendships_insert" on friendships for insert with check (true);
create policy "checkins_read" on checkins for select using (true);
create policy "checkins_insert" on checkins for insert with check (true);

insert into storage.buckets (id, name, public)
values ('checkins', 'checkins', true)
on conflict (id) do nothing;

create policy "checkin_photos_read" on storage.objects
  for select using (bucket_id = 'checkins');

create policy "checkin_photos_insert" on storage.objects
  for insert with check (bucket_id = 'checkins');

-- ——— Anonymous auth + usernames ———
-- Prerequisites: Authentication → Providers → Allow anonymous sign-ins.
-- Enable CAPTCHA before public launch (anon sign-in is rate-limited per IP).

create extension if not exists citext;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext unique not null,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

create index if not exists profiles_username_idx on public.profiles (username);

alter table public.profiles enable row level security;

drop policy if exists "auth_profiles_select" on public.profiles;
create policy "auth_profiles_select" on public.profiles
  for select using (true);

-- Username is claimed via RPC only (no direct insert/update policies).

create or replace function public.claim_username(new_username citext)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
  normalized citext;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  normalized := lower(trim(new_username::text))::citext;

  if normalized !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'username_invalid' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, username)
  values (auth.uid(), normalized)
  returning * into result;

  return result;
exception
  when unique_violation then
    raise exception 'username_taken' using errcode = 'P0001';
end;
$$;

create or replace function public.search_profiles(query text, lim int default 10)
returns setof public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.profiles
  where username ilike lower(trim(query)) || '%'
  order by username
  limit least(coalesce(lim, 10), 50);
$$;

grant execute on function public.claim_username(citext) to anon, authenticated;
grant execute on function public.search_profiles(text, int) to anon, authenticated;
