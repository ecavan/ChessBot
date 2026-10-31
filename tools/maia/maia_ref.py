"""Reference implementation of a Maia (lc0 SE network, conv policy, WDL) forward pass in numpy,
plus the lc0 "classical 112 plane" encoder. Used to validate the JS port and to export weights.

  python3 maia_ref.py weights.pb.gz            # prints the policy for a few positions
  python3 maia_ref.py weights.pb.gz --export out.bin out.json
"""
import gzip, json, struct, sys
import numpy as np
import chess
sys.path.insert(0, '/home/claude/maia/gen')
import net_pb2 as pb

EPS = 1e-5

def layer(l):
    raw = np.frombuffer(l.params, dtype='<u2').astype(np.float32)
    enc = l.encoding if l.HasField('encoding') else 1
    assert enc == 1, enc
    theta = raw / 65535.0
    return (l.min_val * (1 - theta) + l.max_val * theta).astype(np.float32)

def convblock(b, cin, cout, k):
    wflat = layer(b.weights)
    cout = wflat.size // (cin * k * k)
    w = wflat.reshape(cout, cin, k, k)
    bias = layer(b.biases) if len(b.biases.params) else np.zeros(cout, np.float32)
    if not len(b.bn_means.params):  # no batch norm (the final policy conv): plain bias
        return w.astype(np.float32), bias.astype(np.float32)
    means, stddivs = layer(b.bn_means), layer(b.bn_stddivs)
    gammas = layer(b.bn_gammas) if len(b.bn_gammas.params) else np.ones(cout, np.float32)
    betas = layer(b.bn_betas) if len(b.bn_betas.params) else np.zeros(cout, np.float32)
    g = gammas / np.sqrt(stddivs + EPS)
    means = means - bias
    w = w * g[:, None, None, None]
    bias = -g * means + betas
    return w.astype(np.float32), bias.astype(np.float32)

def load(path):
    net = pb.Net(); net.ParseFromString(gzip.open(path).read())
    W = net.weights
    F = W.input.weights
    cout = len(W.input.bn_means.params) // 2
    cin = 112
    model = {'filters': cout}
    model['input'] = convblock(W.input, cin, cout, 3)
    blocks = []
    for r in W.residual:
        c1 = convblock(r.conv1, cout, cout, 3)
        c2 = convblock(r.conv2, cout, cout, 3)
        se_ch = len(r.se.b1.params) // 2
        se = (layer(r.se.w1).reshape(se_ch, cout), layer(r.se.b1), layer(r.se.w2).reshape(2 * cout, se_ch), layer(r.se.b2))
        blocks.append((c1, c2, se))
    model['blocks'] = blocks
    model['policy1'] = convblock(W.policy1, cout, cout, 3)
    pol_out = len(W.policy.bn_means.params) // 2
    model['policy'] = convblock(W.policy, cout, pol_out, 3)
    val_ch = len(W.value.bn_means.params) // 2
    model['value'] = convblock(W.value, cout, val_ch, 1)
    v1 = layer(W.ip1_val_w); v1b = layer(W.ip1_val_b)
    model['ip1_val'] = (v1.reshape(len(v1b), val_ch * 64), v1b)
    v2 = layer(W.ip2_val_w); v2b = layer(W.ip2_val_b)
    model['ip2_val'] = (v2.reshape(len(v2b), len(v1b)), v2b)
    return model

# --------------------------------------------------------------- forward

def conv(x, w, b):  # x [cin,8,8], w [cout,cin,k,k]
    cout, cin, k, _ = w.shape
    p = k // 2
    xp = np.pad(x, ((0, 0), (p, p), (p, p)))
    out = np.zeros((cout, 8, 8), np.float32)
    for dy in range(k):
        for dx in range(k):
            patch = xp[:, dy:dy + 8, dx:dx + 8]  # [cin,8,8]
            out += np.tensordot(w[:, :, dy, dx], patch, axes=([1], [0]))
    return out + b[:, None, None]

relu = lambda x: np.maximum(x, 0)

def forward(model, planes):  # planes [112,8,8] -> (policy logits [1858], wdl [3])
    w, b = model['input']
    x = relu(conv(planes, w, b))
    for (c1, c2, se) in model['blocks']:
        h = relu(conv(x, *c1))
        h = conv(h, *c2)
        w1, b1, w2, b2 = se
        pool = h.mean(axis=(1, 2))
        f = relu(w1 @ pool + b1)
        s = w2 @ f + b2
        C = h.shape[0]
        gamma = 1 / (1 + np.exp(-s[:C])); beta = s[C:]
        x = relu(gamma[:, None, None] * h + beta[:, None, None] + x)
    p = relu(conv(x, *model['policy1']))
    p = conv(p, *model['policy'])  # [80,8,8]
    logits = np.full(1858, -1e9, np.float32)
    flat = p.reshape(-1)
    for i, j in enumerate(POLICY_MAP):
        if j >= 0: logits[j] = flat[i]
    v = relu(conv(x, *model['value']))  # [32,8,8]
    v = relu(model['ip1_val'][0] @ v.reshape(-1) + model['ip1_val'][1])
    v = model['ip2_val'][0] @ v + model['ip2_val'][1]
    wdl = np.exp(v - v.max()); wdl /= wdl.sum()
    return logits, wdl

