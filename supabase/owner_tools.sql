-- LessFun — extra owner controls.
--
-- Run this once in the Supabase dashboard after the base/owner migrations:
--   Project -> SQL Editor -> New query -> paste -> Run
--
-- Adds the account ban flag and a single-row site settings table used by the
-- Owner Console (announcement, maintenance mode, Shells multiplier, featured
-- and disabled games). The settings row is optional; the site falls back to
-- defaults when it is missing.

alter table if exists public.users
    add column if not exists banned boolean not null default false;

-- Make sure the owner console can update accounts (rename, ban, unban).
alter table if exists public.users enable row level security;

drop policy if exists "lessfun_users_update" on public.users;
create policy "lessfun_users_update"
    on public.users for update
    using (true)
    with check (true);

grant select, insert, update, delete on public.users to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Global site settings (exactly one row)
-- ---------------------------------------------------------------------------
create table if not exists public.site_settings (
    id             integer primary key default 1 check (id = 1),
    announcement   text        not null default '',
    maintenance    boolean     not null default false,
    shells_multiplier numeric  not null default 1 check (shells_multiplier >= 0 and shells_multiplier <= 20),
    featured_game  text        not null default '',
    disabled_games jsonb       not null default '[]'::jsonb,
    updated_at     timestamptz not null default now()
);

insert into public.site_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists "lessfun_site_settings_read" on public.site_settings;
create policy "lessfun_site_settings_read"
    on public.site_settings for select
    using (true);

drop policy if exists "lessfun_site_settings_insert" on public.site_settings;
create policy "lessfun_site_settings_insert"
    on public.site_settings for insert
    with check (true);

drop policy if exists "lessfun_site_settings_update" on public.site_settings;
create policy "lessfun_site_settings_update"
    on public.site_settings for update
    using (true)
    with check (true);

drop policy if exists "lessfun_site_settings_delete" on public.site_settings;
create policy "lessfun_site_settings_delete"
    on public.site_settings for delete
    using (true);

grant select, insert, update, delete on public.site_settings to anon, authenticated;
