"""Fit the review's accuracy formula to chess.com's accuracies.

    python3 scripts/qa/acc-fit.py ours.json     (ours.json from cc-compare.mjs)

Model (src/lib/review.js): win = 100 / (1 + e^(-k·cp)), cp clipped to ±2000; each move scores
100·e^(-a·drop^p) with drop the fall in win from the best move to the move played; a side's game
accuracy is the power mean (exponent q) of its moves, book moves included. Prints the fitted
parameters and the error on games left out of the fit (leave one game out).
"""
import json, sys
import numpy as np
from scipy.optimize import minimize

def cp_of(line):
    if line.get('mate') is not None:
        m = line['mate']
        return 10000 - abs(m) if m > 0 else -(10000 - abs(m))
    return line.get('cp', 0)

sides = []
for g in json.load(open(sys.argv[1])):
    ev = [p['terminal'] if p.get('terminal') is not None else (cp_of(p['lines'][0]) if p['lines'] else 0) for p in g['positions']]
    for col, name in ((0, 'white'), (1, 'black')):
        s = 1 if col == 0 else -1
        idx = [i for i in range(len(g['moves'])) if i % 2 == col]
        sides.append(dict(g=g['url'], cc=g['cc'][name],
                          b=np.clip([s * ev[i] for i in idx], -2000, 2000), a=np.clip([s * ev[i + 1] for i in idx], -2000, 2000)))

def acc(side, t):
    k, a, p, q = t
    win = lambda x: 100 / (1 + np.exp(-k * np.asarray(x, float)))
    drop = np.maximum(0, win(side['b']) - win(side['a']))
    x = np.maximum(1, 100 * np.exp(-abs(a) * drop ** abs(p)))
    return np.mean(x ** q) ** (1 / q)

loss = lambda t, S: np.mean([abs(acc(s, t) - s['cc']) for s in S])
fit = lambda S, x0: minimize(lambda t: loss(t, S), x0, method='Nelder-Mead', options=dict(maxiter=2000)).x
t = fit(sides, [0.002, 0.07, 1.3, 0.3])
errs = []
for g in sorted({s['g'] for s in sides}):
    tt = fit([s for s in sides if s['g'] != g], t)
    errs += [abs(acc(s, tt) - s['cc']) for s in sides if s['g'] == g]
errs = np.array(errs)
print(f'{len(sides)} sides  k={t[0]:.5f} a={t[1]:.5f} p={t[2]:.5f} q={t[3]:.5f}')
print(f'in-sample MAE {loss(t, sides):.2f}   left-out MAE {errs.mean():.2f}   within 5: {np.mean(errs <= 5):.0%}   within 10: {np.mean(errs <= 10):.0%}')