# --------------------------------------------------------------- tables

def read_policy_map():
    src = open('/home/claude/lc0src/src/neural/tables/policy_map.h').read()
    body = src[src.index('kConvPolicyMap[] = {') + len('kConvPolicyMap[] = {'):]
    body = body[:body.index('}')]
    return [int(t) for t in body.replace('\n', ' ').split(',') if t.strip()]

def read_move_strs():
    src = open('/home/claude/lc0src/src/neural/encoder.cc').read()
    body = src[src.index('kMoveStrs[]'):]
    body = body[body.index('{') + 1:body.index('}')]
    return [t.strip().strip('"') for t in body.replace('\n', ' ').split(',') if t.strip()]

POLICY_MAP = read_policy_map()
MOVE_STRS = read_move_strs()
assert len(MOVE_STRS) == 1858, len(MOVE_STRS)
MOVE_IDX = {m: i for i, m in enumerate(MOVE_STRS)}

# --------------------------------------------------------------- encoder

def flip_sq(sq):  # mirror ranks
    return chess.square(chess.square_file(sq), 7 - chess.square_rank(sq))

def board_planes(board, us):
    """12 piece planes + 1 repetition plane from `us`'s perspective (ranks flipped if us is black)."""
    pl = np.zeros((13, 64), np.float32)
    for sq, pc in board.piece_map().items():
        s = sq if us == chess.WHITE else flip_sq(sq)
        own = pc.color == us
        pl[(0 if own else 6) + pc.piece_type - 1, s] = 1
    return pl

def encode(board):
    """lc0 INPUT_CLASSICAL_112_PLANE for `board` (python-chess, with its move stack as history)."""
    us = board.turn
    planes = np.zeros((112, 64), np.float32)
    hist = [board.copy()]
    b = board.copy()
    while len(hist) < 8 and b.move_stack:
        b.pop(); hist.append(b.copy())
    from_start = len(hist) < 8 and not b.move_stack and b.fen() == chess.STARTING_FEN
    for i in range(8):
        if i < len(hist): pos = hist[i]
        elif from_start: break  # positions before the start of the game: zeros
        else: pos = hist[-1]  # a FEN without history: lc0 repeats the earliest position
        planes[i * 13:(i + 1) * 13] = board_planes(pos, us)
        # repetitions of this position earlier in the game
        reps = 0
        key = pos._transposition_key()
        probe = pos.copy()
        while probe.move_stack:
            probe.pop()
            if probe._transposition_key() == key: reps += 1
        if reps >= 1: planes[i * 13 + 12] = 1
    them = not us
    planes[104] = board.has_queenside_castling_rights(us)
    planes[105] = board.has_kingside_castling_rights(us)
    planes[106] = board.has_queenside_castling_rights(them)
    planes[107] = board.has_kingside_castling_rights(them)
    planes[108] = 1 if us == chess.BLACK else 0
    planes[109] = board.halfmove_clock
    planes[111] = 1
    return planes.reshape(112, 8, 8)

def move_index(move, us):
    f, t = move.from_square, move.to_square
    if us == chess.BLACK: f, t = flip_sq(f), flip_sq(t)
    s = chess.square_name(f) + chess.square_name(t)
    if move.promotion and move.promotion != chess.KNIGHT:
        s += chess.piece_symbol(move.promotion)
    return MOVE_IDX[s]

def policy(model, board):
    logits, wdl = forward(model, encode(board))
    moves = list(board.legal_moves)
    z = np.array([logits[move_index(m, board.turn)] for m in moves])
    p = np.exp(z - z.max()); p /= p.sum()
    return sorted(zip([board.san(m) for m in moves], p), key=lambda x: -x[1]), wdl

# --------------------------------------------------------------- export

