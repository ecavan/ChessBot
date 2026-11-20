const SIDE = { w: 'White', b: 'Black' };
const other = (c) => (c === 'w' ? 'b' : 'w');

/** The coach talks to "you"; here it talks about a side. */
export function voice(text, me) {
  if (!text) return text;
  const M = SIDE[me], O = SIDE[other(me)];
  const t = text
    .replace(/^Your move: (.)/, (_, c) => c.toUpperCase())
    .replace(/\bYou missed\b/g, `${M} missed`)
    .replace(/\bYou had\b/g, `${M} had`)
    .replace(/\bYou lose\b/g, `${M} loses`)
    .replace(/\byou are (up|down)\b/gi, `${M} is $1`)
    .replace(/\bYou are (ahead|behind)\b/g, `${M} is $1`)
    .replace(/\bbefore you attack\b/g, `before ${M} attacks`)
    .replace(/\bThey threaten\b/g, `${O} threatens`)
    .replace(/\bThey want\b/g, `${O} wants`)
    .replace(/\byour opponent\b/g, O)
    .replace(/\b[Yy]our\b/g, `${M}'s`)
    .replace(/\b[Tt]heir\b/g, `${O}'s`)
    .replace(/\bYou\b/g, M)
    .replace(/\byou\b/g, M);
  return t;
}

