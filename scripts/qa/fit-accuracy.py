# Refit the accuracy formula (src/lib/review.js ACC) on cc-export rows: python3 fit-accuracy.py  (expects audit-rows.json beside it)
import json, numpy as np
from scipy.optimize import minimize
d = json.load(open('audit-rows.json'))
S = []
for g in d:
    for c, k, par in (('w', 'white', 0), ('b', 'black', 1)):
        mv = [m for i, m in enumerate(g['moves']) if i % 2 == par]
        if len(mv) < 6: continue
        S.append((np.array([m['cpBest'] for m in mv], float), np.array([m['cpAfter'] for m in mv], float), g['cc'][k]))
def game(p, b, a):
    k, A, P, q = p
    W = lambda c: 100 / (1 + np.exp(-k * np.clip(c, -2000, 2000)))
    acc = np.maximum(1, 100 * np.exp(-A * np.maximum(0, W(b) - W(a)) ** P))
    return np.mean(acc ** q) ** (1 / q)
def loss(p, idx): return np.mean([abs(game(p, S[i][0], S[i][1]) - S[i][2]) for i in idx])
p0 = np.array([0.00195, 0.07688, 1.32769, 0.32082]); allidx = list(range(len(S)))
print('n sides', len(S), 'current MAE', round(loss(p0, allidx), 3), 'bias', round(np.mean([game(p0, S[i][0], S[i][1]) - S[i][2] for i in allidx]), 2))
r = minimize(lambda p: loss(p, allidx), p0, method='Nelder-Mead', options={'xatol': 1e-6, 'fatol': 1e-4, 'maxiter': 4000})
print('refit', np.round(r.x, 5), 'MAE', round(r.fun, 3), 'bias', round(np.mean([game(r.x, S[i][0], S[i][1]) - S[i][2] for i in allidx]), 2))
# 5-fold CV
rng = np.random.default_rng(1); perm = rng.permutation(len(S)); cv = []
for f in range(5):
    te = perm[f::5]; tr = np.setdiff1d(perm, te)
    rr = minimize(lambda p: loss(p, tr), p0, method='Nelder-Mead', options={'maxiter': 2500})
    cv.append((loss(p0, te), loss(rr.x, te)))
print('CV test MAE current vs refit', np.round(np.mean(cv, axis=0), 3))
