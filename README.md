# LessFun

A 3D arcade with a liquid-glass interface. Play it at
[https://totallymason.github.io/lessfun/](https://totallymason.github.io/lessfun/).

## Games

| Game | What it is |
| --- | --- |
| Beach Racer | Outrun traffic on a five-lane coastal highway. Hold W / ↑ for throttle, steer freely, and brake through the pack in a 6-speed automatic. Shift P/R/N/D with Q and E, take highway exits, and race 2–3 players online with a room code. |
| Tunnel Rush | Thread an endless neon tunnel and rotate through the gaps. |
| Cube Stack | Stack the tower as high as you can before the blocks drift away. |
| Star Dodger | Weave through an asteroid storm at increasing speed. |

All four games are real-time 3D scenes rendered with Three.js.

## Play

Visit the live site at [https://totallymason.github.io/lessfun/](https://totallymason.github.io/lessfun/).

Guests can play without an account, but guest scores and posts are not saved.
Account mode keeps scores, posts, and Coins across devices once the Supabase
tables below are created.

## Run locally

The web version lives in [`docs/`](docs) and uses no build step, no bundler, and
no framework.

```sh
cd docs
python3 -m http.server 8765
```

Then open <http://localhost:8765>.

## Coins

Coins are LessFun's single soft currency. They are earned by playing and spent
on car performance parts and cosmetics. Bodies and engines change real top
speed, acceleration, and grip; the other categories are visual.

| Action | Coins |
| --- | --- |
| Every second of play | 1 (minimum 1 per run) |
| First run of the day | +25 |
| 3-day streak | +150 |
| 7-day streak | +400 |
| 14-day streak | +1,000 |

New players start with **100 Coins**. Purchases are equipped immediately, and
any owned cosmetic can be re-equipped for free. The Store has **13 global items**
and the Garage has **132 Beach Racer items**:

| Category | Items | What it does |
| --- | --- | --- |
| Global themes | 7 | Recolour the interface, HUD, and buttons across every game |
| Avatar frames | 6 | Ring colours around avatars everywhere in the app |
| Car paints | 20 | Body colour of the Beach Racer car |
| Car bodies | 20 | Real performance: top speed, acceleration, and grip (includes F1, bus, GT3, supercar, off-road, and a free beater) |
| Engines | 17 | Real power: top speed and acceleration (includes free lawnmower and V16/plasma tiers) |
| Aero parts | 8 | Real grip and top speed: splitters, wings, diffusers, GT3, ground effect, free broken wing |
| Body kits | 8 | Real acceleration and grip: widebody, track, rally, hyper, GT3, off-road, free rust kit |
| Surfboards | 15 | Roof board colour and shape detailing |
| Underglow | 11 | Neon light pool and point light under the car |
| Wheels | 12 | Rim colour, spokes, and emissive shine |
| Exhaust trails | 12 | Pulsing additive strips behind the bumper |
| Beach umbrellas | 10 | Striped canopy colour across the shoreline |

Car bodies, engines, aero parts, and body kits are **real performance parts** — each shop card shows
its Top, Accel, and Grip deltas. Paints, boards, glow, wheels, trails, and
umbrellas stay visual only. Rainbow variants cycle hue over time. A Coins
multiplier event can be enabled from the Owner Console for double-Coins
weekends.

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
- [`supabase/admins_avatars.sql`](supabase/admins_avatars.sql) — admin flags,
  selectable admin powers, and profile picture storage.
- [`supabase/messages.sql`](supabase/messages.sql) — encrypted direct messages
  and public messaging keys.
- [`supabase/presence_activity.sql`](supabase/presence_activity.sql) — friend
  activity, game, and joinable public-lobby presence.
- [`supabase/coin_gifts.sql`](supabase/coin_gifts.sql) — gift notifications and
  sender history.
- [`supabase/owner_tools.sql`](supabase/owner_tools.sql) — ban flag and site
  settings.
- [`supabase/community.sql`](supabase/community.sql) — post attachments, replies,
  post reactions, reply reactions, and the newer owner toggles.
- [`supabase/owner_debug.sql`](supabase/owner_debug.sql) — owner delete/update
  permissions.

Until migrations are run:

- Scores fall back to `localStorage` on the device.
- Coins fall back to a per-user `localStorage` wallet.
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
  Coins in circulation, and the global top scores.
- **Users** — passwords, online/last-seen status, friend counts, join dates,
  password resets, renaming, banning/unbanning, and account deletion. The owner
  account is protected.
- **Posts** — search every post, pin or unpin, strip an attachment, and delete
  individual posts.
- **Community** — every reply and reaction with per-row removal, clear-all
  actions for replies and reactions, and a button to strip every attachment.
- **Wallets** — balances and streaks, add or set Coins, and delete wallets.
- **Scores** — recent runs with per-score deletion.
- **Friends** — every presence record (online/offline and last seen) plus all
  friendships and pending requests. Clear one record, mark everyone offline, or
  wipe every friendship.
- **Site** — announcement banner, Coins multiplier (0–20×), featured game,
  disabled games, maintenance mode, community open/closed, replies, reactions,
  uploads, registration, and the maximum upload size. TotallyMason keeps access
  while maintenance mode blocks regular players.
- **Tools** — create accounts; moderate one account's posts, streak, or presence;
  clear pins and streaks; bulk-grant Coins or all cosmetics to every account;
  give Coins or cosmetics to one account (including yourself); JSON export;
  local-cache clearing; guest-wallet cleanup; and danger-zone actions to delete
  all posts, clear all scores, or reset every wallet to the 100-Coin starting
  balance.

Deleting an account also best-effort removes that user's posts, replies,
reactions, wallet, scores, friendships, and presence record. Renaming an account
changes its username in users, wallets, posts, scores, friendships, and presence.
Press **Lock** to close the console and require the password again.

This is a developer tool, not production authentication. The app still signs in
against a public table with the publishable key, so move to Supabase Auth before
handling real user data or payments.

## Features

- Four real-time 3D arcade games powered by Three.js
- Five-lane coastal highway with guardrails, streetlights, overhead signs, SUVs and trucks, merging entry ramps, exit ramps that end the run, and a much faster top speed in Beach Racer
- Beach Racer multiplayer for 2–3 players: create or join a five-character room code, race together, see each driver's name floating above their car, and pass through other players without collisions
- Checkpoint gates every 500 m with a CP counter and a +250 score bonus per gate, plus a host-only start and restart button
- Manual Q/E gear selector (P, R, N, D) with reverse and park in Beach Racer
- Speed-scaled steering that locks at a standstill, automatic drift detection from speed/steering/braking, and an **F-key FSD** mode with blue lane visualization, safe lane changes, and automatic braking
- Ignition bar, synthesized engine/tire/nitrous audio, and a drainable nitrous boost on **Shift** or **N**, with a NITRO SHIFT kick
- Gold track coins that are collected during a run and paid into the Coins wallet at game over
- Private messages with ECDH P-256 + AES-GCM end-to-end encryption, started by searching for a person in the in-game sidebar
- Coin gifting from Friends or a profile, private-message user search, and 50% cosmetic resale
- Teleport to any racer in a public lobby, and curving highway lane markings for a more dynamic road
- Single liquid-glass HUD bar for speed/status, gear, checkpoints, and coins; score is shown only on game over
- Expanded friend/profile stats: joined date, last seen, Coins, lifetime earnings, streak, posts, replies, friends, best runs, and admin status
- Touch controls for NOS, drift, and gear shifts on phones and narrow screens
- Beach Racer opens in a 3D garage orbit view with Play and Garage actions
- In-game Garage shop for car parts, opened from the Beach Racer garage screen without leaving the game
- Free downgrade parts for experimenting with slower builds
- Straight segmented highway with aligned traffic, lanes, guardrails, signs, lights, posts, coins, ramps, and checkpoints
- Game views open edge-to-edge with a compact floating X/fullscreen header
- Coin-gift notifications in a bell menu, showing who sent Coins and how much
- A one-time shared **+500 Coin** reward per session for playing multiplayer with at least one other person
- Live Now Playing list in Friends showing what signed-in players are doing, with Join buttons
- mph/km-h setting, a live FPS/resolution counter, 60 FPS-targeted automatic resolution scaling, one-piece road geometry, and throttled ocean/HUD updates
- Friend activity presence with a Join button for their current game or public lobby
- Live public multiplayer for Tunnel Rush and Star Dodger with real-time score boards, selectable from each game’s start menu
- AI traffic emergency braking with brake lights; human players get a red flash and warning beep instead of auto-braking
- Real 3D suspension on Beach Racer cars: coilover springs, control arms, independent wheel travel, body roll, brake dive, acceleration squat, and landing compression
- Longer cinematic crashes with tumbling, debris, sparks, smoke, wheel and surfboard detachment, body crumple, bounced landings, and a delayed game-over sequence (no camera shake, no slow-mo label)
- Always-on public Beach Racer lobbies for up to 50 players with no codes
- Render-resolution setting (Auto/100/85/70/50%) for smoother 3D frame rates without lowering model quality
- Owner-managed admins with selectable post, reply, and user-ban powers
- Profile pictures with upload/crop, plus richer friend cards showing joined date, Coins, best run, and presence
- Guest and account authentication options
- Coins wallet, daily and streak bonuses, a global theme/frame store, and a 132-item Beach Racer garage
- Purchases transfer the spent Coins into the TotallyMason wallet, keeping currency circulating
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
