# LessFun

A 3D arcade with a liquid-glass interface. Play it at
[https://totallymason.github.io/lessfun/](https://totallymason.github.io/lessfun/).

## Games

| Game | What it is |
| --- | --- |
| Beach Racer | Outrun traffic along a sunset coast. Steer freely and brake through the pack. |
| Tunnel Rush | Thread an endless neon tunnel and rotate through the gaps. |
| Cube Stack | Stack the tower as high as you can before the blocks drift away. |
| Helix Drop | Fall through a rotating helix and slip through the openings. |
| Star Dodger | Weave through an asteroid storm at increasing speed. |

All five games are real-time 3D scenes rendered with Three.js.

## Play

Visit the live site at [https://totallymason.github.io/lessfun/](https://totallymason.github.io/lessfun/).

Guests can play without an account, but guest scores and posts are not saved.
Account mode keeps scores, posts, and Shells across devices once the Supabase
tables below are created.

## Run locally

The web version lives in [`docs/`](docs) and uses no build step, no bundler, and
no framework.

```sh
cd docs
python3 -m http.server 8765
```

Then open <http://localhost:8765>.

## Shells

Shells are LessFun's single soft currency. They are earned by playing and spent
only on cosmetics, so the shop never affects scores or speed.

| Action | Shells |
| --- | --- |
| Every second of play | 1 (minimum 1 per run) |
| First run of the day | +25 |
| 3-day streak | +150 |
| 7-day streak | +400 |
| 14-day streak | +1,000 |

New players start with **100 Shells**. Purchases are equipped immediately, and
any owned cosmetic can be re-equipped for free. The shop has **106 cosmetics** in
eight categories:

| Category | Items | What changes in Beach Racer |
| --- | --- | --- |
| Car paints | 20 | Body colour of the beach buggy |
| Car bodies | 14 | Full silhouette: buggy, wagon, truck, racer, van, limo, monster, and more |
| Engines | 12 | Exhaust pipes, turbines, battery glow, rocket flames, and engine detail |
| Surfboards | 15 | Roof board colour and shape detailing |
| Underglow | 11 | Neon light pool and point light under the car |
| Wheels | 12 | Rim colour, spokes, and emissive shine |
| Exhaust trails | 12 | Pulsing additive strips behind the bumper |
| Beach umbrellas | 10 | Striped canopy colour across the shoreline |

Body and engine cosmetics are **visual only** — they never change speed,
handling, collision size, or Shells earned. Rainbow variants cycle hue over
time. A Shells multiplier event can be enabled from the Owner Console for
double-Shells weekends.

## Supabase setup

The app reads and writes `users`, `posts`, `post_replies`, `post_reactions`,
`reply_reactions`, `scores`, `wallets`, `friendships`, `user_presence`, and
`site_settings`. Run [`supabase/lessfun_shells.sql`](supabase/lessfun_shells.sql)
once in the Supabase dashboard (**SQL Editor → New query → paste → Run**). It
creates the wallet, score, friends, presence, community, and site-settings tables
and enables the row-level-security policies the browser client needs.

Already have an older project? Run these incremental migrations instead of the
full file:

- [`supabase/friends.sql`](supabase/friends.sql) — friendships and presence.
- [`supabase/owner_tools.sql`](supabase/owner_tools.sql) — ban flag and site
  settings.
- [`supabase/community.sql`](supabase/community.sql) — post attachments, replies,
  post reactions, reply reactions, and the newer owner toggles.
- [`supabase/owner_debug.sql`](supabase/owner_debug.sql) — owner delete/update
  permissions.

Until migrations are run:

- Scores fall back to `localStorage` on the device.
- Shells fall back to a per-user `localStorage` wallet.
- Account codes still sign in, but nothing syncs between devices.
- Friends, presence, bans, replies, reactions, uploads, and site-wide owner
  settings stay unavailable and the Owner Console reports which tables are
  missing.

The migration is intentionally permissive because the beta signs users in
against the public `users` table with the publishable key instead of Supabase
Auth. Move to Supabase Auth before handling real payments.

## Owner console

The **Debug** nav item is only shown to the `TotallyMason` account. Opening it
asks for the TotallyMason password again, then unlocks a nine-tab console:

- **Overview** — accounts, posts, replies, reactions, uploads, wallets, scores,
  Shells in circulation, and the global top scores.
- **Users** — passwords, online/last-seen status, friend counts, join dates,
  password resets, renaming, banning/unbanning, and account deletion. The owner
  account is protected.
- **Posts** — search every post, pin or unpin, strip an attachment, and delete
  individual posts.
- **Community** — every reply and reaction with per-row removal, clear-all
  actions for replies and reactions, and a button to strip every attachment.
- **Wallets** — balances and streaks, add or set Shells, and delete wallets.
- **Scores** — recent runs with per-score deletion.
- **Friends** — every presence record (online/offline and last seen) plus all
  friendships and pending requests. Clear one record, mark everyone offline, or
  wipe every friendship.
- **Site** — announcement banner, Shells multiplier (0–20×), featured game,
  disabled games, maintenance mode, community open/closed, replies, reactions,
  uploads, registration, and the maximum upload size. TotallyMason keeps access
  while maintenance mode blocks regular players.
- **Tools** — create accounts; moderate one account's posts, streak, or presence;
  clear pins and streaks; bulk-grant Shells or all cosmetics to every account;
  give Shells or cosmetics to one account (including yourself); JSON export;
  local-cache clearing; guest-wallet cleanup; and danger-zone actions to delete
  all posts, clear all scores, or reset every wallet to the 100-Shell starting
  balance.

Deleting an account also best-effort removes that user's posts, replies,
reactions, wallet, scores, friendships, and presence record. Renaming an account
changes its username in users, wallets, posts, scores, friendships, and presence.
Press **Lock** to close the console and require the password again.

This is a developer tool, not production authentication. The app still signs in
against a public table with the publishable key, so move to Supabase Auth before
handling real user data or payments.

## Features

- Five real-time 3D arcade games powered by Three.js
- Free steering, braking, and brake lights in Beach Racer
- Guest and account authentication options
- Shells wallet, daily and streak bonuses, and a 106-item cosmetics shop
- Car paints, 14 body styles, 12 engines, surfboards, underglow, wheels,
  exhaust trails, and umbrella colours applied to the 3D beach scene
- Community posts with photo/file attachments, replies, and emoji reactions
- Owner pinning, reply/reaction moderation, and attachment stripping
- Friends tab with requests, online status, last seen, and 30-second refresh
- Password-unlocked owner console for accounts, posts, replies, reactions,
  wallets, scores, friendships, presence, bans, uploads, and site settings

## Notes

- Icons are inline SVG.
- The website requires JavaScript; a `<noscript>` message is shown otherwise.
- Owner pins are stored as a hidden marker in the post content, so they work
  with the existing `posts` schema and sync for everyone. If the post update is
  blocked, pins fall back to local storage for the owner.
- Only scores and the offline wallet fallback are cached locally. The rest of
  the site is served with cache-busting query parameters.
