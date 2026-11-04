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
| Every 1,000 points in a run | 1 (minimum 1 per scoring run) |
| First run of the day | +25 |
| 3-day streak | +150 |
| 7-day streak | +400 |
| 14-day streak | +1,000 |

New players start with **100 Shells**. Car paints cost 250–1,200 and surfboards
cost 300–1,500. Purchases are equipped immediately, and any owned cosmetic can
be re-equipped for free.

## Supabase setup

The app reads and writes `users`, `posts`, `scores`, and `wallets`. Run
[`supabase/lessfun_shells.sql`](supabase/lessfun_shells.sql) once in the
Supabase dashboard (**SQL Editor → New query → paste → Run**). It creates the
`wallets` and `scores` tables and enables the row-level-security policies the
browser client needs.

Until that migration is run:

- Scores fall back to `localStorage` on the device.
- Shells fall back to a per-user `localStorage` wallet.
- Account codes still sign in, but nothing syncs between devices.

The migration is intentionally permissive because the beta signs users in
against the public `users` table with the publishable key instead of Supabase
Auth. Move to Supabase Auth before handling real payments.

## Features

- Five real-time 3D arcade games powered by Three.js
- Free steering, braking, and brake lights in Beach Racer
- Guest and account authentication options
- Shells wallet, daily and streak bonuses, and a cosmetics shop
- Car paints and surfboards applied to the 3D beach buggy
- Community posts with owner pinning

## Notes

- Icons are inline SVG.
- The website requires JavaScript; a `<noscript>` message is shown otherwise.
- Owner pins are stored as a hidden marker in the post content, so they work
  with the existing `posts` schema and sync for everyone. If the post update is
  blocked, pins fall back to local storage for the owner.
- Only scores and the offline wallet fallback are cached locally. The rest of
  the site is served with cache-busting query parameters.
