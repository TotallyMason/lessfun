-- LessFun — account purchase sync columns.
--
-- Run this once in the Supabase dashboard:
--   Project -> SQL Editor -> New query -> paste -> Run
--
-- The app already syncs purchases through the existing `equipped` JSON, so
-- this migration is optional. It gives the same data proper columns and
-- makes future queries and admin tooling easier.

alter table if exists public.wallets
    add column if not exists cars jsonb not null default '[]'::jsonb;
alter table if exists public.wallets
    add column if not exists equipped_car text;
alter table if exists public.wallets
    add column if not exists xp integer not null default 0 check (xp >= 0);
alter table if exists public.wallets
    add column if not exists achievements jsonb not null default '[]'::jsonb;
alter table if exists public.wallets
    add column if not exists stats jsonb not null default '{}'::jsonb;
