"""
Build the opening courses for Train (public/data/rep/*.json).

Inputs
  counts.pkl   SAN move-sequence counts from Lichess blitz/rapid games where both players are
               rated 700-2000 (scripts: stream a monthly dump, count prefixes up to 24 plies).
  stockfish    a native Stockfish 17.1 binary.

For each course we grow a tree from its root:
  - at YOUR moves we keep one move: the course's chosen move if it names one, otherwise the most
    popular move at club level among those within 25 cp of Stockfish's best (so the course
    teaches natural, sound moves, not engine oddities); every chosen move is checked;
  - at the OPPONENT's moves we keep every reply club players actually play (>= 4 % of games
    and >= 250 games), so the course covers what you will really meet;
  - each opponent reply is evaluated: a reply that throws away >= 1.2 pawns is marked
    "punish", and against it your move is always Stockfish's best, with the line extended a
    few moves so you see the win;
  - where the most popular move for your side is a mistake (>= 1.5 pawns worse than best),
    the node records it as a trap to avoid, with the refutation.

Output per course: { id, name, color, blurb, root: [san], tree } where tree nodes are
  { s: san, u: uci, n: games, p: share of games at this node (opponent moves), e: eval in cp
    from White's side after the move (mate as +-(10000 - n)), k: 'mine'|'theirs',
    t: tags [...], ref: [uci refutation], trap: { s, u, ref }, c: [children] }
"""
import json, pickle, sys, os, math
import chess, chess.engine

SF = '/home/claude/chessdata/sf/stockfish/stockfish-ubuntu-x86-64-avx2'
COUNTS = pickle.load(open('/home/claude/chessdata/tree/counts.pkl', 'rb'))['counts']
OUT = sys.argv[1] if len(sys.argv) > 1 else 'public/data/rep'
ONLY = sys.argv[2].split(',') if len(sys.argv) > 2 else None
DEPTH = int(os.environ.get('DEPTH', 16))
MIN_GAMES, MIN_SHARE = 150, 0.04
MAX_PLY = 22

