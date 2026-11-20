# How close the review is to chess.com's

Audited in November 2026 against chess.com itself. Data and scripts: `scripts/qa/cc-moves/`.

## What was compared

- **Move labels**: chess.com's Game Review, read move by move, for 13 of Eli's games (788 moves:
  12 blitz at about 290, one daily at 1044 against 709).
- **The report** (accuracy, counts, game rating) for 24 games (48 player-games).
- **Accuracy across ratings**: 110 games from 100 to 2100 with the accuracy chess.com publishes in
  its API (220 player-games).

The app's side was run with the app's own review code on Stockfish 17.1 at a million nodes a
position.

## What chess.com does, as measured

1. **Its evaluations are bigger than Stockfish 17's** once a side is clearly better: +2.7 here is
   about +4.5 there, +4.5 about +8.2, and it tops out near +12.
2. **Labels follow the win chance lost on that scale**, with cuts near 3, 6, 10 and 22 points
   (Excellent, Good, Inaccuracy, Mistake, Blunder). On chess.com's own evaluations those cuts
   reproduce 89% of its labels.
3. **Best is the engine's first choice and nothing else.** A move that scores the same is Excellent.
4. **A Miss is a mistake made right after the opponent's**: 32 of its 36 misses follow a Mistake,
   Blunder or Miss by the other side. (A missed forced mate is also a Miss.)
5. **Great** is nearly always the best move right after the opponent's error (25 of 31).
6. **Its accuracy is not one number.** The review page and its own API disagree about the same
   game by 3.3 points on average, and by up to 12.7 (38 player-games).
7. **Game rating is the player's rating moved by the accuracy.** For ~290-rated blitz players:
   100-150 under 60 accuracy, about the player's rating at 64, +450 at 72, +650 at 85, +770 at 93.
   Daily games are held to a higher standard (about 8 accuracy points), on thinner evidence.

## How the app scores now

| | Before | After |
|---|---|---|
| Same label as chess.com (788 moves) | 53.7% | 64.5% |
| Same band: fine / inaccuracy / mistake-or-worse | 88.9% | 92.9% |
| Accuracy against the review page, mean error (48) | 4.4 | 4.1 |
| Accuracy against the API, mean error (220) | 3.7 (lean +1.4) | 3.4 (lean +0.3) |
| Game rating against chess.com, blitz, mean error (32) | 525 (lean +483) | 116 (no lean) |
| Game rating, daily (16) | | 216 |

The eval-scale table was fitted on the first 8 games and checked on the other 4 before being
refitted on all: same label 54.2% → 60.6% on the held-out games.

## What still differs, and why

- **Best against Excellent** is most of the remaining gap (105 of the 280 moves that differ). The
  two engines often prefer different first moves that are worth the same; that cannot be matched
  without running chess.com's engine at chess.com's depth.
- **Mistake against Blunder / Miss** at the edges: 22 of chess.com's 55 Mistakes get a harsher
  or softer neighbour.
- **Accuracy** is within about 4 points on average and within 5 on 69% of player-games, which is
  where chess.com's own two numbers sit against each other. One game in 24 was off by 19.
- **Counts per player per game**, app minus chess.com: Excellent +2.8, Best −1.0, Mistake −1.1,
  Book −0.5, the rest within ±0.5.
- **Forced** (the only legal move) is its own label on chess.com; the app calls it Best.
- **Game rating for daily games** and for ratings far from 300 rests on few games.

## To re-run

See `scripts/qa/cc-moves/README.md`.
