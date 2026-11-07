#!/usr/bin/env node
// Generates the Magic Boba test level pack.
// For each level spec: deal many random seeds, solve each one, keep the seed whose
// optimal solution length is closest to the spec's target. Every shipped level is
// proven solvable by the BFS solver.
//
// Usage: node generate.js            -> writes levels.json + levels.js
const fs = require('fs');
const path = require('path');
const Boba = require('./engine');

function rng(seed) {
  // mulberry32
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, r) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Pearls always rest at the bottom of a cup.
const settle = (cup) => cup.replace(/[^P]/g, '') + cup.replace(/P/g, '');

function deal(tokens, cupCount, cap, r, fillEvenly) {
  const bag = shuffle(tokens.slice(), r);
  const cups = Array.from({ length: cupCount }, () => '');
  if (fillEvenly) {
    bag.forEach((t, i) => (cups[Math.floor(i / cap)] += t));
  } else {
    for (const t of bag) {
      const open = cups.map((c, i) => i).filter((i) => cups[i].length < cap);
      cups[open[Math.floor(r() * open.length)]] += t;
    }
  }
  return cups.map(settle);
}

function buildSort(spec, r) {
  const tokens = [];
  for (const c of spec.colors) tokens.push(...c.repeat(spec.cap || 4));
  const filled = spec.colors.length;
  const cups = deal(tokens, filled, spec.cap || 4, r, true);
  for (let i = 0; i < spec.empty; i++) cups.push('');
  // Reject deals where a cup is already finished.
  if (cups.some((c) => c.length === (spec.cap || 4) && Boba.topRun(c) === c.length)) return null;
  return { mode: 'sort', cap: spec.cap || 4, cups };
}

function buildOrders(spec, r) {
  const cap = spec.cap || 4;
  const tokens = spec.orders.join('').split('');
  const cupCount = Math.ceil(tokens.length / cap) + (spec.extraCups || 0);
  const cups = deal(tokens, cupCount, cap, r, false);
  for (let i = 0; i < (spec.empty || 0); i++) cups.push('');
  // Reject deals that hand out a finished order for free.
  if (cups.some((c) => spec.orders.includes(c))) return null;
  return { mode: 'orders', cap, cups, orders: spec.orders.slice(), slots: spec.slots || 2 };
}

