-- ENTHIVSC STREAM — SUPABASE V10 PRIME PATCH
-- Execute in Supabase SQL Editor (Project -> SQL Editor).

-- 1) Helper: is_admin()
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  );
$$;

-- 2) site_settings (key/value) - if you already have, this is safe
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_site_settings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_site_settings_updated_at on public.site_settings;
create trigger trg_site_settings_updated_at
before update on public.site_settings
for each row execute function public.touch_site_settings_updated_at();

alter table public.site_settings enable row level security;

-- policies: authenticated read; only admin write
drop policy if exists "site_settings_read_auth" on public.site_settings;
create policy "site_settings_read_auth"
on public.site_settings for select
to authenticated
using (true);

drop policy if exists "site_settings_write_admin" on public.site_settings;
create policy "site_settings_write_admin"
on public.site_settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 3) Announcements (global banner)
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Aviso',
  message text not null default '',
  severity text not null default 'info', -- info | warn | danger
  starts_at timestamptz not null default now(),
  ends_at timestamptz null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid null
);

create index if not exists idx_announcements_active_starts
on public.announcements (is_active, starts_at desc);

alter table public.announcements enable row level security;

drop policy if exists "announcements_select_auth" on public.announcements;
create policy "announcements_select_auth"
on public.announcements for select
to authenticated
using (
  is_active = true
  and starts_at <= now()
  and (ends_at is null or ends_at >= now())
);

drop policy if exists "announcements_write_admin" on public.announcements;
create policy "announcements_write_admin"
on public.announcements for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 4) Allowed emails (whitelist) - optional but recommended
create table if not exists public.allowed_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.allowed_emails enable row level security;

drop policy if exists "allowed_emails_read_admin" on public.allowed_emails;
create policy "allowed_emails_read_admin"
on public.allowed_emails for select
to authenticated
using (public.is_admin());

drop policy if exists "allowed_emails_write_admin" on public.allowed_emails;
create policy "allowed_emails_write_admin"
on public.allowed_emails for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.is_email_allowed(email_input text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.allowed_emails a
    where lower(a.email) = lower(email_input)
  );
$$;

-- 5) Profiles: user can update own profile (display_name, username, avatar_url)
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

-- 6) Favorites / Watched / Comments / Last_open - ensure RLS (idempotent, adjust if your tables differ)

-- favorites
alter table public.favorites enable row level security;
drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
on public.favorites for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "favorites_write_own" on public.favorites;
create policy "favorites_write_own"
on public.favorites for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- watched
alter table public.watched enable row level security;
drop policy if exists "watched_select_own" on public.watched;
create policy "watched_select_own"
on public.watched for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "watched_write_own" on public.watched;
create policy "watched_write_own"
on public.watched for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- comments
alter table public.comments enable row level security;
drop policy if exists "comments_select_auth" on public.comments;
create policy "comments_select_auth"
on public.comments for select
to authenticated
using (true);

drop policy if exists "comments_insert_auth" on public.comments;
create policy "comments_insert_auth"
on public.comments for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own"
on public.comments for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own"
on public.comments for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- last_open (optional)
create table if not exists public.last_open (
  user_id uuid not null,
  course_id text not null,
  last_lesson_id text null,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

alter table public.last_open enable row level security;

drop policy if exists "last_open_select_own" on public.last_open;
create policy "last_open_select_own"
on public.last_open for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "last_open_write_own" on public.last_open;
create policy "last_open_write_own"
on public.last_open for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 7) Storage policies (bucket assets)
-- Ensure bucket 'assets' exists and is Public in Storage UI.
-- Policies below allow authenticated users to manage only avatars/*,
-- and admins to manage theme/* and covers/*

drop policy if exists "assets_read_public" on storage.objects;
create policy "assets_read_public"
on storage.objects for select
to public
using (bucket_id = 'assets');

drop policy if exists "avatars_insert_auth" on storage.objects;
create policy "avatars_insert_auth"
on storage.objects for insert
to authenticated
with check (bucket_id='assets' and name like 'avatars/%');

drop policy if exists "avatars_update_auth" on storage.objects;
create policy "avatars_update_auth"
on storage.objects for update
to authenticated
using (bucket_id='assets' and name like 'avatars/%');

drop policy if exists "avatars_delete_auth" on storage.objects;
create policy "avatars_delete_auth"
on storage.objects for delete
to authenticated
using (bucket_id='assets' and name like 'avatars/%');

drop policy if exists "assets_admin_manage" on storage.objects;
create policy "assets_admin_manage"
on storage.objects for all
to authenticated
using (public.is_admin() and bucket_id='assets' and (name like 'theme/%' or name like 'covers/%'))
with check (public.is_admin() and bucket_id='assets' and (name like 'theme/%' or name like 'covers/%'));

-- Optional: force PostgREST schema reload (only if you get schema cache error)
-- NOTIFY pgrst, 'reload schema';
