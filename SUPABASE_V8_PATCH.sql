-- ENTHIVSC STREAM V8 — PATCH (RLS + tabelas + RPC)
-- Rode no Supabase SQL Editor.

-- 1) allowed_emails
create table if not exists public.allowed_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.allowed_emails enable row level security;

-- 2) função admin helper (se não existir)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- 3) RPC whitelist (para permitir checar no signup sem expor tabela)
create or replace function public.is_email_allowed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(p_email)
  );
$$;

-- 4) Policies allowed_emails (admin full access)
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='allowed_emails' loop
    execute format('drop policy if exists %I on public.allowed_emails;', r.policyname);
  end loop;
end $$;

create policy allowed_emails_admin_all
on public.allowed_emails
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 5) Comments (owner only)
create table if not exists public.comments (
  id bigserial primary key,
  user_id uuid not null,
  course_id text not null,
  lesson_id text not null,
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- unique para upsert
create unique index if not exists comments_uniq on public.comments(user_id, course_id, lesson_id);

alter table public.comments enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='comments' loop
    execute format('drop policy if exists %I on public.comments;', r.policyname);
  end loop;
end $$;

create policy comments_own_select
on public.comments
for select
to authenticated
using (user_id = auth.uid());

create policy comments_own_insert
on public.comments
for insert
to authenticated
with check (user_id = auth.uid());

create policy comments_own_update
on public.comments
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy comments_own_delete
on public.comments
for delete
to authenticated
using (user_id = auth.uid());

-- 6) Favorites
create table if not exists public.favorites (
  user_id uuid not null,
  course_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

alter table public.favorites enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='favorites' loop
    execute format('drop policy if exists %I on public.favorites;', r.policyname);
  end loop;
end $$;

create policy favorites_own_all
on public.favorites
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 7) Watched
create table if not exists public.watched (
  user_id uuid not null,
  course_id text not null,
  lesson_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id, lesson_id)
);

alter table public.watched enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='watched' loop
    execute format('drop policy if exists %I on public.watched;', r.policyname);
  end loop;
end $$;

create policy watched_own_all
on public.watched
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 8) last_open
create table if not exists public.last_open (
  user_id uuid primary key,
  course_id text,
  opened_at timestamptz not null default now()
);

alter table public.last_open enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='last_open' loop
    execute format('drop policy if exists %I on public.last_open;', r.policyname);
  end loop;
end $$;

create policy last_open_own_all
on public.last_open
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 9) Presence (online)
create table if not exists public.presence (
  user_id uuid primary key,
  page text,
  last_seen timestamptz not null default now()
);

alter table public.presence enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='presence' loop
    execute format('drop policy if exists %I on public.presence;', r.policyname);
  end loop;
end $$;

create policy presence_own_upsert
on public.presence
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy presence_admin_select
on public.presence
for select
to authenticated
using (public.is_admin());

-- 10) Storage policies (assets/avatars)
-- OBS: Postgres não tem CREATE POLICY IF NOT EXISTS.

drop policy if exists "avatars_insert_auth" on storage.objects;
drop policy if exists "avatars_update_auth" on storage.objects;
drop policy if exists "avatars_delete_auth" on storage.objects;

create policy "avatars_insert_auth"
on storage.objects
for insert
to authenticated
with check (bucket_id='assets' and name like 'avatars/%');

create policy "avatars_update_auth"
on storage.objects
for update
to authenticated
using (bucket_id='assets' and name like 'avatars/%');

create policy "avatars_delete_auth"
on storage.objects
for delete
to authenticated
using (bucket_id='assets' and name like 'avatars/%');

-- covers + public assets (admin) — opcional
-- você pode usar uploads em 'covers/%' e 'public/%'