const PACK = [
  // ---- World 1 · Cozy Corner — classic sort, no magic --------------------------------
  { id: '1-1', world: 'Cozy Corner', title: 'First Pour', note: 'Tutorial: 3 flavours, 2 spare cups.',
    kind: 'sort', colors: ['T', 'M', 'G'], empty: 2, target: 6 },
  { id: '1-2', world: 'Cozy Corner', title: 'Busy Morning', note: '4 flavours.',
    kind: 'sort', colors: ['T', 'M', 'G', 'S'], empty: 2, target: 9 },
  { id: '1-3', world: 'Cozy Corner', title: 'Five Teas', note: '5 flavours.',
    kind: 'sort', colors: ['T', 'M', 'G', 'S', 'B'], empty: 2, target: 12 },
  { id: '1-4', world: 'Cozy Corner', title: 'Full Menu', note: '6 flavours — first real think.',
    kind: 'sort', colors: ['T', 'M', 'G', 'S', 'B', 'R'], empty: 2, target: 15 },
  { id: '1-5', world: 'Cozy Corner', title: 'One Spare Cup', note: 'Difficulty spike: only 1 empty cup.',
    kind: 'sort', colors: ['T', 'M', 'G', 'S'], empty: 1, target: 12 },

  // ---- World 2 · Pearl Grotto — pearls sink to the bottom ---------------------------
  { id: '2-1', world: 'Pearl Grotto', title: 'Sinking Feeling', note: 'Pearls added as a 4th "flavour". They sink under liquid.',
    kind: 'sort', colors: ['P', 'T', 'M'], empty: 2, target: 7 },
  { id: '2-2', world: 'Pearl Grotto', title: 'Pearl Diver', note: 'Pearls + 4 flavours.',
    kind: 'sort', colors: ['P', 'T', 'M', 'G', 'S'], empty: 2, target: 13 },
  { id: '2-3', world: 'Pearl Grotto', title: 'Double Pearls', note: 'Two cups worth of pearls buried everywhere.',
    kind: 'sort', colors: ['P', 'P', 'T', 'M', 'G'], empty: 2, target: 12 },

  // ---- Counter mode — customer orders (tests the recipe idea) -----------------------
  { id: 'C-1', world: 'The Counter', title: 'First Customers', note: 'Orders mode: pour into the order cup what it needs next. 2 customers at a time.',
    kind: 'orders', orders: ['TTTT', 'MMMM', 'GGGG'], slots: 2, empty: 0, extraCups: 0, target: 6 },
  { id: 'C-2', world: 'The Counter', title: 'Pearl Milk Tea', note: 'Recipes with pearls on the bottom.',
    kind: 'orders', orders: ['PTTT', 'PMMM', 'GGGG', 'PSSS'], slots: 2, empty: 0, extraCups: 1, target: 9 },
  { id: 'C-3', world: 'The Counter', title: 'Moon Milk Tea', note: 'Layered recipes: black tea under moon milk.',
    kind: 'orders', orders: ['KKWW', 'PKKK', 'WWWW', 'PKWW', 'TTTT'], slots: 2, empty: 0, extraCups: 1, target: 12 },
  { id: 'C-4', world: 'The Counter', title: 'Lunch Rush', note: 'Only one customer at a time, long queue.',
    kind: 'orders', orders: ['PTTT', 'MMMM', 'PGGG', 'SSSS', 'PBBB', 'TTMM'], slots: 1, empty: 0, extraCups: 1, target: 14 },
];

function generate(spec) {
  let best = null;
  for (let seed = 1; seed <= (spec.tries || 120); seed++) {
    const r = rng(seed * 7919 + spec.id.charCodeAt(0) * 31 + spec.id.charCodeAt(2));
    const lvl = spec.kind === 'sort' ? buildSort(spec, r) : buildOrders(spec, r);
    if (!lvl) continue;
    const sol = Boba.solve(lvl, 600000);
    if (!sol.solvable || sol.optimal < 3) continue;
    const score = Math.abs(sol.optimal - spec.target);
    if (!best || score < best.score) best = { score, seed, lvl, sol };
    if (score === 0) break;
  }
  if (!best) throw new Error('No solvable deal for ' + spec.id);
  const trap = Boba.trapRate(best.lvl, 300, rng(best.seed));
  const { kind, colors, empty, extraCups, tries, target, ...meta } = spec;
  return {
    ...meta,
    ...best.lvl,
    stats: { optimal: best.sol.optimal, target, branching: best.sol.branching, statesSearched: best.sol.states, randomPlayStuckPct: trap, seed: best.seed },
    solution: best.sol.path,
  };
}

const levels = PACK.map((spec) => {
  const t0 = Date.now();
  const lvl = generate(spec);
  const s = lvl.stats;
  console.log(`${lvl.id.padEnd(4)} ${lvl.title.padEnd(16)} optimal=${String(s.optimal).padStart(2)} (target ${s.target})  branching=${s.branching}  random-play stuck=${s.randomPlayStuckPct}%  [${Date.now() - t0}ms]`);
  return lvl;
});

const out = path.join(__dirname, 'levels');
fs.writeFileSync(out + '.json', JSON.stringify(levels, null, 2) + '\n');
fs.writeFileSync(out + '.js', '// Generated by generate.js — do not edit.\nwindow.LEVELS = ' + JSON.stringify(levels) + ';\n');
console.log(`\nWrote ${levels.length} levels to levels.json / levels.js`);
