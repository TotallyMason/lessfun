-- LessFun — owner debug permissions.
--
-- Run this if you already ran lessfun_shells.sql before the owner debug tab
-- existed. It only adds the DELETE permissions used when TotallyMason removes
-- an account from the Debug tab.
--
-- ⚠️  The UI checks for the TotallyMason account and asks for its password
-- before showing the debug tab. The database policy is still open because this
-- beta has no server-side owner role. Do not expose this project publicly with
-- real user data until accounts move to Supabase Auth.

alter table if exists public.users enable row level security;

drop policy if exists "lessfun_users_delete" on public.users;
create policy "lessfun_users_delete"
    on public.users for delete
    using (true);

grant delete on public.users to anon, authenticated;

alter table if exists public.wallets enable row level security;

drop policy if exists "lessfun_wallets_delete" on public.wallets;
create policy "lessfun_wallets_delete"
    on public.wallets for delete
    using (true);

grant delete on public.wallets to anon, authenticated;

-- Owner console moderation tools.
alter table if exists public.posts enable row level security;

drop policy if exists "lessfun_posts_update" on public.posts;
create policy "lessfun_posts_update"
    on public.posts for update
    using (true)
    with check (true);

drop policy if exists "lessfun_posts_delete" on public.posts;
create policy "lessfun_posts_delete"
    on public.posts for delete
    using (true);

grant select, insert, update, delete on public.posts to anon, authenticated;

drop policy if exists "lessfun_users_update" on public.users;
create policy "lessfun_users_update"
    on public.users for update
    using (true)
    with check (true);

grant update on public.users to anon, authenticated;

drop policy if exists "lessfun_scores_delete" on public.scores;
create policy "lessfun_scores_delete"
    on public.scores for delete
    using (true);

grant delete on public.scores to anon, authenticated;
