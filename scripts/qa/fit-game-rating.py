"""Game rating, anchored: the accuracy a player of rating r is expected to have (given the opponent's
accuracy and the game's length), and how much one game's accuracy says about r. Writes gameRating.json."""
import json, sys, numpy as np, polars as pl
from cc_load import load
from sklearn.isotonic import IsotonicRegression
d = load().filter(pl.col('r').is_between(100, 2600))
r = d['r'].to_numpy().astype(float); acc = d['acc'].to_numpy(); acco = d['acco'].to_numpy(); ro = d['ro'].to_numpy().astype(float); plies = d['plies'].to_numpy().astype(float)
# mean accuracy by rating: band means (each band weighted equally, both time classes), then monotone smoothing
edges = np.arange(100, 2700, 100); mid = edges[:-1] + 50
bm = np.array([acc[(r >= lo) & (r < lo + 100)].mean() if ((r >= lo) & (r < lo + 100)).sum() >= 25 else np.nan for lo in edges[:-1]])
bn = np.array([((r >= lo) & (r < lo + 100)).sum() for lo in edges[:-1]])
ok = ~np.isnan(bm)
iso = IsotonicRegression(increasing=True).fit(mid[ok], bm[ok], sample_weight=np.sqrt(bn[ok]))
grid = np.arange(100, 2801, 100).astype(float)
m = iso.predict(np.clip(grid, mid[ok].min(), mid[ok].max()))
# smooth the steps a little (3-point moving average, twice), keep monotone
for _ in range(2): m = np.convolve(np.r_[m[0], m, m[-1]], [0.25, 0.5, 0.25], 'valid')
# above the last well-covered band the data runs out: carry on at the slope of the 1400-2000 stretch
last = int(mid[ok & (bn >= 60)].max()); il = int(np.searchsorted(grid, last)); slope = (m[il] - np.interp(last - 600, grid, m)) / 600
for i in range(il + 1, len(grid)): m[i] = m[il] + slope * (grid[i] - grid[il])
print('extrapolating above', last, 'at', round(slope * 100, 2), 'accuracy points per 100')
mu = lambda x: np.interp(x, grid, m)
# what else moves accuracy in one game: the opponent's accuracy (relative to his level) and the length
res = acc - mu(r); xo = acco - mu(ro); xl = np.log(np.clip(plies, 20, 200) / 60)
X = np.c_[np.ones_like(res), xo, xl]; beta, *_ = np.linalg.lstsq(X, res, rcond=None)
e = res - X @ beta
sd = np.array([e[(r >= g - 150) & (r < g + 150)].std() if ((r >= g - 150) & (r < g + 150)).sum() >= 60 else np.nan for g in grid])
sd = np.interp(grid, grid[~np.isnan(sd)], sd[~np.isnan(sd)])
for tc in ['blitz', 'rapid']:
    k = (d['tc'] == tc).to_numpy(); print(tc, 'n', k.sum(), 'mean residual vs common curve', round(e[k].mean(), 2))
print('bands n:', dict(zip(mid.astype(int).tolist(), bn.tolist())))
print('mean acc by rating:', dict(zip(grid.astype(int).tolist(), np.round(m, 1).tolist())))
print('beta const, opp, log-length:', np.round(beta, 3), 'resid sd by rating:', np.round(sd, 1).tolist())
json.dump({'scale': 'chess.com', 'n': int(len(r)), 'r': grid.astype(int).tolist(), 'mean': np.round(m, 2).tolist(), 'sd': np.round(sd, 2).tolist(), 'b0': round(float(beta[0]), 3), 'bOpp': round(float(beta[1]), 4), 'bLen': round(float(beta[2]), 3), 'prior': 600}, open(sys.argv[1], 'w'))
