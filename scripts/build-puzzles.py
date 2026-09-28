import zstandard, io, csv, json, random, collections, os
random.seed(7)
bands = collections.defaultdict(list)
seen = collections.Counter()
dctx = zstandard.ZstdDecompressor()
n = 0
with open('puzzles.csv.zst', 'rb') as fh:
    reader = csv.reader(io.TextIOWrapper(dctx.stream_reader(fh), encoding='utf-8'))
    header = next(reader)
    for row in reader:
        n += 1
        pid, fen, moves, rating, rd, pop, plays, themes = row[:8]
        rating, rd, pop, plays = int(rating), int(rd), int(pop), int(plays)
        if rd > 90 or pop < 85 or plays < 300: continue
        b = max(4, min(29, rating // 100))
        bl = bands[b]
        seen[b] += 1
        # reservoir sample, 3000 per band
        if len(bl) < 3000: bl.append((pid, fen, moves, rating, themes))
        else:
            j = random.randrange(seen[b])
            if j < 3000: bl[j] = (pid, fen, moves, rating, themes)
print('rows', n)
theme_count = collections.Counter()
for b, bl in bands.items():
    for p in bl:
        for t in p[4].split(): theme_count[t] += 1
themes = [t for t, _ in theme_count.most_common()]
tix = {t: i for i, t in enumerate(themes)}
os.makedirs('out', exist_ok=True)
total = 0
index = []
for b in sorted(bands):
    bl = sorted(bands[b], key=lambda p: p[3])[:2400]
    rows = [[p[0], p[1], p[2], p[3], [tix[t] for t in p[4].split()]] for p in bl]
    with open(f'out/p{b:02d}.json', 'w') as f: json.dump(rows, f, separators=(',', ':'))
    index.append({'band': b, 'min': b * 100, 'count': len(rows), 'file': f'p{b:02d}.json'})
    total += len(rows)
with open('out/index.json', 'w') as f: json.dump({'themes': themes, 'bands': index, 'source': 'Lichess puzzle database (CC0), filtered: rating deviation <= 90, popularity >= 85, 300+ plays'}, f)
print('total', total, 'themes', len(themes))
print({b: len(bands[b]) for b in sorted(bands)})
