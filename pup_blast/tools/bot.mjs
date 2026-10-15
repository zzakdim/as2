// Bot playtester: plays every level many times and reports pass and 3-star rates.
// A greedy bot (no lookahead) stands in for an average player. Two buddies are simulated:
//   starter  = Mochi at level 1 (Fetch x1 when stuck)
//   maxEpic  = a maxed epic (Cannonball x5 when stuck)
// Usage: node tools/bot.mjs [games per level] [first level] [last level]
//        node tools/bot.mjs tune [games per level]   -> rewrites www/js/tuning.js
// Tuning sets each level's stars from bot score percentiles: 1 star from the starter bot,
// 3 stars from the maxed-epic bot, tightening across the world (easy early, brutal late).
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const Core = require('../www/js/core.js');
const Powers = require('../www/js/powers.js');
const Levels = require('../www/js/levels.js');

const TUNE = process.argv[2] === 'tune';
const N = Number((TUNE ? process.argv[3] : process.argv[2]) || 30);
const FROM = TUNE ? 1 : Number(process.argv[3] || 1), TO = TUNE ? 40 : Number(process.argv[4] || 40);
const S = Core.SIZE;

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

function bestMove(g) {
  let best = null;
  g.tray.forEach((p, t) => {
    if (!p) return;
    for (let r = 0; r <= S - p.h; r++) for (let c = 0; c <= S - p.w; c++) {
      if (!Core.canPlace(g.board, p, r, c)) continue;
      const b = g.board.slice();
      for (const [dr, dc] of p.cells) b[(r + dr) * S + c + dc] = 1;
      const { rows, cols } = Core.fullLines(b);
      for (const rr of rows) for (let k = 0; k < S; k++) b[rr * S + k] = 0;
      for (const cc of cols) for (let k = 0; k < S; k++) b[k * S + cc] = 0;
      const filled = b.reduce((a, v) => a + (v ? 1 : 0), 0);
      const score = (rows.length + cols.length) * 40 - trapped(b) * 12 - filled * 1.5 + p.cells.length;
      if (!best || score > best.score) best = { t, r, c, score };
    }
  });
  return best;
}

function usePower(g, kind) {
  if (kind === 'starter') { Powers.use('fetch', g); return; }
  let best = null;
  for (let r = 0; r < S; r++) for (let c = 0; c < S; c++) {
    const n = Powers.previewCells('cannonball', g, r, c).length;
    if (!best || n > best.n) best = { r, c, n };
  }
  Powers.use('cannonball', g, best.r, best.c);
}

function play(level, kind, seed) {
  const g = Core.createGame(seed, { start: level.start, helpers: level.helpers });
  let charges = kind === 'starter' ? 1 : 5;
  for (let moves = 0; moves < 3000; moves++) {
    const m = bestMove(g);
    if (!m) {
      if (charges-- > 0) { usePower(g, kind); continue; }
      break;
    }
    Core.placePiece(g, m.t, m.r, m.c);
  }
  return { score: g.score, freed: !!(g.crate && g.crate.freed) };
}

// Share of bot runs that should FAIL each star. Humans plan ahead and beat this greedy bot,
// so real pass rates will run higher than the bot's.
function quantiles(level) {
  const n = level.n;
  let one = n <= 10 ? 0.15 : n <= 20 ? 0.3 : n <= 30 ? 0.45 : 0.55;
  if (n % 5 === 0) one += 0.1; // dig levels are a notch harder
  else if (n % 5 === 1 && n > 1) one -= 0.1; // the level after is a breather
  // Levels 1-20 set 3 stars against a starter buddy (anyone can get them); 21-40 against a maxed epic.
  const three = n <= 10 ? 0.45 : n <= 20 ? 0.8 : n <= 30 ? 0.72 : n < 40 ? 0.86 : 0.93;
  return { one, three, threeFrom: n <= 20 ? 'starter' : 'maxed' };
}
const at = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))];
const r50 = (x) => Math.max(50, Math.round(x / 50) * 50);

if (TUNE) {
  const out = {};
  for (const level of Levels.WORLDS[0].levels) {
    const opts = { start: level.start, helpers: level.helpers };
    const starter = Array.from({ length: N }, (_, k) => play({ ...level, ...opts }, 'starter', 1000 + k * 7919).score).sort((a, b) => a - b);
    const maxed = Array.from({ length: N }, (_, k) => play({ ...level, ...opts }, 'maxEpic', 1000 + k * 7919).score).sort((a, b) => a - b);
    const q = quantiles(level);
    const t1 = r50(at(starter, q.one));
    const t3 = Math.max(r50(at(q.threeFrom === 'starter' ? starter : maxed, q.three)), t1 + 100);
    const t2 = Math.min(Math.max(r50(Math.sqrt(t1 * t3)), t1 + 50), t3 - 50);
    out[level.id] = [t1, t2, t3];
    const rate = (arr, t) => Math.round((100 * arr.filter((x) => x >= t).length) / N);
    console.log(`${String(level.n).padStart(2)} ${level.name.padEnd(21)} ${String(t1).padStart(5)} / ${String(t2).padStart(5)} / ${String(t3).padStart(5)}  starter pass ${String(rate(starter, t1)).padStart(3)}% 3★ ${String(rate(starter, t3)).padStart(2)}%  maxEpic pass ${String(rate(maxed, t1)).padStart(3)}% 3★ ${String(rate(maxed, t3)).padStart(3)}%`);
  }
  const body = Object.entries(out).map(([id, t]) => `    '${id}': [${t.join(', ')}],`).join('\n');
  writeFileSync(new URL('../www/js/tuning.js', import.meta.url), `// Generated by tools/bot.mjs tune (${N} bot runs per level per buddy). Do not edit by hand:
// re-run the tuner after changing a level. [1 star, 2 stars, 3 stars]
(function (root) {
  'use strict';
  const LevelTuning = {
${body}
  };
  root.PB = root.PB || {};
  root.PB.LevelTuning = LevelTuning;
  if (typeof module !== 'undefined' && module.exports) module.exports = LevelTuning;
})(typeof globalThis !== 'undefined' ? globalThis : this);
`);
  console.log('wrote www/js/tuning.js');
  process.exit(0);
}

const rows = [];
for (const level of Levels.WORLDS[0].levels.slice(FROM - 1, TO)) {
  const [t1, , t3] = Levels.starsFor(level);
  const out = { level: level.n, name: level.name, target: t1, three: t3 };
  for (const kind of ['starter', 'maxEpic']) {
    const runs = Array.from({ length: N }, (_, k) => play(level, kind, 1000 + k * 7919));
    const scores = runs.map((x) => x.score).sort((a, b) => a - b);
    out[kind] = {
      pass: Math.round((100 * runs.filter((x) => x.score >= t1).length) / N),
      three: Math.round((100 * runs.filter((x) => x.score >= t3).length) / N),
      median: scores[Math.floor(N / 2)],
      freed: level.gift ? Math.round((100 * runs.filter((x) => x.freed).length) / N) : null,
    };
  }
  rows.push(out);
  const f = (k) => `${String(out[k].pass).padStart(3)}% pass ${String(out[k].three).padStart(3)}% 3★ med ${String(out[k].median).padStart(6)}${out[k].freed != null ? ` freed ${out[k].freed}%` : ''}`;
  console.log(`${String(level.n).padStart(2)} ${level.name.padEnd(21)} 1★ ${String(t1).padStart(5)} 3★ ${String(t3).padStart(6)} | starter ${f('starter')} | maxEpic ${f('maxEpic')}`);
}
