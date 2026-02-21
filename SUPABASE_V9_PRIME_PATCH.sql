-- ENTHIVSC STREAM — V9 PRIME (Supabase Patch)
-- Execute no Supabase SQL Editor (uma vez).
-- Observação: use um usuário com permissão (Owner).

-- 0) Extensão útil
create extension if not exists pgcrypto;

-- 1) ALLOWLIST (usa allowed_emails como canonical; mantém compatibilidade com allowed_users)
create table if not exists public.allowed_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

-- Se você já tem allowed_users, você pode manter (o front faz fallback),
-- mas recomendamos migrar para allowed_emails.
-- Exemplo (opcional):
-- insert into public.allowed_emails(email)
-- select email from public.allowed_users
-- on conflict do nothing;

alter table public.allowed_emails enable row level security;

-- Somente admin pode gerenciar allowlist
drop policy if exists allowed_emails_read_admin on public.allowed_emails;
create policy allowed_emails_read_admin on public.allowed_emails
for select to authenticated
using (public.is_admin());

drop policy if exists allowed_emails_write_admin on public.allowed_emails;
create policy allowed_emails_write_admin on public.allowed_emails
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- RPC para checar allowlist durante signup (login.js tenta usar isso primeiro)
create or replace function public.is_email_allowed(p_email text)
returns boolean
language sql
stable
as $$
  select exists (select 1 from public.allowed_emails where email = lower(p_email));
$$;

grant execute on function public.is_email_allowed(text) to anon, authenticated;

-- 2) LAST_OPEN: adiciona last_lesson_id + constraint (para "Continuar")
alter table public.last_open
  add column if not exists last_lesson_id text;

-- garante unicidade por usuário+curso
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and indexname='last_open_user_course_key'
  ) then
    execute 'create unique index last_open_user_course_key on public.last_open(user_id, course_id)';
  end if;
end $$;

-- 3) COMMENTS: permitir inserir/atualizar apenas do próprio usuário
alter table public.comments enable row level security;

drop policy if exists comments_select_own on public.comments;
create policy comments_select_own on public.comments
for select to authenticated
using (user_id = auth.uid());

drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own on public.comments
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists comments_update_own on public.comments;
create policy comments_update_own on public.comments
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists comments_delete_own on public.comments;
create policy comments_delete_own on public.comments
for delete to authenticated
using (user_id = auth.uid());

-- Recomendado: garantir upsert (user_id,course_id,lesson_id)
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='comments_user_course_lesson_key'
  ) then
    execute 'create unique index comments_user_course_lesson_key on public.comments(user_id, course_id, lesson_id)';
  end if;
end $$;

-- 4) FAVORITES e WATCHED: políticas próprias (se ainda não existirem)
alter table public.favorites enable row level security;
drop policy if exists favorites_select_own on public.favorites;
create policy favorites_select_own on public.favorites
for select to authenticated
using (user_id = auth.uid());
drop policy if exists favorites_write_own on public.favorites;
create policy favorites_write_own on public.favorites
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

alter table public.watched enable row level security;
drop policy if exists watched_select_own on public.watched;
create policy watched_select_own on public.watched
for select to authenticated
using (user_id = auth.uid());
drop policy if exists watched_write_own on public.watched;
create policy watched_write_own on public.watched
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 5) PROFILES: permitir update pelo próprio usuário (avatar/nomes)
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated
using (user_id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 6) STORAGE (bucket: assets)
-- No painel Storage: crie bucket "assets" e marque como Public.
-- Depois rode as policies abaixo:

-- A) leitura pública (logos/capas/backgrounds/avatares)
drop policy if exists "assets_public_read" on storage.objects;
create policy "assets_public_read"
on storage.objects for select
to public
using (bucket_id = 'assets');

-- B) upload de avatar pelo próprio usuário (pasta avatars/<uid>.*)
drop policy if exists "avatars_insert_auth" on storage.objects;
create policy "avatars_insert_auth"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'assets'
  and (storage.foldername(name))[1] = 'avatars'
  and auth.uid()::text = split_part(storage.filename(name), '.', 1)
);

drop policy if exists "avatars_update_auth" on storage.objects;
create policy "avatars_update_auth"
on storage.objects for update
to authenticated
using (
  bucket_id = 'assets'
  and (storage.foldername(name))[1] = 'avatars'
  and auth.uid()::text = split_part(storage.filename(name), '.', 1)
)
with check (
  bucket_id = 'assets'
  and (storage.foldername(name))[1] = 'avatars'
  and auth.uid()::text = split_part(storage.filename(name), '.', 1)
);

-- C) admin pode subir capas/logos/backgrounds (pastas: covers/, theme/)
drop policy if exists "assets_admin_write" on storage.objects;
create policy "assets_admin_write"
on storage.objects for all
to authenticated
using (
  bucket_id = 'assets'
  and public.is_admin()
)
with check (
  bucket_id = 'assets'
  and public.is_admin()
);
