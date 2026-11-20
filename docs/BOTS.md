# The bot ladder: how the ratings were measured

The human-like bots are one family: a Maia network (trained on real games to predict the move a
player of a given level makes) and a temperature T. The move is drawn from the network's
probabilities raised to 1/T: T above 1 strays to the moves weaker players choose more often, T
below 1 sticks to the main ones, T near 0 always plays the top move.

## Spacing: the settings played each other

`scripts/qa/bot-match.mjs`: 10 games a pairing, 41 pairings, games capped at 150 plies and
adjudicated by Stockfish (3 pawns up wins). A Bradley-Terry fit gives each setting a rating:

| Setting | Rating | ± |
|---|---|---|
| Maia 1100, T 3 | under 100 | |
| Maia 1100, T 2.5 | 250 | 30 |
| Maia 1100, T 2 | 410 | 30 |
| Maia 1100, T 1.5 | 720 | 35 |
| Maia 1100, T 1 | 915 | 30 |
| Maia 1300, T 1 | 945 | 30 |
| Maia 1900, T 1 | 955 | 30 |
| Maia 1700, T 1 | 1055 | 20 |
| Maia 1500, T 1 | 1065 | 40 |
| Maia 1100, T 0.7 | 1070 | 30 |
| Maia 1300, T 0.7 | 1155 | 25 |
| Maia 1100, top move | 1200 | anchor |
| Maia 1500, T 0.7 | 1210 | 35 |
| Maia 1900, T 0.5 | 1260 | 20 |
| Maia 1900, top move | 1370 | 30 |
| Stockfish UCI_Elo 1320 | 955 | 45 |
| Stockfish UCI_Elo 1500 | 1115 | 30 |
| Stockfish UCI_Elo 1700 | 1230 | 30 |

The ± is the fit's own error on the spacing. Temperature moves the strength far more than which
Maia level is used: at T 1 the five levels are within about 150 points of each other.

## Anchor: where the scale sits on chess.com ratings

Maia's top-move bots have played thousands of rated games on lichess: the 1100 net is rated about
1500 at blitz there, the 1900 net about 1750. Lichess blitz ratings run about 300 above chess.com's
in that range, so the anchor is "Maia 1100, top move = 1200". The 1900 net then lands at 1370 from
the matches, against about 1450 from its lichess rating: the two agree to within the error.

A second check, from accuracy: `scripts/qa/bot-arena.mjs` reviews each setting's games with the
app's own review. Maia at T 1 (three levels pooled) averages 71, which is what 850-rated players
average on chess.com (`scripts/qa/accuracy-by-rating.json`, from 29,700 crawled games); T 2.25 averages 60, which is what 250-rated
players average. Both are within about 100 points of the table.

Taken together the labels are good to about ±150: sound on order and spacing, and the whole scale
could sit a little high or low.

## The rungs

Read off the table by interpolating in T (`src/engine/bots.js`). From 1600 up the bots are
Stockfish's strength limiter. Its UCI_Elo scale measured about 400 points above this ladder
(1320 → 955, 1500 → 1115, 1700 → 1230, at short thinking times), so "Engine 1600" runs UCI_Elo
2000. Above 2000 that offset is an extrapolation.

## To re-measure

```
SF=/path/to/stockfish node scripts/qa/bot-match.mjs out.json 10 '[{"id":"a","maia":1100,"temp":2}, …]' 2
SF=/path/to/stockfish node scripts/qa/bot-arena.mjs out.json 10 chesscom-month.json
```
