-- ENTHIVSC STREAM — Supabase setup (v2)
-- Cole no SQL Editor do Supabase e execute.
-- Depois: Storage → create bucket "assets" (public).
-- Ative RLS (habilitado abaixo) e aplique policies.

create extension if not exists pgcrypto;

-- PROFILES
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  role text default 'user',
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles_read_own" on public.profiles
for select using (auth.uid() = user_id);

create policy "profiles_upsert_own" on public.profiles
for insert with check (auth.uid() = user_id);

create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- USER DATA TABLES
create table if not exists public.favorites (
  user_id uuid references auth.users(id) on delete cascade,
  course_id text not null,
  created_at timestamptz default now(),
  primary key (user_id, course_id)
);

create table if not exists public.watched (
  user_id uuid references auth.users(id) on delete cascade,
  lesson_id text not null,
  watched boolean default true,
  updated_at timestamptz default now(),
  primary key (user_id, lesson_id)
);

create table if not exists public.comments (
  user_id uuid references auth.users(id) on delete cascade,
  lesson_id text not null,
  text text check (char_length(text) <= 100),
  updated_at timestamptz default now(),
  primary key (user_id, lesson_id)
);

create table if not exists public.last_open (
  user_id uuid references auth.users(id) on delete cascade,
  course_id text not null,
  lesson_id text not null,
  updated_at timestamptz default now(),
  primary key (user_id, course_id)
);

alter table public.favorites enable row level security;
alter table public.watched enable row level security;
alter table public.comments enable row level security;
alter table public.last_open enable row level security;

create policy "favorites_own_all" on public.favorites
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "watched_own_all" on public.watched
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "comments_own_all" on public.comments
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "last_open_own_all" on public.last_open
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- COURSES (catalog in DB)
create table if not exists public.courses (
  course_id text primary key,
  title text,
  subtitle text,
  category text,
  cover_url text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.courses enable row level security;

-- everyone logged-in can read courses
create policy "courses_read_auth" on public.courses
for select using (auth.role() = 'authenticated');

-- only admin can write courses (based on profiles.role)
create policy "courses_write_admin" on public.courses
for all using (
  exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin')
) with check (
  exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin')
);

-- THEME SETTINGS
create table if not exists public.theme_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table public.theme_settings enable row level security;

create policy "theme_read_auth" on public.theme_settings
for select using (auth.role() = 'authenticated');

create policy "theme_write_admin" on public.theme_settings
for all using (
  exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin')
) with check (
  exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin')
);

-- WHITELIST EMAILS (allowed to signup / reset)
create table if not exists public.allowed_emails (
  email text primary key,
  created_at timestamptz default now()
);

alter table public.allowed_emails enable row level security;

create policy "allowed_read_auth" on public.allowed_emails
for select using (auth.role() = 'authenticated');

create policy "allowed_write_admin" on public.allowed_emails
for all using (
  exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin')
) with check (
  exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin')
);

-- Helpful trigger to keep updated_at current
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_courses_touch on public.courses;
create trigger trg_courses_touch before update on public.courses
for each row execute function public.touch_updated_at();

drop trigger if exists trg_watched_touch on public.watched;
create trigger trg_watched_touch before update on public.watched
for each row execute function public.touch_updated_at();

drop trigger if exists trg_comments_touch on public.comments;
create trigger trg_comments_touch before update on public.comments
for each row execute function public.touch_updated_at();

drop trigger if exists trg_last_open_touch on public.last_open;
create trigger trg_last_open_touch before update on public.last_open
for each row execute function public.touch_updated_at();

-- Seed default theme row
insert into public.theme_settings(key, value)
values ('default', '{}'::jsonb)
on conflict (key) do nothing;
