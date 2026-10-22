"""Game rating from accuracy, anchor-free: fitted on chess.com games (both players' Game Review
accuracies, game length, the player's rating), every 100-point rating band weighted equally (a
flat prior from 100 to 2900), so a game is rated by how it was played, not by who played it.
Writes a lookup grid for ChessBot: rating[plies bucket][acc_self][acc_opp] (rapid scale).
"""
import json, sys
import numpy as np, polars as pl
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import KFold
C, OUT = sys.argv[1], sys.argv[2]
df = pl.read_csv(f'{C}/crawl.tsv', separator='\t', has_header=False, new_columns=['tc', 'r', 'acc', 'opp', 'plies', 'res', 'url']).unique(['url', 'r', 'acc'])
other = df.select(['url', pl.col('r').alias('r2'), pl.col('acc').alias('acc_opp')])
d = df.join(other, on='url').filter((pl.col('r') != pl.col('r2')) & (pl.col('plies') >= 20) & (pl.col('r').is_between(100, 2899)))
x = d.filter(pl.col('tc') == 'rapid')
band = (x['r'] // 100).to_numpy(); cnt = np.bincount(band); w = 1 / cnt[band]
X = x.select(['acc', 'acc_opp', 'plies']).to_numpy().astype(float); y = x['r'].to_numpy().astype(float)
mk = lambda: HistGradientBoostingRegressor(max_iter=400, learning_rate=0.04, max_leaf_nodes=15, min_samples_leaf=60, monotonic_cst=[1, 1, 0])
err = []
for tr, te in KFold(5, shuffle=True, random_state=1).split(X):
    m = mk().fit(X[tr], y[tr], sample_weight=w[tr]); p = m.predict(X[te])
    err.append(np.average(np.abs(p - y[te]), weights=w[te]))
mae = float(np.mean(err)); print('rapid, games:', len(y), 'weighted MAE (5-fold):', round(mae))
m = mk().fit(X, y, sample_weight=w)
ACC = list(range(20, 101, 2)); OPP = list(range(20, 101, 5)); PL = [30, 60, 100]
grid = [[[int(round(m.predict([[a, o, pl_]])[0] / 10) * 10) for o in OPP] for a in ACC] for pl_ in PL]
json.dump({'scale': 'chess.com rapid', 'mae': round(mae), 'acc': ACC, 'opp': OPP, 'plies': PL, 'grid': grid}, open(OUT, 'w'), separators=(',', ':'))
for a, o, p in [(87.6, 69.5, 25), (65, 60, 60), (80, 80, 60), (90, 90, 60), (75, 65, 60), (55, 55, 60)]:
    print(a, o, p, round(m.predict([[a, o, p]])[0]))
