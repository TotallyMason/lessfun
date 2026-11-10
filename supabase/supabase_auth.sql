-- LessFun — Supabase Auth migration
--
-- Run this once in Supabase → SQL Editor.
--
-- The client now uses Supabase Auth for username/password accounts:
--   * usernames are mapped to a stable synthetic email: <hash>.<name>@lessfun.app
--   * public.users remains the profile table (username, admin flags, avatar, etc.)
--   * auth_id links a profile to auth.users
--
-- IMPORTANT: in Supabase → Authentication → Providers → Email, turn OFF
-- "Confirm email". Synthetic emails cannot receive confirmation messages.
-- Existing username accounts migrate automatically on their next sign-in,
-- provided their password is at least 6 characters.

alter table public.users add column if not exists auth_id uuid;
alter table public.users add column if not exists email text;
alter table public.users alter column password drop not null;

create unique index if not exists users_auth_id_key
    on public.users (auth_id)
    where auth_id is not null;

-- Existing rows keep their password until the user signs in once. After a
-- successful migration the client writes auth_id/email and clears password.
--
-- Optional: once every account has migrated, remove the old column.
-- alter table public.users drop column password;

-- The app already uses permissive anon policies for its public profile lookups.
-- If your project enables RLS on public.users, make sure signed-in users can:
--   select their own profile and public profile fields
--   insert a profile where auth_id = auth.uid()
--   update only their own profile
-- Example:
--
-- alter table public.users enable row level security;
-- create policy "profiles are readable" on public.users for select using (true);
-- create policy "users insert own profile" on public.users for insert
--   with check (auth.uid() = auth_id);
-- create policy "users update own profile" on public.users for update
--   using (auth.uid() = auth_id) with check (auth.uid() = auth_id);
--
-- The Owner Console still needs broad read access for moderation. Adjust the
-- policies to match your project before enabling strict RLS.

-- Owner password resets and plaintext account creation are now done in
-- Supabase Dashboard → Authentication → Users. The old Owner Console controls
-- show guidance instead of writing plaintext passwords.
