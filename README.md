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
- A coach (on by default) and optional assists: progressive hints (first the piece, then the move), threat arrows, a blunder check ("are you sure?" when a move drops your winning chances a lot), and an eval bar.
- Takebacks, resign, and flip board. The game in progress survives a reload.
- Finished games are saved for Review.

**Watch** (its own tab)
- Two bots from the ladder play each other, and the coach commentates every move.
  - The move's class (best, excellent, inaccuracy, mistake, blunder, great, brilliant, book), the same as in Review.
  - The coach's reason, in plain English: what goes wrong after it, what was better and why.
  - How much it moved the mover's winning chances, e.g. *White's winning chances 43% → 15% (−28)*.
- A win-chance graph with the big swings marked, and a row of key moments you can jump to.
- Pause any time to ask "Threat?" or "Plan?" for the side to move, or to step through the better move and "why it goes wrong".
- **Pause on mistakes** stops the match after a mistake or blunder so you can look at it.
- Pace: fast, normal or slow. Every position is analysed before the next move is played, so the commentary always keeps up.
- The match survives a reload. Finished matches are saved with their analysis (accuracy for both bots), so Review opens them straight away.

**Puzzles**
- 58,133 puzzles from the Lichess puzzle database, filtered to well-tested ones and spread evenly from 400 to 2900.
- A puzzle rating (Glicko-lite) and difficulty settings (easier, normal, harder).
- A daily puzzle and 70+ themes.
- A review queue: missed puzzles come back after 1, 3, 7 and 21 days.
- Scratch pad inside every puzzle: try a line before you commit, with Stockfish answering your moves if you like. Nothing played there counts.
- **Visualize**, a calculation drill with its own rating.
  - The first move or two of the solution are only *announced*; the board doesn't move.
  - You play the next move from the position in your head.

**Train**
- Opening courses, chessreps-style. There are 12 courses as White (Italian, 4.Ng5/Fried Liver, Ruy Lopez, Scotch, Vienna, London, Queen's Gambit, and answers to the Sicilian, French, Caro-Kann, Scandinavian and everything else) and 7 as Black (1...e5, Caro-Kann, French, Scandinavian, QGD, Slav, King's Indian).
  - Each course is a tree built from about 2.7 million Lichess blitz and rapid games between players rated 700–2000. It covers every reply people at that level actually play, with its frequency.
  - Your moves are the natural moves Stockfish agrees with.
  - Opponent mistakes are marked with the line that punishes them.
  - Traps (where the most popular move is a mistake) are flagged.
  - Three modes:
    - Explore: walk the tree.
    - Learn: moves shown and explained.
    - Practice: from memory, with spaced repetition.
- Middlegame checklist and example plans to play out with the coach.
- Checkmate patterns (themed puzzles) and endgame basics.
- Scratch pad:
  - Play lines, or move pieces freely.
  - See what a piece controls.
  - Checks and captures overlays, loose pieces, pieces under attack.
  - Ask the coach "what's the threat?" and "what's the plan?".
  - Grade candidate lines.

**The coach** (built in, offline; `src/lib/coach.js`)
- Explains moves in plain English using Stockfish's lines plus the classic rules of thumb:
  - tactics: forks, pins, skewers, discovered attacks, undefended pieces, mates;
  - development, castling, weakening your king, moving a piece twice, early queen moves, f7/f2, pawn breaks, open files, outposts.
- Used by Play (after each of your moves, threat warnings, plan ideas), Review, the scratch pad and the opening courses.
- **Step through**: any line (the better move, what goes wrong after yours, an engine line) can be played one move at a time, or slowly on auto-play, with the reason for each move.

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
    coach.js            the coach: move explanations, threats, plans
    coachEngine.js      the coach's engine questions (judge a move, find the threat, plan)
    repertoire.js       opening courses and their spaced repetition
    puzzles.js          puzzle packs, rating, daily, review queue, themes
    insight.js          attacks, control, hanging pieces (scratch pad, assists)
    book.js             opening names by position
    chessutil.js        UCI/SAN helpers, PGN
    prefs.js, store.js, router.js, sound.js, themes.js
  ui/
    Board.jsx           the board: tap/drag, dots, promotion, arrows, badges, overlays
    kit.jsx             eval bar, move list, eval graph, layout, small components
  modes/                Home, Play, Watch, Puzzles, Train, Review, Insights, Settings
  data/                 opening drills, endgame drills, piece sets
public/
  puzzles/              puzzle packs by 100-point rating band (p04.json … p29.json)
  data/openings.json    ECO names for 3,800 opening positions
scripts/
  build-puzzles.py      rebuilds public/puzzles from the Lichess puzzle CSV
  build-openings.mjs    rebuilds public/data/openings.json from lichess-org/chess-openings
  build-repertoire.py   rebuilds the opening courses (public/data/rep) from Lichess games + Stockfish
```

Everything you do is stored in `localStorage` on the device. Settings → Data can export and
restore a backup.

## Credits

- Stockfish 17.1 (GPLv3), via the `stockfish` npm package.
- Puzzles: the Lichess puzzle database (CC0).
- Opening names: lichess-org/chess-openings (CC0).
- Classic pieces: cburnett.