COURSES = [
    # ---------------------------------------------------------------- White
    dict(id='italian', name='Italian Game', color='w', root=['e4', 'e5'],
         blurb='1.e4 e5 2.Nf3 Nc6 3.Bc4: quick development, castle early, aim at f7. The quiet Giuoco Pianissimo setup (c3, d3, O-O, Re1) your plans come from.',
         pick={'': 'Nf3', 'Nf3 Nc6': 'Bc4', 'Nf3 Nc6 Bc4 Bc5': 'c3', 'Nf3 Nc6 Bc4 Nf6': 'd3', 'Nf3 Nc6 Bc4 Bc5 c3 Nf6': 'd3', 'Nf3 d6 Bc4 Bg4': 'Nc3'},
         extra=[['Nf3', 'Nc6', 'Bc4', 'Nd4'], ['Nf3', 'f6'], ['Nf3', 'Qf6'], ['Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'g6'], ['Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Qe7']]),
    dict(id='italian-ng5', name='Italian: 4.Ng5 & the Fried Liver', color='w', root=['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'],
         blurb='The sharp answer to the Two Knights: 4.Ng5 hits f7 at once. Learn the Fried Liver, and what to do against the Traxler.',
         pick={'': 'Ng5', 'Ng5 d5': 'exd5'}, extra=[['Ng5', 'Bc5'], ['Ng5', 'd5', 'exd5', 'Nxd5']]),
    dict(id='ruy', name='Ruy Lopez', color='w', root=['e4', 'e5', 'Nf3', 'Nc6'],
         blurb='3.Bb5: pressure on the knight that defends e5. The classic long-term squeeze.',
         pick={'': 'Bb5', 'Bb5 a6': 'Ba4', 'Bb5 a6 Ba4 Nf6': 'O-O'}),
    dict(id='scotch', name='Scotch Game', color='w', root=['e4', 'e5', 'Nf3', 'Nc6'],
         blurb='3.d4: open the centre at once and play with active pieces.',
         pick={'': 'd4', 'd4 exd4': 'Nxd4'}),
    dict(id='vienna', name='Vienna Game', color='w', root=['e4', 'e5'],
         blurb='2.Nc3: flexible, with f4 attacking ideas later.',
         pick={'': 'Nc3'}),
    dict(id='w-sicilian', name='vs Sicilian: Alapin', color='w', root=['e4', 'c5'],
         blurb='2.c3 and d4: a big centre without learning Open Sicilian theory.',
         pick={'': 'c3'}),
    dict(id='w-french', name='vs French: Advance', color='w', root=['e4', 'e6'],
         blurb='2.d4 d5 3.e5: grab space and cramp Black\'s light-squared bishop.',
         pick={'': 'd4', 'd4 d5': 'e5'}),
    dict(id='w-caro', name='vs Caro-Kann: Advance', color='w', root=['e4', 'c6'],
         blurb='2.d4 d5 3.e5: space on the kingside, simple development.',
         pick={'': 'd4', 'd4 d5': 'e5'}),
    dict(id='w-scandi', name='vs Scandinavian', color='w', root=['e4', 'd5'],
         blurb='2.exd5 and Nc3, gaining time on the queen.',
         pick={'': 'exd5', 'exd5 Qxd5': 'Nc3'}),
    dict(id='w-other', name='1.e4: everything else', color='w', root=['e4'], exclude=['e5', 'c5', 'e6', 'c6', 'd5'],
         blurb='Pirc, Modern, Alekhine, 1...Nc6 and the odd stuff: take the centre and develop.',
         pick={}),
    dict(id='london', name='London System', color='w', root=[],
         blurb='1.d4 and Bf4, e3, Nf3, Bd3, c3: the same setup against almost anything.',
         pick={'': 'd4', 'd4 d5': 'Bf4', 'd4 Nf6': 'Bf4'}, extra=[['d4', 'e5'], ['d4', 'd5', 'Bf4', 'c5']]),
    dict(id='qg', name="Queen's Gambit", color='w', root=['d4', 'd5'],
         blurb='2.c4: offer a wing pawn to win the centre.',
         pick={'': 'c4'}),
    # ---------------------------------------------------------------- Black
    dict(id='b-e5', name='1...e5 against 1.e4', color='b', root=['e4'],
         blurb='Answer 1.e4 with 1...e5 and meet the Italian, Ruy, Scotch, Vienna, early queen attacks and gambits.',
         pick={'': 'e5', 'e5 Nf3': 'Nc6', 'e5 Nf3 Nc6 Bc4': 'Bc5', 'e5 Nf3 Nc6 Bb5': 'a6', 'e5 Nf3 Nc6 Bb5 a6 Ba4': 'Nf6',
               'e5 Nf3 Nc6 d4': 'exd4', 'e5 Qh5': 'Nc6', 'e5 Qh5 Nc6 Bc4': 'g6', 'e5 Bc4': 'Nf6', 'e5 Nc3': 'Nf6', 'e5 f4': 'exf4', 'e5 d4': 'exd4'},
         extra=[['e5', 'Qh5', 'Nc6', 'Bc4'], ['e5', 'Qh5', 'Nc6', 'Bc4', 'g6', 'Qf3'], ['e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'], ['e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'Ng5'], ['e5', 'Qf3'], ['e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'Nxe5']]),
    dict(id='b-caro', name='Caro-Kann', color='b', root=['e4'],
         blurb='1...c6 and 2...d5: rock solid, the bishop comes out before ...e6.',
         pick={'': 'c6', 'c6 d4': 'd5', 'c6 d4 d5 e5': 'Bf5', 'c6 d4 d5 Nc3': 'dxe4', 'c6 d4 d5 Nc3 dxe4 Nxe4': 'Bf5', 'c6 d4 d5 exd5': 'cxd5'}),
    dict(id='b-french', name='French Defence', color='b', root=['e4'],
         blurb='1...e6 and 2...d5: counter-attack the centre with ...c5.',
         pick={'': 'e6', 'e6 d4': 'd5', 'e6 d4 d5 e5': 'c5', 'e6 d4 d5 Nc3': 'Nf6', 'e6 d4 d5 exd5': 'exd5'}),
    dict(id='b-scandi', name='Scandinavian', color='b', root=['e4'],
         blurb='1...d5: hit the centre on move one, queen to a5.',
         pick={'': 'd5', 'd5 exd5': 'Qxd5', 'd5 exd5 Qxd5 Nc3': 'Qa5'}),
    dict(id='b-qgd', name="Queen's Gambit Declined", color='b', root=['d4'],
         blurb='1...d5 and ...e6: classical and solid against 1.d4, the London and the Queen\'s Gambit.',
         pick={'': 'd5', 'd5 c4': 'e6', 'd5 Nf3': 'Nf6', 'd5 Bf4': 'Nf6'}),
    dict(id='b-slav', name='Slav Defence', color='b', root=['d4'],
         blurb='1...d5 and ...c6: keeps the light bishop free.',
         pick={'': 'd5', 'd5 c4': 'c6', 'd5 c4 c6 Nf3': 'Nf6', 'd5 c4 c6 Nc3': 'Nf6'}),
    dict(id='b-kid', name="King's Indian", color='b', root=['d4'],
         blurb='1...Nf6, ...g6, ...Bg7, castle: let White build a centre, then strike it.',
         pick={'': 'Nf6', 'Nf6 c4': 'g6', 'Nf6 c4 g6 Nc3': 'Bg7', 'Nf6 Nf3': 'g6', 'Nf6 Bf4': 'g6'}),
]

eng = chess.engine.SimpleEngine.popen_uci(SF)
eng.configure({'Threads': 2, 'Hash': 512})
cache = {}

def score_cp(sc):
    s = sc.white()
    if s.is_mate():
        m = s.mate()
        return 10000 - abs(m) if m > 0 else -(10000 - abs(m))
    return s.score()

def analyse(board, moves=None, multipv=1, depth=DEPTH):
    key = (board.fen(), tuple(sorted(m.uci() for m in moves)) if moves else None, multipv, depth)
    if key in cache: return cache[key]
    info = eng.analyse(board, chess.engine.Limit(depth=depth), multipv=multipv, root_moves=moves)
    info = info if isinstance(info, list) else [info]
    res = [dict(u=i['pv'][0].uci(), e=score_cp(i['score']), pv=[m.uci() for m in i['pv'][:10]]) for i in info if i.get('pv')]
    cache[key] = res
    return res

def mover_pov(e, white): return e if white else -e

def evals(board, moves):
    """Evals (White cp) of the given moves plus the best move, with as few searches as possible."""
    top = analyse(board, multipv=min(5, board.legal_moves.count()))
    got = {x['u']: x for x in top}
    missing = [m for m in moves if m.uci() not in got]
    if missing:
        for x in analyse(board, missing, multipv=len(missing)): got[x['u']] = x
    return (top[0] if top else None), got

def children_counts(seq):
    pre = ' '.join(seq)
    out = {}
    tot = COUNTS.get(pre, 0) if seq else sum(v for k, v in COUNTS.items() if ' ' not in k)
    for k, v in COUNTS.items():
        if (k.startswith(pre + ' ') and k.count(' ') == pre.count(' ') + 1) if seq else (' ' not in k):
            out[k.split(' ')[-1]] = v
    return out, tot

# index children quickly
from collections import defaultdict
KIDS = defaultdict(dict)
for k, v in COUNTS.items():
    i = k.rfind(' ')
    parent, mv = (k[:i], k[i + 1:]) if i >= 0 else ('', k)
    KIDS[parent][mv] = v
ROOT_TOTAL = sum(KIDS[''].values())

def kids(seq):
    return KIDS.get(' '.join(seq), {})

def total(seq):
    return COUNTS.get(' '.join(seq), 0) if seq else ROOT_TOTAL

log = []

def build(course):
    color = course['color']
    board = chess.Board()
    for s in course['root']: board.push_san(s)
    nodes = 0

    def rel(seq): return ' '.join(seq[len(course['root']):])
    chosen = {}

    def grow(board, seq, extend=0):
        nonlocal nodes
        ply = len(seq)
        if board.is_game_over(): return []
        mine = (board.turn == chess.WHITE) == (color == 'w')
        cnt = dict(kids(seq))
        tot = sum(cnt.values())
        if ply >= MAX_PLY and extend <= 0: return []
        if mine:
            parsed = {}
            for sm, c in cnt.items():
                try: parsed[sm] = board.parse_san(sm)
                except Exception: pass
            order = sorted(parsed, key=lambda x: -cnt[x])
            forced = course['pick'].get(rel(seq))
            use_data = extend <= 0 and cnt
            cands = [parsed[x] for x in order[:6] if cnt[x] / max(1, tot) >= 0.02] if use_data else []
            need = list(cands)
            if forced and use_data: need.append(board.parse_san(forced))
            best, got = evals(board, need)
            if not best: return []
            beste = mover_pov(best['e'], board.turn)
            trap = None
            if use_data and tot >= MIN_GAMES and order:
                pop = order[0]; pm = parsed[pop]
                pe = got.get(pm.uci())
                if pe and beste - mover_pov(pe['e'], board.turn) >= 150:
                    b2 = board.copy(); b2.push(pm)
                    refl = analyse(b2)
                    trap = dict(s=pop, u=pm.uci(), share=round(cnt[pop] / tot, 3), ref=refl[0]['pv'][:6] if refl else [], drop=beste - mover_pov(pe['e'], board.turn))
            choice = best['u']
            key = ' '.join(board.fen().split(' ')[:4])
            if use_data and forced:
                choice = board.parse_san(forced).uci()
            elif key in chosen:
                # same position reached by another move order: always the same answer
                choice = chosen[key]
            elif use_data:
                for m in cands:
                    x = got.get(m.uci())
                    if x and mover_pov(x['e'], board.turn) >= beste - 25:
                        choice = m.uci(); break
            chosen.setdefault(key, choice)
            m = chess.Move.from_uci(choice)
            san = board.san(m)
            me = got.get(choice) or analyse(board, [m])[0]
            drop = beste - mover_pov(me['e'], board.turn)
            if drop > 60: log.append(f"{course['id']}: {' '.join(seq)} {san} is {drop} cp worse than {board.san(chess.Move.from_uci(best['u']))}")
            node = dict(s=san, u=choice, n=cnt.get(san, 0), e=me['e'], k='mine')
            if trap: node['trap'] = trap
            b2 = board.copy(); b2.push(m)
            nodes += 1
            node['c'] = grow(b2, seq + [san], extend - 1 if extend > 0 else 0)
            return [node]
        # opponent: every reply club players really play
        if extend > 0:
            best = analyse(board)
            if not best: return []
            m = chess.Move.from_uci(best[0]['u'])
            b2 = board.copy(); san = board.san(m); b2.push(m)
            nodes += 1
            return [dict(s=san, u=m.uci(), n=0, e=best[0]['e'], k='theirs', t=['engine'], c=grow(b2, seq + [san], extend - 1))]
        relseq0 = seq[len(course['root']):]
        if tot < MIN_GAMES and not any(len(x) > len(relseq0) and x[:len(relseq0)] == relseq0 for x in course.get('extra', [])): return []
        replies = []
        relseq = seq[len(course['root']):]
        forced_extra = {x[len(relseq)] for x in course.get('extra', []) if len(x) > len(relseq) and x[:len(relseq)] == relseq}
        for s in forced_extra:
            cnt.setdefault(s, 0)
        at_root = not seq[len(course['root']):]
        if at_root and course.get('exclude'):
            for x in course['exclude']: cnt.pop(x, None)
            tot = sum(cnt.values())
        for s, c in sorted(cnt.items(), key=lambda x: -x[1]):
            if s not in forced_extra and (c < MIN_GAMES or c / tot < MIN_SHARE): continue
            try: m = board.parse_san(s)
            except Exception: continue
            replies.append((s, m, c))
        if not replies: return []
        best, got = evals(board, [m for _, m, _ in replies])
        beste = mover_pov(best['e'], board.turn)
        out = []
        for s, m, c in replies:
            e = got[m.uci()]['e'] if m.uci() in got else analyse(board, [m])[0]['e']
            drop = beste - mover_pov(e, board.turn)
            tags = []
            ext = 0
            if drop >= 300: tags, ext = ['blunder'], 6
            elif drop >= 120: tags, ext = ['mistake'], 4
            b2 = board.copy(); b2.push(m)
            nodes += 1
            node = dict(s=s, u=m.uci(), n=c, p=round(c / max(1, tot), 3), e=e, k='theirs', t=tags + (['trap-line'] if s in forced_extra and c < MIN_GAMES else []))
            node['c'] = grow(b2, seq + [s], ext)
            out.append(node)
        return out

    tree = grow(board, list(course['root']))
    return tree, nodes

os.makedirs(OUT, exist_ok=True)
index = []
for course in COURSES:
    if ONLY and course['id'] not in ONLY: continue
    tree, n = build(course)
    data = dict(id=course['id'], name=course['name'], color=course['color'], blurb=course['blurb'], root=course['root'], tree=tree)
    json.dump(data, open(f"{OUT}/{course['id']}.json", 'w'), separators=(',', ':'))
    index.append(dict(id=course['id'], name=course['name'], color=course['color'], blurb=course['blurb'], root=course['root'], nodes=n))
    print(course['id'], n, 'nodes', flush=True)
# the index lists every course built so far, in course order
built = {}
for course in COURSES:
    f = f"{OUT}/{course['id']}.json"
    if os.path.exists(f):
        d = json.load(open(f))
        built[course['id']] = dict(id=d['id'], name=d['name'], color=d['color'], blurb=d['blurb'], root=d['root'])
json.dump([built[c['id']] for c in COURSES if c['id'] in built], open(f'{OUT}/index.json', 'w'), separators=(',', ':'))
print('\n'.join(log))
eng.quit()
