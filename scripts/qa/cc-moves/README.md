# chess.com's Game Review, move by move

What chess.com's own review said about 13 of Eli's games (12 blitz at about 290, one daily at 1044
against 709), read off the review page in November 2026.

- `labels.txt`: one block per game (`@@` between): the game id, the report line (accuracy, the
  count of each label, game rating; white then black), then every move as
  `ply|move|label|evaluation after it`.
- `summaries.txt`: the report line alone for 24 games (those 13 and 11 more).

To compare the app's review with it:

```
# 1. the games' PGNs, in chess.com's API format (api.chess.com/pub/player/<user>/games/<yyyy>/<mm>)
# 2. review them with the app's code on a native Stockfish 17.1
SF=/path/to/stockfish node scripts/qa/cc-compare.mjs games.json out.json 1000000 40
# 3. re-label from the stored engine lines with the current src/lib/review.js, and compare
node scripts/qa/cc-export.mjs games.json out.json rows.json
node scripts/qa/cc-moves/agree.mjs rows.json
```

What it showed (see docs/REVIEW.md for the numbers): chess.com's evaluations are larger than
Stockfish 17's in decided positions, its labels follow the win chance lost on its own scale with
cuts near 3 / 6 / 10 / 22 points, Best is only the engine's first choice, a Miss is a mistake made
right after the opponent's, and its game rating is the player's rating moved by the accuracy.
