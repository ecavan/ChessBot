# Chess Intuition Trainer

Personal chess training app — play against Stockfish with real-time hints, threat visualization, and blunder warnings. Not a chess platform. A thinking coach in a browser tab.

Runs entirely in the browser (Stockfish WASM). Deploys free to Vercel via GitHub. No server costs.

---

## Table of Contents

1. [How It Works](#1-how-it-works)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [The Engine Layer — Stockfish WASM](#5-the-engine-layer--stockfish-wasm)
6. [Game Modes](#6-game-modes)
7. [The Hint & Visualization System](#7-the-hint--visualization-system)
8. [Frontend](#8-frontend)
9. [Implementation Order](#9-implementation-order)
10. [Running Locally](#10-running-locally)
11. [Deploying to Vercel (Free)](#11-deploying-to-vercel-free)
12. [Future Expansions](#12-future-expansions)

---

## 1. How It Works

**Key insight vs the poker app:** In chess, optimal play is already solved — Stockfish is freely available and runs in the browser via WebAssembly. You don't need to build a solver. Your value is in how you surface engine output as human-learnable intuition.

Three modes:

**Play Mode (Guided)** — Play against Stockfish at adjustable strength. Optional blunder warnings before you commit a move. Optional hint requests. Arrows and highlights show threats and piece influence. You learn by playing with a safety net.

**Opening Sandbox** — Load your 1-2 openings. Engine plays book moves. When you deviate, it explains why the book move is better. Drill your repertoire without memorizing 20 moves deep.

**Review Mode** — After a game (or paste a PGN), blunders are highlighted with one-sentence explanations and visual arrows. Simplified chess.com game review, focused on "what went wrong and why" not exhaustive engine lines.

---

## 2. Architecture

Everything runs client-side. No backend needed.

```
┌──────────────────────────────────────────────────┐
│                   BROWSER                         │
│                                                   │
│  React app                                        │
│   ├── chess.js         (game logic, legality)     │
│   ├── chessboard UI    (board rendering, drag)    │
│   ├── Stockfish WASM   (engine, runs in worker)   │
│   └── hint/viz system  (arrows, highlights)       │
│                                                   │
│  No server calls. Works offline after first load. │
└──────────────────────────────────────────────────┘
```

This is the critical difference from the poker app: no Flask, no Python, no API routes. The entire app is static files — HTML, JS, CSS, and the Stockfish WASM binary. Vercel serves them as static assets. Stockfish runs in a Web Worker so it doesn't block the UI.

Since your background is Python not JS, this is more frontend-heavy than the poker app. But the JS ecosystem for chess is very mature — `chess.js` handles all move legality and game state, and there are multiple board rendering libraries. You're mostly wiring things together.

---

## 3. Tech Stack

| Component | Tool | Why |
|-----------|------|-----|
| Chess logic | `chess.js` | Move legality, FEN, PGN, check/checkmate detection. npm package. |
| Board rendering | `react-chessboard` | React component, drag-and-drop, custom square styling, arrow drawing built in. |
| Engine | `stockfish.js` (WASM) | Stockfish 16 compiled to WebAssembly. Runs in browser Web Worker. Free, fast, offline. |
| Framework | React (Vite) | Minimal setup, fast dev server, builds to static files for Vercel. |
| Styling | Tailwind CSS | Same as poker app. CDN or Vite plugin. |
| Deployment | Vercel | Static site deployment. Push to GitHub → auto-deploys. Free. |

### Dependencies

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "chess.js": "^1.0",
    "react-chessboard": "^4",
    "stockfish": "^16"
  },
  "devDependencies": {
    "vite": "^5",
    "@vitejs/plugin-react": "^4",
    "tailwindcss": "^3",
    "autoprefixer": "^10",
    "postcss": "^8"
  }
}
```

---

## 4. Project Structure

```
chess-trainer/
├── public/
│   └── stockfish/
│       ├── stockfish.js          # Stockfish WASM loader
│       └── stockfish.wasm        # Stockfish binary (~2MB)
├── src/
│   ├── main.jsx                  # App entry point
│   ├── App.jsx                   # Top-level: mode selector + routing
│   ├── engine/
│   │   ├── useStockfish.js       # React hook: init worker, send/receive UCI commands
│   │   ├── analysis.js           # Parse engine output: best move, eval, lines
│   │   └── hints.js              # Convert engine analysis → human-readable hints
│   ├── components/
│   │   ├── Board.jsx             # Chessboard with arrows, highlights, drag-and-drop
│   │   ├── MoveList.jsx          # Scrollable move history
│   │   ├── EvalBar.jsx           # Vertical eval bar (white/black advantage)
│   │   ├── HintPanel.jsx         # Hint display: text + highlighted squares
│   │   ├── BlunderAlert.jsx      # Pre-move warning overlay
│   │   ├── GameControls.jsx      # New game, undo, flip board, settings
│   │   └── ReviewPanel.jsx       # Post-game blunder summary
│   ├── modes/
│   │   ├── PlayMode.jsx          # Guided play vs engine
│   │   ├── OpeningSandbox.jsx    # Opening repertoire trainer
│   │   └── ReviewMode.jsx        # PGN review with blunder detection
│   ├── data/
│   │   └── openings.js           # Your opening lines (e.g. Italian Game, Sicilian)
│   └── utils/
│       ├── arrows.js             # Generate arrow/highlight data from engine moves
│       └── classify.js           # Classify move quality: brilliant/great/good/inaccuracy/mistake/blunder
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── vercel.json
```

---

## 5. The Engine Layer — Stockfish WASM

### How Stockfish WASM works

Stockfish has been compiled to WebAssembly. It runs entirely in the browser inside a Web Worker (so it doesn't freeze the UI). You communicate with it via UCI (Universal Chess Interface) — text commands sent as messages to the worker.

```
Your app  ──postMessage──>  Web Worker (stockfish.js + .wasm)
          <──onmessage───  
```

UCI protocol basics — the only commands you need:

| Command | What it does |
|---------|-------------|
| `uci` | Initialize, engine responds with `uciok` |
| `isready` | Ping, responds `readyok` |
| `ucinewgame` | Reset for new game |
| `position fen <fen>` | Set board position |
| `position startpos moves e2e4 e7e5 ...` | Set position via move list |
| `go depth 15` | Search to depth 15, responds with `bestmove e2e4` |
| `go movetime 1000` | Search for 1 second |
| `setoption name Skill Level value 5` | Set engine strength (0-20) |
| `setoption name MultiPV value 3` | Get top 3 lines (for hints) |

### The `useStockfish` React hook

This is the core interface between your app and the engine:

```javascript
// src/engine/useStockfish.js

import { useState, useEffect, useRef, useCallback } from 'react';

export function useStockfish() {
  const workerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [bestMove, setBestMove] = useState(null);
  const [topLines, setTopLines] = useState([]);
  const resolveRef = useRef(null);

  useEffect(() => {
    const worker = new Worker('/stockfish/stockfish.js');
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const line = e.data;

      if (line === 'uciok' || line === 'readyok') {
        setIsReady(true);
      }

      // Parse evaluation from "info" lines
      // Format: info depth 15 score cp 45 pv e2e4 e7e5 ...
      if (line.startsWith('info depth')) {
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        const pvMatch = line.match(/pv (.+)/);
        const multiPvMatch = line.match(/multipv (\d+)/);

        const pvIndex = multiPvMatch ? parseInt(multiPvMatch[1]) - 1 : 0;

        if (cpMatch || mateMatch) {
          const eval_ = cpMatch
            ? parseInt(cpMatch[1]) / 100  // centipawns → pawns
            : (mateMatch ? (parseInt(mateMatch[1]) > 0 ? 100 : -100) : 0);
          const pv = pvMatch ? pvMatch[1].split(' ') : [];

          setTopLines(prev => {
            const updated = [...prev];
            updated[pvIndex] = { eval: eval_, moves: pv };
            return updated;
          });

          if (pvIndex === 0) setEvaluation(eval_);
        }
      }

      // Parse best move
      if (line.startsWith('bestmove')) {
        const move = line.split(' ')[1];
        setBestMove(move);
        if (resolveRef.current) {
          resolveRef.current(move);
          resolveRef.current = null;
        }
      }
    };

    worker.postMessage('uci');
    worker.postMessage('isready');

    return () => worker.terminate();
  }, []);

  const analyze = useCallback((fen, depth = 15) => {
    const w = workerRef.current;
    if (!w) return;
    setTopLines([]);
    setBestMove(null);
    w.postMessage(`position fen ${fen}`);
    w.postMessage(`go depth ${depth}`);
  }, []);

  const getBestMove = useCallback((fen, depth = 15) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      analyze(fen, depth);
    });
  }, [analyze]);

  const setSkillLevel = useCallback((level) => {
    // 0 = weakest, 20 = full strength
    const w = workerRef.current;
    if (!w) return;
    w.postMessage(`setoption name Skill Level value ${level}`);
  }, []);

  const setMultiPV = useCallback((n) => {
    const w = workerRef.current;
    if (!w) return;
    w.postMessage(`setoption name MultiPV value ${n}`);
  }, []);

  const newGame = useCallback(() => {
    const w = workerRef.current;
    if (!w) return;
    w.postMessage('ucinewgame');
    w.postMessage('isready');
  }, []);

  return {
    isReady, evaluation, bestMove, topLines,
    analyze, getBestMove, setSkillLevel, setMultiPV, newGame
  };
}
```

### Adjustable engine strength

Stockfish's Skill Level 0-20 maps roughly to:

| Skill Level | Approximate Rating | Good for |
|-------------|-------------------|----------|
| 0-3 | 800-1200 | Complete beginners |
| 4-7 | 1200-1500 | Casual players |
| 8-12 | 1500-1800 | Intermediate (your range) |
| 13-16 | 1800-2200 | Advanced |
| 17-20 | 2200+ | Expert/master |

Start at 8-10. The engine plays solid principled chess without crushing you instantly.

### Blunder detection

To detect blunders, evaluate the position BEFORE and AFTER the player's move:

```javascript
// src/engine/analysis.js

export function classifyMove(evalBefore, evalAfter, isWhite) {
  // Evals are always from white's perspective
  // Flip sign if black is moving
  const before = isWhite ? evalBefore : -evalBefore;
  const after = isWhite ? evalAfter : -evalAfter;
  const loss = before - after;  // positive = player lost advantage

  if (loss >= 3.0) return 'blunder';      // lost 3+ pawns of eval
  if (loss >= 1.5) return 'mistake';       // lost 1.5-3 pawns
  if (loss >= 0.5) return 'inaccuracy';    // lost 0.5-1.5 pawns
  if (loss <= -0.5) return 'great';        // gained 0.5+ (found a tactic)
  return 'good';
}
```

The flow for pre-move blunder warning (guided mode):

1. User picks up a piece (or clicks a square)
2. Before committing the move, engine evaluates the resulting position
3. Compare eval before vs after
4. If blunder: show overlay "This move loses material — are you sure?"
5. User can confirm or reconsider

---

## 6. Game Modes

### 6.1 Play Mode (Guided)

The main mode. Play a full game against the engine with training wheels.

**Settings:**
- Engine strength (slider: Skill Level 0-20)
- Blunder warnings: on/off (warn before you commit a blunder)
- Hint availability: off / on request / always visible
- Your color: white / black / random

**During your turn:**
- Click a piece → legal moves highlighted (standard)
- Optional: threat arrows shown (what opponent is attacking)
- Optional: "Hint" button → shows 2-3 candidate moves with arrows, doesn't reveal which is best
- Optional: "Show best" button → reveals the engine's top choice (use sparingly)

**After your move:**
- Eval bar updates
- If blunder/mistake: brief notation in move list ("? Hangs the knight")
- Game continues

**After the game:**
- Quick summary: X blunders, Y mistakes, Z inaccuracies
- Can replay any position and see the better move

**State management** — all in React state:

```javascript
const [game, setGame] = useState(new Chess());   // chess.js instance
const [history, setHistory] = useState([]);        // {move, fen, eval, classification}
const [settings, setSettings] = useState({
  skillLevel: 10,
  blunderWarnings: true,
  hintsAvailable: true,
  playerColor: 'white'
});
```

### 6.2 Opening Sandbox

You play 1-2 openings. This mode drills them.

**How it works:**
- You pick an opening from your repertoire (stored in `src/data/openings.js`)
- You play your moves. Engine responds with book moves.
- If you play a book move: green highlight, continue
- If you deviate from book: yellow highlight + "Book move was Nf3 — developing the knight toward the center and preparing to castle"
- After the opening (8-15 moves), transition to free play vs engine

**Opening data format:**

```javascript
// src/data/openings.js

export const OPENINGS = {
  italian_game: {
    name: "Italian Game",
    color: "white",
    // Mainline moves as UCI strings
    moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5"],
    // Common deviations and responses
    deviations: {
      // After 1.e4 e5 2.Nf3, if black plays d6 instead of Nc6:
      "e2e4 e7e5 g1f3 d7d6": {
        explanation: "This is the Philidor Defense. Solid but passive.",
        bookResponse: "d2d4"
      },
      // Add your common opponent deviations here
    },
    principles: [
      "Control the center with e4/d4",
      "Develop knights before bishops",
      "Castle early",
      "Don't move the same piece twice in the opening"
    ]
  },
  sicilian_najdorf: {
    name: "Sicilian Najdorf",
    color: "black",
    moves: ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4", "g8f6", "b1c3", "a7a6"],
    deviations: { /* ... */ },
    principles: [ /* ... */ ]
  }
};
```

You maintain this file yourself. Add openings as you learn them. Start with just the ones you actually play.

### 6.3 Review Mode

Paste a PGN or replay a game you just played. Engine analyzes every move.

**How it works:**
1. Paste PGN text or use the game you just finished in Play Mode
2. Engine evaluates every position (depth 15-18, runs in background)
3. Move list is color-coded: green (good), yellow (inaccuracy), orange (mistake), red (blunder)
4. Click any move to see:
   - The position
   - What you played vs what engine recommends
   - Arrows showing the better move
   - One-line explanation

**Analysis pipeline:**

```javascript
// src/modes/ReviewMode.jsx — analysis loop

async function analyzeGame(pgn) {
  const game = new Chess();
  game.loadPgn(pgn);
  const moves = game.history({ verbose: true });

  const analysis = [];
  const replay = new Chess();

  for (const move of moves) {
    const fenBefore = replay.fen();
    const isWhite = replay.turn() === 'w';

    // Get engine eval of position before move
    const evalBefore = await getBestMove(fenBefore, 15);
    const bestMoveBefore = evalBefore; // the move engine would play

    // Make the actual move
    replay.move(move.san);
    const fenAfter = replay.fen();

    // Get engine eval after the move
    const evalAfter = await getBestMove(fenAfter, 15);

    const classification = classifyMove(
      evalBefore.eval, evalAfter.eval, isWhite
    );

    analysis.push({
      move: move.san,
      fen: fenBefore,
      fenAfter,
      classification,
      bestMove: bestMoveBefore,
      playerMove: move,
      evalBefore: evalBefore.eval,
      evalAfter: evalAfter.eval,
    });
  }

  return analysis;
}
```

**One-line explanations** — generate from the position context:

```javascript
// src/engine/hints.js

export function explainBlunder(position, playerMove, bestMove, evalLoss) {
  // Check if a piece is hanging after the move
  // Check if it allows a fork/pin/skewer
  // Check if it loses castling rights
  // Fallback to generic explanation

  if (evalLoss >= 3.0) {
    return `This loses significant material. ${bestMove.san} was much stronger.`;
  }
  if (evalLoss >= 1.5) {
    return `This weakens your position. Consider ${bestMove.san} instead.`;
  }
  return `Slight inaccuracy. ${bestMove.san} was more precise.`;
}
```

You can make these smarter over time — detect specific tactical patterns (forks, pins, hanging pieces) using chess.js to check if pieces are attacked. But generic explanations work fine for v1.

---

## 7. The Hint & Visualization System

### Arrows and highlights

`react-chessboard` has built-in support for custom arrows and square highlighting:

```jsx
<Chessboard
  position={game.fen()}
  onPieceDrop={onDrop}
  customArrows={[
    // [from, to, color]
    ['e2', 'e4', 'rgb(0, 128, 0)'],      // green: best move
    ['g1', 'f3', 'rgb(0, 100, 200)'],     // blue: alternative
  ]}
  customSquareStyles={{
    'e5': { backgroundColor: 'rgba(255, 0, 0, 0.4)' },   // red: danger
    'd4': { backgroundColor: 'rgba(0, 255, 0, 0.3)' },    // green: target
  }}
/>
```

### Hint levels (progressive disclosure)

When user clicks "Hint", don't immediately show the answer. Layer it:

**Level 1 — "Look at...":** Highlight 2-3 key squares without showing moves. "Something important is happening on the e-file." Just colored squares.

**Level 2 — "Consider...":** Show 2-3 candidate move arrows (including the best move mixed in). User still has to figure out which is best.

**Level 3 — "Best move:"** Show the engine's top choice with a green arrow and a brief why.

```javascript
// src/engine/hints.js

export function generateHint(topLines, game, level) {
  if (level === 1) {
    // Highlight destination squares of top 3 moves
    const squares = topLines.slice(0, 3).map(line => {
      const move = line.moves[0]; // UCI format like "e2e4"
      return move.slice(2, 4);    // destination square
    });
    return { type: 'squares', squares, text: 'Pay attention to these squares.' };
  }

  if (level === 2) {
    // Show arrows for top 3 candidate moves
    const arrows = topLines.slice(0, 3).map((line, i) => {
      const from = line.moves[0].slice(0, 2);
      const to = line.moves[0].slice(2, 4);
      const color = i === 0 ? 'green' : 'blue';
      return [from, to, color];
    });
    return { type: 'arrows', arrows, text: 'These are the candidate moves.' };
  }

  // Level 3: best move
  const best = topLines[0];
  const from = best.moves[0].slice(0, 2);
  const to = best.moves[0].slice(2, 4);
  return {
    type: 'bestMove',
    arrows: [[from, to, 'green']],
    text: `Best move: ${uciToSan(best.moves[0], game)}`,
  };
}
```

### Threat visualization

On your turn, optionally show what opponent is threatening:

```javascript
// src/utils/arrows.js

export function getThreats(game) {
  // Temporarily switch turn to opponent
  // Get all legal opponent moves
  // Filter for captures
  // Return as red arrows

  const fen = game.fen();
  const parts = fen.split(' ');
  parts[1] = parts[1] === 'w' ? 'b' : 'w'; // flip turn
  const flipped = new Chess(parts.join(' '));

  const threats = [];
  for (const move of flipped.moves({ verbose: true })) {
    if (move.captured) {
      threats.push({
        from: move.from,
        to: move.to,
        piece: move.piece,
        captured: move.captured,
      });
    }
  }

  return threats.map(t => [t.from, t.to, 'rgba(255, 0, 0, 0.6)']);
}
```

---

## 8. Frontend

### Layout

```
┌─────────────────────────────────────────────────┐
│  [Play] [Openings] [Review]        ⚙ Settings   │
├────────────────────────┬────────────────────────┤
│                        │                        │
│    ┌──────────────┐    │  Eval Bar  ████░░░░    │
│    │              │    │  +1.3 (White)          │
│    │  Chessboard  │    │                        │
│    │  (with       │    │  Move List:            │
│    │   arrows &   │    │  1. e4   e5            │
│    │   highlights)│    │  2. Nf3  Nc6           │
│    │              │    │  3. Bc4  Bc5  ?!       │
│    └──────────────┘    │                        │
│                        │  ┌──────────────────┐  │
│  [Hint 💡] [Undo ↩]   │  │ Hint Panel       │  │
│  [New Game] [Flip ↕]  │  │ "Consider the    │  │
│                        │  │  e-file..."      │  │
│                        │  └──────────────────┘  │
├────────────────────────┴────────────────────────┤
│  Blunder Warning (overlay when triggered)       │
│  "⚠ This hangs your knight. Reconsider?"       │
│  [Play anyway]  [Take back]                     │
└─────────────────────────────────────────────────┘
```

### Board component

```jsx
// src/components/Board.jsx

import { useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

export default function Board({
  game, onMove, arrows, squareStyles,
  playerColor, onPieceClick
}) {
  function onDrop(sourceSquare, targetSquare) {
    const move = game.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q'  // always promote to queen for simplicity
    });
    if (move === null) return false; // illegal
    onMove(move);
    return true;
  }

  return (
    <Chessboard
      id="trainer-board"
      position={game.fen()}
      onPieceDrop={onDrop}
      boardOrientation={playerColor}
      customArrows={arrows || []}
      customSquareStyles={squareStyles || {}}
      boardWidth={480}
      customBoardStyle={{
        borderRadius: '4px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
      }}
    />
  );
}
```

### Settings (stored in React state, no persistence needed)

```javascript
const [settings, setSettings] = useState({
  skillLevel: 10,           // 0-20
  blunderWarnings: true,     // warn before committing blunders
  showThreats: false,        // show opponent threat arrows
  showEval: true,            // show eval bar
  hintLevel: 0,              // 0=off, 1=squares, 2=candidates, 3=best
  playerColor: 'white',
  engineDepth: 15,           // analysis depth
});
```

---

## 9. Implementation Order

### Phase 1: Play vs Engine (1 week)

Minimal viable game. You can play chess against Stockfish in your browser.

1. **Vite + React scaffold**: `npm create vite@latest chess-trainer -- --template react`, add Tailwind
2. **Stockfish WASM setup**: Download `stockfish.js` + `stockfish.wasm` into `public/stockfish/`. Test that the worker loads and responds to `uci`.
3. **`useStockfish` hook**: Init worker, send UCI commands, parse `bestmove` responses
4. **Board component**: `react-chessboard` with `chess.js` for legality. Drag and drop. Player makes move → engine responds.
5. **Engine move loop**: After player moves, send position to Stockfish, get best move, apply it to the board. Add a small delay (500ms) so it feels like thinking.
6. **Skill level slider**: `setoption name Skill Level value X` on change
7. **Eval bar**: Parse `score cp` from engine info lines, render as a vertical bar
8. **Move list**: Track game history, display as scrollable list
9. **New game / undo / flip board** controls
10. Deploy: `vercel.json`, push to GitHub, live on Vercel

**Milestone: playable chess game against adjustable-strength Stockfish.**

### Phase 2: Hints + Blunder Warnings (1 week)

The training layer on top of the game.

11. **MultiPV analysis**: Set `setoption name MultiPV value 3` to get top 3 lines. Parse all three from engine output.
12. **Blunder detection**: Before committing player's move, evaluate the resulting position. Compare eval before/after. If loss ≥ 2.0, show warning overlay.
13. **Pre-move evaluation flow**: Player picks up piece → tentatively make move in a cloned game → analyze → warn or allow → commit or undo.
14. **Hint button (3 levels)**: Click once → highlight key squares. Click again → show candidate arrows. Click third time → show best move. Reset on new position.
15. **Threat visualization toggle**: Show red arrows for opponent's attacking moves.
16. **Move classification**: Color-code moves in the move list (green/yellow/orange/red).
17. **Post-game summary**: Count blunders/mistakes/inaccuracies, show in a modal after checkmate/resignation.

**Milestone: guided play with real-time coaching assistance.**

### Phase 3: Opening Sandbox + Review (1 week)

18. **Opening data file**: Add your 1-2 openings to `src/data/openings.js` with mainline moves and deviation explanations.
19. **Opening sandbox mode**: Match player moves against book. Green highlight for book moves, yellow + explanation for deviations. Engine plays book responses. After opening phase (~10 moves), transition to free play.
20. **Review mode**: Accept PGN paste. Run engine analysis on every move (show progress bar — this takes 10-30 seconds for a full game). Color-code move list. Click any move to see position + arrows + explanation.
21. **One-line explanations**: Generate from eval loss + whether material changed. Smarter detection (forks, hanging pieces) can come later.

**Milestone: full training suite — play, drill openings, review games.**

---

## 10. Running Locally

```bash
# Create project
npm create vite@latest chess-trainer -- --template react
cd chess-trainer
npm install chess.js react-chessboard
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Download Stockfish WASM
mkdir -p public/stockfish
# Download stockfish.js and stockfish.wasm from:
# https://github.com/nicfab/stockfish.wasm/releases
# or https://github.com/nicollash/stockfish.wasm
# Place both files in public/stockfish/

# Run dev server
npm run dev
# → http://localhost:5173
```

### Getting Stockfish WASM

Multiple options:

1. **stockfish.wasm npm package**: `npm install stockfish` — includes WASM build, import as worker
2. **Direct download**: Grab `stockfish.js` + `stockfish.wasm` from a release, drop in `public/stockfish/`
3. **lichess's build**: [lichess/stockfish.wasm](https://github.com/nicfab/stockfish.wasm) — battle-tested, used in production

Option 2 is simplest. The WASM file is ~2MB and loads once.

---

## 11. Deploying to Vercel (Free)

Since this is a pure static site (no backend), deployment is trivial.

### vercel.json

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

That's it. Vercel auto-detects Vite projects.

### Deploy

```bash
npm i -g vercel
vercel          # first time, follow prompts

# After: push to GitHub → Vercel auto-deploys on every push
```

### Why this is even simpler than the poker app

- No Python runtime needed on Vercel
- No serverless functions
- No API routes
- Pure static files (HTML + JS + WASM)
- Works offline after first load (Stockfish runs locally in browser)
- No cold start latency
- Free tier is more than enough (just serving static assets)

---

## 12. Future Expansions

| Feature | Effort | Impact |
|---------|--------|--------|
| Keyboard shortcuts (arrow keys for move nav) | 2 hrs | High |
| More openings in repertoire | Ongoing | High |
| Tactical pattern detection (forks, pins, skewers) | 2 days | High — better explanations |
| Puzzle mode (mate in N from Lichess puzzle DB) | 2 days | Very high |
| PGN import from chess.com API | 1 day | Review your actual games |
| Opening explorer (show stats from master games) | 1 day | Medium |
| Endgame trainer (K+R vs K, basic mates) | 1 day | High for beginners |
| PWA / offline mode | 3 hrs | Play on phone without internet |
| Dark/light theme toggle | 1 hr | Nice to have |
| Sound effects (move, capture, check) | 1 hr | Polish |

---

## How This Connects to the Poker App

Both apps share the same meta-idea: **thinking trainers, not competitive platforms.**

| | Poker Trainer | Chess Trainer |
|---|---|---|
| Source of truth | Mini CFR solver (you build it) | Stockfish (pre-built, free) |
| Hard part | Building the solver | Surfacing engine output as intuition |
| Frontend | Flask + HTMX (Python everywhere) | React + chess libs (JS ecosystem) |
| Runs on | Server (Vercel serverless) | Client (browser WASM) |
| Offline? | No (needs Flask) | Yes (Stockfish runs locally) |

The chess app is actually simpler to build because you don't need to solve the game — Stockfish already did that. Your job is purely UX: making the engine's knowledge accessible to a learner.