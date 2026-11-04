# LessFun

A collection of small, fun mini-games. Play them at [https://totallymason.github.io/lessfun/](https://totallymason.github.io/lessfun/).

## Games

| Game | What it is |
| --- | --- |
| Tap Frenzy | Tap fast for a combo multiplier before the clock runs out. |
| Memory Match | Flip cards, find every pair, and beat your move count. |
| Tic-Tac-Toe | Outsmart a robot that gets tougher with difficulty. |
| Whack-a-Mole | Bonk moles, grab gold, avoid bombs. |
| Reaction Test | Tap when the screen turns green across five rounds. |
| Higher / Lower | Call the next card with three lives and a streak multiplier. |
| Rock Paper Scissors | First to three wins the series. |
| Guess the Number | Narrow down a hidden number before you run out of tries. |
| Dice Roller | Predict the total and risk your chips. |
| Coin Flip | Pick a side, build a streak, protect your lives. |

## Play

Visit the live site at [https://totallymason.github.io/lessfun/](https://totallymason.github.io/lessfun/).

## Run locally

The web version lives in [`docs/`](docs) and uses no build step, no dependencies, and no framework.

Preview it locally:

```sh
cd docs
python3 -m http.server 8765
```

Then open <http://localhost:8765>. The arcade includes Beach Racer, Tunnel
Rush, Cube Stack, Helix Drop, and Star Dodger — all rendered in real 3D.

## Features

- Five real-time 3D arcade games powered by Three.js
- Free steering and braking in Beach Racer
- Guest and account authentication options
- Community posts with owner pinning

## Notes

- Icons are inline SVG — no emoji anywhere.
- The website requires JavaScript; a `<noscript>` message is shown otherwise.
- Community pins sync for everyone when the `posts` table has a boolean `pinned`
  column. If that column is missing, the owner's pins are kept locally on their
  device.
