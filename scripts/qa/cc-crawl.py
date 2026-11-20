"""Crawl chess.com public archives for games with Game Review accuracies, spread across rating bands.
   python3 crawl.py out.tsv seconds   (resumable: appends, remembers users it has seen)"""
import json, subprocess, sys, time, random, os, re, collections
OUT, BUDGET = sys.argv[1], float(sys.argv[2]); T0 = time.time()
def get(url):
    for k in range(3):
        try:
            r = subprocess.run(['curl', '-sS', '-m', '40', '-A', 'Mozilla/5.0 (chessbot calibration)', url], capture_output=True)
            if r.returncode == 0 and r.stdout[:1] in (b'{', b'['): return json.loads(r.stdout)
        except Exception: pass
        time.sleep(2 + 3 * k)
    return None
seen_users = set(open('users.txt').read().split()) if os.path.exists('users.txt') else set()
seen_games = set(); cnt = collections.Counter()
if os.path.exists(OUT):
    for l in open(OUT):
        p = l.rstrip('\n').split('\t'); seen_games.add(p[-1]); cnt[(p[0], int(p[1]) // 100)] += 1; cnt[(p[0], int(p[2]) // 100)] += 1
queue = collections.deque(); pri = {}
def push(u, r=None):
    u = u.lower()
    if u in seen_users or u in pri: return
    pri[u] = r; queue.append(u)
for u in ['ecavan']: push(u)
for cc in ['CA', 'US', 'GB', 'IN', 'DE', 'BR']:
    d = get(f'https://api.chess.com/pub/country/{cc}/players')
    if d: 
        ps = d.get('players', []); random.shuffle(ps)
        for u in ps[:1500]: push(u)
for t in ['NM', 'CM', 'FM']:
    d = get(f'https://api.chess.com/pub/titled/{t}')
    if d:
        ps = d.get('players', []); random.shuffle(ps)
        for u in ps[:150]: push(u)
print('queue', len(queue), flush=True)
TARGET = 260
def want(tc, r): return cnt[(tc, r // 100)] < TARGET
out = open(OUT, 'a'); uf = open('users.txt', 'a'); n_req = 0
MONTHS = ['2026/11', '2026/10']
while queue and time.time() - T0 < BUDGET:
    # prefer users whose known rating falls in an under-filled band
    u = None
    for _ in range(min(60, len(queue))):
        c = queue.popleft(); r = pri.get(c)
        if r is None or want('blitz', r) or want('rapid', r): u = c; break
        queue.append(c)
    if u is None: u = queue.popleft()
    pri.pop(u, None); seen_users.add(u); uf.write(u + '\n'); uf.flush()
    for m in MONTHS:
        d = get(f'https://api.chess.com/pub/player/{u}/games/{m}'); n_req += 1
        if not d: continue
        got = 0
        for g in d.get('games', []):
            if g.get('rules') != 'chess' or g.get('time_class') not in ('blitz', 'rapid') or not g.get('rated'): continue
            w, b = g['white'], g['black']
            opp = b if w['username'].lower() == u else w
            push(opp['username'], opp['rating'])
            a = g.get('accuracies')
            if not a or g['url'] in seen_games: continue
            seen_games.add(g['url'])
            mv = re.findall(r'\d+\.\.\. ', g.get('pgn', '').split('\n\n')[-1]); plies = 2 * len(mv)
            res = 1 if w['result'] == 'win' else 0 if b['result'] == 'win' else 0.5
            out.write('\t'.join(map(str, [g['time_class'], w['rating'], b['rating'], a['white'], a['black'], plies, res, g.get('time_control', ''), g['url']])) + '\n'); got += 1
            cnt[(g['time_class'], w['rating'] // 100)] += 1; cnt[(g['time_class'], b['rating'] // 100)] += 1
        out.flush()
        if got >= 8: break
    if n_req % 50 == 0:
        print(round(time.time() - T0), 'req', n_req, 'games', len(seen_games), 'queue', len(queue), 'blitz', [cnt[('blitz', k)] for k in range(1, 21)], 'rapid', [cnt[('rapid', k)] for k in range(1, 21)], flush=True)
print('done', len(seen_games))
