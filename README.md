# Chess Trainer

A chess training app built for the iPad (it works on a phone and a desktop too). You can play
Stockfish at any strength, solve rated puzzles, train calculation, drill openings and endgames,
and get a chess.com-style review of every game, including games imported from chess.com or
Lichess. It runs entirely in the browser: once installed to the Home Screen it works offline, and
nothing leaves the device.

## What's in it

**Play**
- Thirteen opponents, from a 400 beginner up to full-strength Stockfish 17.1.
  - 1400 and above use Stockfish's own strength limiter (`UCI_LimitStrength` / `UCI_Elo`).
  - The weaker bots search shallowly, pick among several candidate moves with some randomness, and now and then play a loose move, so they blunder the way beginners do.
- Optional assists: progressive hints (first the piece, then the move), threat arrows, a blunder check ("are you sure?" when a move drops your winning chances a lot), and an eval bar.
- Takebacks, resign, and flip board. The game in progress survives a reload.
- Finished games are saved for Review.
- Watch: bot vs bot, with an eval bar.

**Puzzles**
- 58,133 puzzles from the Lichess puzzle database, filtered to well-tested ones and spread evenly from 400 to 2900.
- A puzzle rating (Glicko-lite) and difficulty settings (easier, normal, harder).
- A daily puzzle and 70+ themes.
- A review queue: missed puzzles come back after 1, 3, 7 and 21 days.
- Scratch pad inside every puzzle: move both sides to test a line before you commit. Nothing played there counts.
- **Visualize**, a calculation drill with its own rating.
  - The first move or two of the solution are only *announced*; the board doesn't move.
  - You play the next move from the position in your head.

**Train**
- Scratch pad, a board to think on:
  - Play through lines for both sides, with branching.
  - Move pieces freely, or place and remove them.
  - Tap a piece to see everything it controls.
  - A control map that counts white and black attackers on every square.
  - Loose-piece and threat overlays.
  - Draw arrows and circles.
  - Save candidate lines, then let Stockfish grade where each one ends up.
- Opening lines: 22 openings. Surprise mode throws common sidelines at you.
- Endgame technique: 10 positions against full-strength Stockfish.

**Review**
- Import games:
  - by chess.com username (public API, no login);
  - by Lichess username;
  - by pasted PGN or a .pgn file.
- Full game review:
  - every position is searched with two lines;
  - moves are classified by the drop in winning chances (Lichess's win% curve): brilliant, great, best, excellent, good, book, inaccuracy, mistake, miss, blunder;
  - accuracy per side and an estimated game rating;
  - an eval graph and key moments;
  - explanations with the best line;
  - Retry mistakes, where you find the better move yourself.
- Insights across your reviewed games:
  - the accuracy trend;
  - accuracy and mistakes by phase;
  - how your openings score, as White and as Black.

## The engine

Stockfish 17.1 compiled to WebAssembly (the `stockfish` npm package), running in a Web Worker.

- **Full network** (~75 MB, downloaded once, then cached by the service worker). This is the
  normal Stockfish NNUE. It uses **several threads** when the page is cross-origin isolated,
  which needs these headers:
  `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.
  The Vite dev and preview servers and `vercel.json` all set them. Safari on iPad supports this.
- **Lite network** (~7 MB). This loads in a second, so the app starts on lite and switches to full
  between two searches once the full network is ready.
- A small job queue (`src/engine/engine.js`) runs one search at a time.
  - Searches have tags, so a bot move can pre-empt a running eval without cancelling anything else.
  - If the worker dies (for example, the iPad runs low on memory), it is restarted automatically.

Settings shows which engine is running, and lets you pick the review depth (0.4 s to 3 s per position).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve dist/ with the isolation headers
```

## Deploy and install on the iPad

1. Deploy to Vercel (or any host that can send the two headers above; `vercel.json` has them).
   Without the headers everything still works, but the engine runs on one thread.
2. On the iPad, open the site in Safari → Share → **Add to Home Screen**. It opens full-screen,
   like an app, and works offline once the puzzles and the engine network have loaded.

## Project layout

```
src/
  App.jsx               shell, tabs, hash routing
  engine/
    engine.js           Stockfish workers, job queue, full/lite switching
    bots.js             the bot ladder and how each bot picks a move
    useEngine.js        React hooks: engine status, live evaluation
  lib/
    review.js           win%, move classes, accuracy, rating estimate
    analyze.js          whole-game analysis (stored with the game)
    games.js            saved games, PGN import, chess.com / Lichess fetch
    puzzles.js          puzzle packs, rating, daily, review queue, themes
    insight.js          attacks, control, hanging pieces (scratch pad, assists)
    book.js             opening names by position
    chessutil.js        UCI/SAN helpers, PGN
    prefs.js, store.js, router.js, sound.js, themes.js
  ui/
    Board.jsx           the board: tap/drag, dots, promotion, arrows, badges, overlays
    kit.jsx             eval bar, move list, eval graph, layout, small components
  modes/                Home, Play (+Watch), Puzzles, Train, Review, Insights, Settings
  data/                 opening drills, endgame drills, piece sets
public/
  puzzles/              puzzle packs by 100-point rating band (p04.json … p29.json)
  data/openings.json    ECO names for 3,800 opening positions
scripts/
  build-puzzles.py      rebuilds public/puzzles from the Lichess puzzle CSV
  build-openings.mjs    rebuilds public/data/openings.json from lichess-org/chess-openings
```

Everything you do is stored in `localStorage` on the device. Settings → Data can export and
restore a backup.

## Credits

- Stockfish 17.1 (GPLv3), via the `stockfish` npm package.
- Puzzles: the Lichess puzzle database (CC0).
- Opening names: lichess-org/chess-openings (CC0).
- Classic pieces: cburnett.
