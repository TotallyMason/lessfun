-- LessFun — admin roles and profile pictures.
--
-- Run this once in the Supabase SQL editor after owner_tools.sql:
--   Project -> SQL Editor -> New query -> paste -> Run
--
-- Adds:
--   users.is_admin      true when the account has been promoted by the owner
--   users.admin_powers  comma-separated power ids:
--                         manage_posts, manage_replies, manage_users
--   users.avatar        small data URL or image URL used as the profile photo
--
-- The owner console writes these columns. The app falls back gracefully if
-- this migration has not been run yet, but admin cards and profile photos will
-- not persist until it has.

alter table if exists public.users
    add column if not exists is_admin boolean not null default false;

alter table if exists public.users
    add column if not exists admin_powers text not null default '';

alter table if exists public.users
    add column if not exists avatar text not null default '';

-- Keep the beta's open update policy so the owner console and profile editor
-- can write from the browser. Move to Supabase Auth and auth.uid()-based rules
-- before handling real user data.
alter table if exists public.users enable row level security;

drop policy if exists "lessfun_users_update" on public.users;
create policy "lessfun_users_update"
    on public.users for update
    using (true)
    with check (true);

grant select, insert, update, delete on public.users to anon, authenticated;
