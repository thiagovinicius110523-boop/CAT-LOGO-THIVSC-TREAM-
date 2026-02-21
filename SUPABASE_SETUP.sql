-- ENTHIVSC STREAM — Supabase setup (MASTER, payload jsonb)
-- Execute no Supabase SQL Editor.
-- Depois: Storage → crie bucket "assets" (public).
-- Este setup assume: catálogo só para usuários logados (authenticated).

create extension if not exists pgcrypto;

-- =========================
-- 1) PROFILES + trigger
-- =========================
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text,
  display_name text,
  avatar_url text,
  role text default 'user',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create policy "profiles_read_own" on public.profiles
for select using (auth.uid() = user_id);

create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = user_id);

create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Admin pode ler todos perfis (para painel)
create policy "profiles_read_admin" on public.profiles
for select using (
  exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin')
);

-- Trigger: criar profile automaticamente ao registrar usuário
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, username, display_name, role)
  values (new.id, null, null, 'user')
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Helper: checar admin
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin');
$$;

-- =========================
-- 2) WHITELIST (allowed_emails) + RPC para anon
-- =========================
create table if not exists public.allowed_emails (
  email text primary key,
  created_at timestamptz default now()
);

alter table public.allowed_emails enable row level security;

-- Apenas admin pode gerenciar
create policy "allowed_emails_admin_all" on public.allowed_emails
for all using (public.is_admin()) with check (public.is_admin());

-- RPC para login/signup (permite anon checar sem expor lista inteira via select)
create or replace function public.is_email_allowed(p_email text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.allowed_emails ae where ae.email = lower(p_email));
$$;

grant execute on function public.is_email_allowed(text) to anon, authenticated;

-- =========================
-- 3) COURSES (catálogo) + payload
-- =========================
create table if not exists public.courses (
  course_id text primary key,
  title text not null,
  subtitle text,
  category text,
  subcategory text,
  subsubcategory text,
  cover_url text,
  payload jsonb not null default jsonb_build_object('modules', jsonb_build_array()),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.courses enable row level security;

drop trigger if exists trg_courses_updated_at on public.courses;
create trigger trg_courses_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

-- Leitura: somente logado
create policy "courses_read_auth" on public.courses
for select using (auth.role() = 'authenticated');

-- Escrita: somente admin
create policy "courses_write_admin" on public.courses
for insert with check (public.is_admin());

create policy "courses_update_admin" on public.courses
for update using (public.is_admin()) with check (public.is_admin());

create policy "courses_delete_admin" on public.courses
for delete using (public.is_admin());

-- =========================
-- 4) USER DATA (favorites/watched/comments/last_open)
-- =========================
create table if not exists public.favorites (
  user_id uuid references auth.users(id) on delete cascade,
  course_id text not null references public.courses(course_id) on delete cascade,
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
  text text check (char_length(text) <= 500),
  updated_at timestamptz default now(),
  primary key (user_id, lesson_id)
);

create table if not exists public.last_open (
  user_id uuid references auth.users(id) on delete cascade,
  course_id text not null references public.courses(course_id) on delete cascade,
  lesson_id text not null,
  updated_at timestamptz default now(),
  primary key (user_id, course_id)
);

alter table public.favorites enable row level security;
alter table public.watched enable row level security;
alter table public.comments enable row level security;
alter table public.last_open enable row level security;

drop trigger if exists trg_watched_updated_at on public.watched;
create trigger trg_watched_updated_at
before update on public.watched
for each row execute function public.set_updated_at();

drop trigger if exists trg_comments_updated_at on public.comments;
create trigger trg_comments_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

drop trigger if exists trg_last_open_updated_at on public.last_open;
create trigger trg_last_open_updated_at
before update on public.last_open
for each row execute function public.set_updated_at();

create policy "favorites_own_all" on public.favorites
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "watched_own_all" on public.watched
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "comments_own_all" on public.comments
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "last_open_own_all" on public.last_open
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================
-- 5) SITE SETTINGS (tema/logo)
-- =========================
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table public.site_settings enable row level security;

drop trigger if exists trg_site_settings_updated_at on public.site_settings;
create trigger trg_site_settings_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

-- Leitura: tema pode ser lido até no login (anon), outras chaves continuam protegidas
create policy "site_settings_read_theme_public" on public.site_settings
for select using (key = 'theme');

create policy "site_settings_read_auth" on public.site_settings
for select using (auth.role() = 'authenticated');

-- Escrita: admin
create policy "site_settings_write_admin" on public.site_settings
for all using (public.is_admin()) with check (public.is_admin());

-- Seed padrão
insert into public.site_settings (key, value)
values ('theme', jsonb_build_object(
  'brand', 'ENGTHIVSC STREAM',
  'primary', '#7c3aed',
  'bg', '#0b1020',
  'text', '#e5e7eb',
  'logo_url', null
))
on conflict (key) do nothing;

-- =========================
-- 6) PRESENCE (online)
-- =========================
create table if not exists public.presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  page text,
  last_seen timestamptz default now()
);

alter table public.presence enable row level security;

drop trigger if exists trg_presence_updated_at on public.presence;
create trigger trg_presence_updated_at
before update on public.presence
for each row execute function public.set_updated_at();

-- usuário atual pode upsert o próprio
create policy "presence_own_upsert" on public.presence
for insert with check (auth.uid() = user_id);

create policy "presence_own_update" on public.presence
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- admin pode ler todos
create policy "presence_read_admin" on public.presence
for select using (public.is_admin());