def export(model, bin_path, json_path):
    parts, meta = [], {'filters': model['filters'], 'blocks': len(model['blocks']), 'layers': []}
    off = 0
    def put(name, arr):
        # 16-bit linear quantisation per layer (lc0's own LINEAR16): min + (max-min) * u16/65535
        nonlocal off
        a = np.ascontiguousarray(arr, dtype=np.float32)
        lo, hi = float(a.min()), float(a.max())
        q = np.round((a - lo) / ((hi - lo) or 1.0) * 65535).astype('<u2')
        meta['layers'].append({'name': name, 'shape': list(a.shape), 'offset': off, 'min': lo, 'max': hi})
        parts.append(q.tobytes()); off += a.size
    put('input.w', model['input'][0]); put('input.b', model['input'][1])
    for i, (c1, c2, se) in enumerate(model['blocks']):
        put(f'b{i}.c1.w', c1[0]); put(f'b{i}.c1.b', c1[1]); put(f'b{i}.c2.w', c2[0]); put(f'b{i}.c2.b', c2[1])
        put(f'b{i}.se.w1', se[0]); put(f'b{i}.se.b1', se[1]); put(f'b{i}.se.w2', se[2]); put(f'b{i}.se.b2', se[3])
    put('policy1.w', model['policy1'][0]); put('policy1.b', model['policy1'][1])
    put('policy.w', model['policy'][0]); put('policy.b', model['policy'][1])
    put('value.w', model['value'][0]); put('value.b', model['value'][1])
    put('ip1_val.w', model['ip1_val'][0]); put('ip1_val.b', model['ip1_val'][1])
    put('ip2_val.w', model['ip2_val'][0]); put('ip2_val.b', model['ip2_val'][1])
    open(bin_path, 'wb').write(b''.join(parts))
    json.dump(meta, open(json_path, 'w'))
    print('exported', off, 'params', off * 2 / 1e6, 'MB')

def dump_tests(model, path):
    cases = []
    games = [[], ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5'],
             ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e3', 'O-O', 'Nf3', 'Nbd7', 'Rc1', 'c6', 'Bd3', 'dxc4', 'Bxc4', 'Nd5'],
             ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Be3', 'e5', 'Nb3', 'Be6', 'f3', 'Be7', 'Qd2', 'O-O', 'O-O-O', 'Nbd7', 'g4', 'b5', 'g5', 'b4']]
    for mv in games:
        b = chess.Board()
        for m in mv: b.push_san(m)
        logits, wdl = forward(model, encode(b))
        pol, _ = policy(model, b)
        cases.append({'moves': mv, 'fen': b.fen(), 'uci': [m.uci() for m in b.move_stack], 'wdl': [float(x) for x in wdl],
                      'top': [[s, float(p)] for s, p in pol[:5]], 'legal': {m.uci(): float(logits[move_index(m, b.turn)]) for m in b.legal_moves}})
    # a position given as a FEN only (no history): lc0 repeats it
    b = chess.Board('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4')
    logits, wdl = forward(model, encode(b)); pol, _ = policy(model, b)
    cases.append({'moves': None, 'fen': b.fen(), 'uci': [], 'wdl': [float(x) for x in wdl], 'top': [[s, float(p)] for s, p in pol[:5]], 'legal': {m.uci(): float(logits[move_index(m, b.turn)]) for m in b.legal_moves}})
    # real games (black to move late, castling rights gone, repetitions): the user's exported games
    games = json.load(open('/home/claude/chessbot/out/audit/games.json'))
    for g in games[:3]:
        b = chess.Board()
        for k, u in enumerate(g['uci']):
            b.push_uci(u)
            if k in (19, 34, len(g['uci']) - 1) and not b.is_game_over():
                logits, wdl = forward(model, encode(b)); pol, _ = policy(model, b)
                cases.append({'moves': 'game', 'fen': b.fen(), 'uci': [m.uci() for m in b.move_stack], 'wdl': [float(x) for x in wdl], 'top': [[s, float(p)] for s, p in pol[:5]], 'legal': {m.uci(): float(logits[move_index(m, b.turn)]) for m in b.legal_moves}})
    json.dump(cases, open(path, 'w'))
    print('tests', len(cases))

if __name__ == '__main__':
    model = load(sys.argv[1])
    if len(sys.argv) > 3 and sys.argv[2] == '--tests':
        dump_tests(model, sys.argv[3]); sys.exit()
    if len(sys.argv) > 3 and sys.argv[2] == '--export':
        export(model, sys.argv[3], sys.argv[4]); sys.exit()
    for fen, moves in [(chess.STARTING_FEN, []), (chess.STARTING_FEN, ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']), (chess.STARTING_FEN, ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5'])]:
        b = chess.Board(fen)
        for m in moves: b.push_san(m)
        pol, wdl = policy(model, b)
        print(' '.join(moves) or 'start', '| WDL', np.round(wdl, 3), '|', ', '.join(f'{s} {p:.2f}' for s, p in pol[:6]))
