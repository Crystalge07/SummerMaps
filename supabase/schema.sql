-- Pathline schema — run in Supabase SQL editor

create extension if not exists "pgcrypto";

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  device_id uuid not null,
  display_color text,
  joined_at timestamptz not null default now(),
  unique (group_id, device_id)
);

create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null,
  group_id uuid references groups(id) on delete set null,
  lat double precision not null,
  lng double precision not null,
  photo_url text not null,
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists checkins_device_created_idx on checkins (device_id, created_at desc);
create index if not exists checkins_group_created_idx on checkins (group_id, created_at desc);
create index if not exists checkins_created_idx on checkins (created_at desc);
create index if not exists group_members_device_idx on group_members (device_id);

-- Public read for city layer + demo; writes allowed anonymously for hackathon.
alter table groups enable row level security;
alter table group_members enable row level security;
alter table checkins enable row level security;

create policy "groups_read" on groups for select using (true);
create policy "groups_insert" on groups for insert with check (true);
create policy "members_read" on group_members for select using (true);
create policy "members_insert" on group_members for insert with check (true);
create policy "checkins_read" on checkins for select using (true);
create policy "checkins_insert" on checkins for insert with check (true);

-- Storage bucket for check-in photos
insert into storage.buckets (id, name, public)
values ('checkins', 'checkins', true)
on conflict (id) do nothing;

create policy "checkin_photos_read" on storage.objects
  for select using (bucket_id = 'checkins');

create policy "checkin_photos_insert" on storage.objects
  for insert with check (bucket_id = 'checkins');
