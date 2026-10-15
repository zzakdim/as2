// Shared bot player for tools/bot.mjs (tuning) and tools/genlevels.mjs (level checks).
// A greedy bot (no lookahead) stands in for an average player.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Core = require('../www/js/core.js');
const Powers = require('../www/js/powers.js');
const S = Core.SIZE;

// Buddies the bot can bring. bonus = bond score bonus.
export const BUDDIES = {
  starter: { power: 'fetch', charges: 1, bonus: 0 }, // Mochi, level 1, no bond
  mid: { power: 'dig', charges: 3, bonus: 0.12 }, // a rare at level 3, Bond 5
  maxEpic: { power: 'cannonball', charges: 5, bonus: 0 }, // a maxed epic, no bond
  maxBond: { power: 'cannonball', charges: 5, bonus: 0.27 }, // a maxed epic at Bond 10
};

// Empty cells boxed in on 3+ sides are hard to ever fill; the bot avoids making them.
function trapped(board) {
  let n = 0;
  for (let r = 0; r < S; r++) for (let c = 0; c < S; c++) {
    if (board[r * S + c]) continue;
    let walls = 0;
    if (r === 0 || board[(r - 1) * S + c]) walls++;
    if (r === S - 1 || board[(r + 1) * S + c]) walls++;
    if (c === 0 || board[r * S + c - 1]) walls++;
    if (c === S - 1 || board[r * S + c + 1]) walls++;
    if (walls >= 3) n++;
  }
  return n;
}

export function bestMove(g) {
  let best = null;
  g.tray.forEach((p, t) => {
    if (!p) return;
    for (let r = 0; r <= S - p.h; r++) for (let c = 0; c <= S - p.w; c++) {
      if (!Core.canPlace(g.board, p, r, c)) continue;
      const b = g.board.slice();
      for (const [dr, dc] of p.cells) b[(r + dr) * S + c + dc] = 1;
      const { rows, cols } = Core.fullLines(b);
      const keep = (i) => (Core.isFixed({ board: g.board }, i) ? g.board[i] : 0);
      for (const rr of rows) for (let k = 0; k < S; k++) b[rr * S + k] = keep(rr * S + k);
      for (const cc of cols) for (let k = 0; k < S; k++) b[k * S + cc] = keep(k * S + cc);
      const filled = b.reduce((a, v, i) => a + (v && !Core.isFixed({ board: b }, i) ? 1 : 0), 0);
      const score = (rows.length + cols.length) * 40 - trapped(b) * 12 - filled * 1.5 + p.cells.length;
      if (!best || score > best.score) best = { t, r, c, score };
    }
  });
  return best;
}

// Uses the buddy's power: Fetch re-deals; an area power goes where it clears the most.
function usePower(g, b) {
  if (b.power === 'fetch') { Powers.use('fetch', g); return; }
  let best = null;
  for (let r = 0; r < S; r++) for (let c = 0; c < S; c++) {
    const n = Powers.previewCells(b.power, g, r, c).length;
    if (!best || n > best.n) best = { r, c, n };
  }
  Powers.use(b.power, g, best.r, best.c);
}

export function play(level, kind, seed) {
  const b = BUDDIES[kind];
  const g = Core.createGame(seed, { start: level.start, helpers: level.helpers, squirrels: level.squirrels, blower: level.blower, scoreBonus: b.bonus });
  let charges = b.charges;
  let moves = 0;
  for (; moves < 3000; moves++) {
    const m = bestMove(g);
    if (!m) {
      if (charges-- > 0) { usePower(g, b); continue; }
      break;
    }
    Core.placePiece(g, m.t, m.r, m.c);
  }
  return { score: g.score, moves, freed: !!(g.crate && g.crate.freed), dug: g.bonesDug, chased: g.squirrelsChased };
}
