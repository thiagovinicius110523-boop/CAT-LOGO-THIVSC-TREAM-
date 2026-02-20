-- ENTHIVSC STREAM — SQL Patch v4
-- Execute no Supabase SQL Editor (Database > SQL Editor).
-- Observação: alguns comandos usam DROP/RENAME para corrigir estrutura.
-- Leia com atenção antes de rodar.

-- 1) Função helper: é admin?
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

-- 2) PROFILES (tolerante)
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

-- Policies: user vê o próprio perfil
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

-- Admin pode ver todos os perfis (para painel de online)
drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select"
on public.profiles for select
to authenticated
using (public.is_admin());

-- 3) SITE SETTINGS (KV)
-- Se você já tem uma tabela site_settings com colunas diferentes, renomeie e recrie:
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='site_settings') then
    -- checa se tem coluna "key"
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='site_settings' and column_name='key'
    ) then
      alter table public.site_settings rename to site_settings_old_v4;
    end if;
  end if;
end $$;

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_settings add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_site_settings_updated_at on public.site_settings;
create trigger trg_site_settings_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

alter table public.site_settings enable row level security;

-- select do tema: opcional permitir público (anon) ler só o theme
drop policy if exists "site_settings_public_theme_select" on public.site_settings;
create policy "site_settings_public_theme_select"
on public.site_settings for select
to anon, authenticated
using (key = 'theme');

-- admin pode ler e editar todos
drop policy if exists "site_settings_admin_all" on public.site_settings;
create policy "site_settings_admin_all"
on public.site_settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 4) PRESENCE
create table if not exists public.presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen timestamptz not null default now(),
  is_online boolean not null default true
);

alter table public.presence enable row level security;

drop policy if exists "presence_upsert_own" on public.presence;
create policy "presence_upsert_own"
on public.presence for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "presence_update_own" on public.presence;
create policy "presence_update_own"
on public.presence for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "presence_admin_select" on public.presence;
create policy "presence_admin_select"
on public.presence for select
to authenticated
using (public.is_admin());

-- 5) STORAGE bucket "assets" (logo, fundo, capas, avatars)
-- Crie o bucket no Storage: "assets" (Public = true).
-- Em seguida, políticas:
-- IMPORTANTE: Storage policies ficam em storage.objects e storage.buckets.

-- Assets: qualquer logado pode ler (se bucket público, nem precisa)
-- Admin pode inserir/atualizar tema/capas globais; usuário pode inserir seu próprio avatar.
-- Adapte conforme seu caso.

-- Exemplos (ajuste se já existir):
-- create policy "assets_public_read" on storage.objects
-- for select using (bucket_id='assets');

-- create policy "assets_user_avatar_write" on storage.objects
-- for insert to authenticated
-- with check (
--   bucket_id='assets' and
--   (name like ('avatars/'||auth.uid()||'/%'))
-- );

-- create policy "assets_user_avatar_update" on storage.objects
-- for update to authenticated
-- using (
--   bucket_id='assets' and (name like ('avatars/'||auth.uid()||'/%'))
-- )
-- with check (
--   bucket_id='assets' and (name like ('avatars/'||auth.uid()||'/%'))
-- );

-- create policy "assets_admin_write" on storage.objects
-- for insert to authenticated
-- with check (bucket_id='assets' and public.is_admin());

-- create policy "assets_admin_update" on storage.objects
-- for update to authenticated
-- using (bucket_id='assets' and public.is_admin())
-- with check (bucket_id='assets' and public.is_admin());

-- 6) COURSES (para admin-modules.html)
create table if not exists public.courses (
  course_id text primary key,
  title text not null default '',
  subtitle text not null default '',
  category text not null default '',
  cover_url text not null default '',
  modules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

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
