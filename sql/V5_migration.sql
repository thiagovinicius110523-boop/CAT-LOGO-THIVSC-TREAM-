-- ENTHIVSC STREAM — Migração recomendada (V5+)
-- Objetivo: alinhar o schema do Supabase com o front atual (admin-modules + admin-courses)
-- Pode ser executado com segurança: usa IF NOT EXISTS/DO blocks.

create extension if not exists pgcrypto;

-- helper: admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
  );
$$;

-- PROFILES (tolerante)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text default '',
  role text default 'user',
  created_at timestamptz default now()
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar_url text default '';
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists created_at timestamptz default now();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "profiles_upsert_own" on public.profiles;
create policy "profiles_upsert_own"
on public.profiles for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select"
on public.profiles for select
to authenticated
using (public.is_admin());

-- COURSES (canônico)
create table if not exists public.courses (
  course_id text primary key,
  title text not null default '',
  subtitle text not null default '',
  category text not null default '',
  subcategory text not null default '',
  subsubcategory text not null default '',
  cover_url text not null default '',
  modules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Se já existe a tabela, garante colunas usadas no front
alter table public.courses add column if not exists title text not null default '';
alter table public.courses add column if not exists subtitle text not null default '';
alter table public.courses add column if not exists category text not null default '';
alter table public.courses add column if not exists subcategory text not null default '';
alter table public.courses add column if not exists subsubcategory text not null default '';
alter table public.courses add column if not exists cover_url text not null default '';
alter table public.courses add column if not exists modules jsonb not null default '[]'::jsonb;
alter table public.courses add column if not exists created_at timestamptz not null default now();
alter table public.courses add column if not exists updated_at timestamptz not null default now();

-- Se você tem a coluna payload antiga e quer manter, tudo bem.
-- Caso queira remover, descomente:
-- alter table public.courses drop column if exists payload;

-- Trigger: updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_courses_updated_at on public.courses;
create trigger trg_courses_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

alter table public.courses enable row level security;

drop policy if exists "courses_public_read" on public.courses;
create policy "courses_public_read"
on public.courses for select
to anon, authenticated
using (true);

drop policy if exists "courses_admin_write" on public.courses;
create policy "courses_admin_write"
on public.courses for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- STORAGE
-- Crie bucket "assets" (public) no painel. Policies em storage.objects variam por projeto.
