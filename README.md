# LessFun

A whole buncha small, questionable games. Built with SwiftUI — and mirrored as a
static website you can host on GitHub Pages.

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

Every game has three difficulty modes — **Chill**, **Normal**, and **Brutal** — and
keeps your best score between launches.

## Run the iOS app

1. Open `iOSDemo.xcodeproj` in Xcode.
2. Pick an iPhone simulator.
3. Press **Run** (⌘R).

Or from the command line:

```sh
xcodebuild -project iOSDemo.xcodeproj -scheme iOSDemo \
  -destination 'platform=iOS Simulator,name=iPhone 18 Pro' build
```

Testing hook: `-game memory` opens a game directly (raw values: `tapFrenzy`, `memory`,
`ticTacToe`, `whack`, `reaction`, `higherLower`, `rps`, `guessNumber`, `dice`, `coinFlip`).

## Run the website

The web version lives in [`docs/`](docs) and uses no build step, no dependencies, and
no framework:

```
docs/
├── index.html        # shell, meta tags, script order
├── styles.css        # layout, animations, responsive rules
├── icon.png          # favicon / social preview
├── .nojekyll         # serve files as-is on GitHub Pages
└── js/
    ├── base.js           # namespace, SVG icons, storage, timers, helpers
    ├── games-arcade.js   # Tap Frenzy, Whack-a-Mole, Reaction Test
    ├── games-puzzle.js   # Memory Match, Tic-Tac-Toe, Guess the Number
    ├── games-luck.js     # Higher / Lower, Dice Roller, Coin Flip
    ├── games-versus.js   # Rock Paper Scissors
    └── app.js            # home screen, hash router, game shell, results modal
```

Preview it locally:

```sh
cd docs
python3 -m http.server 8765
```

Then open <http://localhost:8765>. Games are addressable by hash, for example
<http://localhost:8765/#tapFrenzy> or <http://localhost:8765/#rps>.

Best scores are stored in `localStorage` under the same `lessfun.*` keys the iOS app
uses in `@AppStorage`, so the two versions share a naming scheme (not data — browser and
device storage are separate).

## Deploy to GitHub Pages

Pages serves the site from the repository's `main` branch and `/docs` folder. The
included `deploy.sh` handles the whole flow:

```sh
cd /Users/masonwong/iOSDemo
gh auth login          # one time only
./deploy.sh            # repo name defaults to "lessfun"
```

The script:

1. Verifies the GitHub CLI is installed and authenticated.
2. Initializes Git (if needed) and sets a commit identity from your GitHub account.
3. Commits the current tree and pushes it to `main`.
4. Creates the public repository when it does not exist yet.
5. Enables GitHub Pages with **Source: Deploy from a branch → `main` → `/docs`**.

When it finishes, the site is available at:

```
https://<your-github-username>.github.io/lessfun/
```

To use a different repository name, pass it as the first argument:

```sh
./deploy.sh my-arcade
```

Manual setup works too: push the project to GitHub, open **Settings → Pages**, then set
**Source** to **Deploy from a branch**, branch **`main`**, folder **`/docs`**.

### Updating the live site

```sh
./deploy.sh
```

Each run commits the current files and pushes. GitHub Pages rebuilds automatically in a
minute or two.

## Notes

- The app is branded **LessFun**; the Xcode target is still `iOSDemo`.
- Icons are inline SVG on the web and SF Symbols on iOS — no emoji anywhere.
- The website requires JavaScript; a `<noscript>` message is shown otherwise.
