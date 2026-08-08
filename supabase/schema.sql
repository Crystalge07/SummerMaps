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
