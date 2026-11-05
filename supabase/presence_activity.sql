-- LessFun — friend activity and game presence.
--
-- Run this once in the Supabase SQL editor after friends.sql:
--   Project -> SQL Editor -> New query -> paste -> Run
--
-- Stores what a player is currently doing so friends can see it and join the
-- same public game or lobby. Private room codes are never written here.

alter table if exists public.user_presence
    add column if not exists activity text not null default '';

alter table if exists public.user_presence
    add column if not exists game text not null default '';

alter table if exists public.user_presence
    add column if not exists room text not null default '';

alter table public.user_presence enable row level security;

drop policy if exists "lessfun_presence_update" on public.user_presence;
create policy "lessfun_presence_update"
    on public.user_presence for update
    using (true)
    with check (true);

grant select, insert, update, delete on public.user_presence to anon, authenticated;
